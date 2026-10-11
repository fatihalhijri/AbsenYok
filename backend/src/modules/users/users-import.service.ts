import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import ExcelJS from 'exceljs';
import { ErrorCode } from '@/common/constants/error-codes';
import { Role } from '@/common/constants/roles';
import type { ClientInfo } from '@/common/decorators/client-info.decorator';
import { BusinessException } from '@/common/exceptions/business.exception';
import { fieldError } from '@/common/exceptions/error-factories';
import { detectFileType } from '@/common/utils/file-type.util';
import { hashPassword } from '@/common/utils/password.util';
import type { AuthUser } from '@/common/types/auth-user.type';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import { ImportUserRowDto } from './dto/import-user-row.dto';
import { UserIntegrityService } from './user-integrity.service';
import {
  bytesToMb,
  IMPORT_COLUMNS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_REQUIRED_COLUMNS,
} from './users.constants';

type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export interface ImportRowError {
  /** Nomor baris di Excel (baris 1 = header). */
  row: number;
  field: string;
  messages: string[];
}

export interface ImportResult {
  imported: number;
}

interface ParsedRow {
  row: number;
  values: Record<ImportColumn, string>;
}

const HASH_CONCURRENCY = 4;

/**
 * Import karyawan dari XLSX. Semua baris divalidasi lebih dulu; satu error saja → tidak ada
 * yang disimpan dan respons memuat daftar error per baris. Bila valid, disimpan dalam satu
 * transaksi. Semua user hasil import ber-role EMPLOYEE.
 */
@Injectable()
export class UsersImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrity: UserIntegrityService,
  ) {}

  async import(
    file: Express.Multer.File | undefined,
    actor: AuthUser,
    client: ClientInfo,
  ): Promise<ImportResult> {
    const buffer = await this.assertXlsx(file);
    const rows = await this.parse(buffer);
    const { valid, errors } = await this.validateRows(rows);

    if (errors.length > 0) {
      const invalidRows = new Set(errors.map((error) => error.row)).size;
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        `${invalidRows} baris tidak valid; tidak ada data yang disimpan`,
        400,
        errors.sort((a, b) => a.row - b.row || a.field.localeCompare(b.field)),
      );
    }

    // Hash di luar transaksi agar transaksi database tetap singkat.
    const users = await mapWithConcurrency(valid, HASH_CONCURRENCY, async (row) => ({
      id: randomUUID(),
      employeeCode: row.dto.employeeCode,
      name: row.dto.name,
      email: row.dto.email,
      phone: row.dto.phone ?? null,
      position: row.dto.position ?? null,
      role: Role.EMPLOYEE,
      departmentId: row.departmentId,
      shiftId: row.shiftId,
      passwordHash: await hashPassword(row.dto.password),
    }));

    const audits: Prisma.AuditLogCreateManyInput[] = users.map((user) => ({
      actorId: actor.id,
      action: AuditAction.USER_CREATED,
      entity: 'User',
      entityId: user.id,
      metadata: { employeeCode: user.employeeCode, role: Role.EMPLOYEE, source: 'XLSX_IMPORT' },
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
    }));

    await this.prisma.$transaction([
      this.prisma.user.createMany({ data: users }),
      this.prisma.auditLog.createMany({ data: audits }),
    ]);
    return { imported: users.length };
  }

  /** Template import: sheet Karyawan (header + contoh), Petunjuk, dan Referensi master data. */
  async buildTemplate(): Promise<Buffer> {
    const [departments, shifts] = await Promise.all([
      this.prisma.department.findMany({
        orderBy: { code: 'asc' },
        select: { code: true, name: true },
      }),
      this.prisma.shift.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { name: true, startTime: true, endTime: true, workDays: true },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AbsenYok';

    const sheet = workbook.addWorksheet('Karyawan');
    sheet.columns = IMPORT_COLUMNS.map((key) => ({
      header: key,
      key,
      width: key === 'email' ? 32 : 20,
    }));
    // Kolom teks agar nol di depan nomor telepon/kode tidak hilang.
    for (const key of ['employeeCode', 'phone', 'password'] satisfies ImportColumn[]) {
      sheet.getColumn(key).numFmt = '@';
    }
    sheet.getRow(1).font = { bold: true };
    sheet.addRow({
      employeeCode: 'EMP100',
      name: 'Siti Rahmawati',
      email: 'siti.rahmawati@perusahaan.co.id',
      phone: '081234567890',
      position: 'Staf HR',
      departmentCode: departments[0]?.code ?? 'HR',
      shiftName: shifts[0]?.name ?? 'Reguler',
      password: 'Karyawan@123',
    });

    const guide = workbook.addWorksheet('Petunjuk');
    guide.getColumn(1).width = 100;
    [
      'Petunjuk import karyawan AbsenYok',
      '1. Isi data mulai baris 2 sheet "Karyawan"; jangan ubah nama kolom di baris 1. Hapus baris contoh.',
      `2. Kolom wajib: ${IMPORT_REQUIRED_COLUMNS.join(', ')}. Maksimal ${IMPORT_MAX_ROWS} baris per file.`,
      '3. departmentCode dan shiftName harus sesuai sheet "Referensi" (shift harus aktif).',
      '4. Password minimal 8 karakter dengan huruf besar, huruf kecil, dan angka.',
      '5. Email dan kode karyawan harus unik. Semua akun hasil import ber-role EMPLOYEE.',
      '6. Bila ada satu baris tidak valid, tidak ada data yang disimpan; perbaiki sesuai daftar error.',
    ].forEach((line, index) => {
      guide.addRow([line]).font = index === 0 ? { bold: true, size: 13 } : {};
    });

    const reference = workbook.addWorksheet('Referensi');
    reference.columns = [
      { header: 'departmentCode', key: 'code', width: 18 },
      { header: 'Nama departemen', key: 'name', width: 30 },
      { header: '', key: 'gap', width: 4 },
      { header: 'shiftName', key: 'shift', width: 22 },
      { header: 'Jam kerja', key: 'hours', width: 14 },
      { header: 'Hari kerja (1=Sen…7=Min)', key: 'days', width: 26 },
    ];
    reference.getRow(1).font = { bold: true };
    const total = Math.max(departments.length, shifts.length);
    for (let i = 0; i < total; i += 1) {
      reference.addRow({
        code: departments[i]?.code,
        name: departments[i]?.name,
        shift: shifts[i]?.name,
        hours: shifts[i] ? `${shifts[i].startTime}–${shifts[i].endTime}` : undefined,
        days: shifts[i]?.workDays,
      });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private async assertXlsx(file: Express.Multer.File | undefined): Promise<Buffer> {
    if (!file?.buffer?.length) throw fieldError('file', 'File XLSX wajib diunggah');
    if (file.size > IMPORT_MAX_BYTES) {
      throw fieldError('file', `Ukuran file maksimal ${bytesToMb(IMPORT_MAX_BYTES)} MB`);
    }
    const type = await detectFileType(file.buffer);
    if (type?.ext !== 'xlsx') throw fieldError('file', 'File harus berformat Excel .xlsx');
    return file.buffer;
  }

  private async parse(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw fieldError('file', 'File XLSX rusak atau tidak dapat dibaca');
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) throw fieldError('file', 'File XLSX tidak memiliki sheet');

    // Header boleh berurutan bebas; nama kolom dicocokkan tanpa membedakan huruf besar/kecil.
    const columnIndex = new Map<ImportColumn, number>();
    sheet.getRow(1).eachCell((cell, col) => {
      const header = cell.text.trim().toLowerCase();
      const match = IMPORT_COLUMNS.find((key) => key.toLowerCase() === header);
      if (match) columnIndex.set(match, col);
    });

    const missing = IMPORT_REQUIRED_COLUMNS.filter((key) => !columnIndex.has(key));
    if (missing.length > 0) {
      throw new BusinessException(
        ErrorCode.VALIDATION_ERROR,
        'Header file tidak sesuai template',
        400,
        missing.map((field) => ({
          row: 1,
          field,
          messages: ['Kolom wajib tidak ditemukan di header'],
        })),
      );
    }

    const rows: ParsedRow[] = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const values = Object.fromEntries(
        IMPORT_COLUMNS.map((key) => {
          const col = columnIndex.get(key);
          return [key, col ? row.getCell(col).text.trim() : ''];
        }),
      ) as Record<ImportColumn, string>;
      if (Object.values(values).every((value) => value === '')) continue;
      rows.push({ row: rowNumber, values });
    }

    if (rows.length === 0) throw fieldError('file', 'File tidak berisi data karyawan');
    if (rows.length > IMPORT_MAX_ROWS) {
      throw fieldError(
        'file',
        `Maksimal ${IMPORT_MAX_ROWS} baris per file (ditemukan ${rows.length})`,
      );
    }
    return rows;
  }

  private async validateRows(rows: ParsedRow[]) {
    const errors: ImportRowError[] = [];
    const addError = (row: number, field: string, message: string) => {
      const existing = errors.find((e) => e.row === row && e.field === field);
      if (existing) existing.messages.push(message);
      else errors.push({ row, field, messages: [message] });
    };

    // 1) Format per baris.
    const parsed = await Promise.all(
      rows.map(async ({ row, values }) => {
        const dto = plainToInstance(ImportUserRowDto, values);
        for (const error of await validate(dto)) {
          for (const message of Object.values(error.constraints ?? {})) {
            addError(row, error.property, message);
          }
        }
        return { row, dto };
      }),
    );

    // 2) Duplikat di dalam file.
    const firstSeen = { email: new Map<string, number>(), employeeCode: new Map<string, number>() };
    for (const { row, dto } of parsed) {
      for (const field of ['email', 'employeeCode'] as const) {
        const value = dto[field];
        if (!value) continue;
        const first = firstSeen[field].get(value);
        if (first === undefined) firstSeen[field].set(value, row);
        else
          addError(
            row,
            field,
            `${field === 'email' ? 'Email' : 'Kode karyawan'} duplikat dengan baris ${first}`,
          );
      }
    }

    // 3) Referensi master data.
    const codes = [...new Set(parsed.map((p) => p.dto.departmentCode).filter(Boolean))] as string[];
    const shiftNames = [...new Set(parsed.map((p) => p.dto.shiftName).filter(Boolean))] as string[];
    const [departments, shifts] = await Promise.all([
      codes.length
        ? this.prisma.department.findMany({
            where: { code: { in: codes } },
            select: { id: true, code: true },
          })
        : [],
      shiftNames.length
        ? this.prisma.shift.findMany({
            where: { name: { in: shiftNames }, isActive: true },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const departmentIds = new Map(departments.map((d) => [d.code.toUpperCase(), d.id]));
    const shiftIds = new Map(shifts.map((s) => [s.name.toLowerCase(), s.id]));

    for (const { row, dto } of parsed) {
      if (dto.departmentCode && !departmentIds.has(dto.departmentCode)) {
        addError(row, 'departmentCode', `Departemen "${dto.departmentCode}" tidak ditemukan`);
      }
      if (dto.shiftName && !shiftIds.has(dto.shiftName.toLowerCase())) {
        addError(row, 'shiftName', `Shift "${dto.shiftName}" tidak ditemukan atau tidak aktif`);
      }
    }

    // 4) Bentrok dengan data di database (termasuk akun yang sudah dihapus).
    const conflicts = await this.integrity.findIdentityConflicts(
      parsed.map(({ dto }) => ({ email: dto.email, employeeCode: dto.employeeCode })),
    );
    for (const conflict of conflicts) {
      addError(parsed[conflict.index].row, conflict.field, conflict.message);
    }

    const valid = parsed.map(({ row, dto }) => ({
      row,
      dto,
      departmentId: dto.departmentCode ? (departmentIds.get(dto.departmentCode) ?? null) : null,
      shiftId: dto.shiftName ? (shiftIds.get(dto.shiftName.toLowerCase()) ?? null) : null,
    }));
    return { valid, errors };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
