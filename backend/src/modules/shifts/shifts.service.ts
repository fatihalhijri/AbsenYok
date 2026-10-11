import { Injectable } from '@nestjs/common';
import { conflictError, notFoundError, validationError } from '@/common/exceptions/error-factories';
import type { PaginatedResult } from '@/common/types/api-response.type';
import { omitUndefined } from '@/common/utils/object.util';
import { paginate, toSkipTake } from '@/common/utils/paginate.util';
import { resolveOrderBy } from '@/common/utils/sort.util';
import type { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  type CreateShiftDto,
  SHIFT_SORT_FIELDS,
  type ShiftQueryDto,
  type UpdateShiftDto,
} from './dto/shift.dto';
import { validateShiftTiming } from './shift-rules';

const SHIFT_SELECT = {
  id: true,
  name: true,
  startTime: true,
  endTime: true,
  lateToleranceMinutes: true,
  checkInOpenMinutes: true,
  workDays: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: { where: { deletedAt: null } } } },
} satisfies Prisma.ShiftSelect;

type ShiftRow = Prisma.ShiftGetPayload<{ select: typeof SHIFT_SELECT }>;

export type ShiftView = Omit<ShiftRow, '_count'> & { userCount: number };

const toView = ({ _count, ...shift }: ShiftRow): ShiftView => ({
  ...shift,
  userCount: _count.users,
});

const DEFAULTS = { lateToleranceMinutes: 15, checkInOpenMinutes: 60, workDays: '1,2,3,4,5' };

/**
 * CRUD shift. Mengubah shift tidak memengaruhi absensi lama karena setiap absensi
 * menyimpan `shiftSnapshot` saat check-in.
 */
@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ShiftQueryDto): Promise<PaginatedResult<ShiftView>> {
    const where: Prisma.ShiftWhereInput = query.search ? { name: { contains: query.search } } : {};
    const orderBy = resolveOrderBy(query.sortBy, query.sortOrder, SHIFT_SORT_FIELDS, 'name');
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.shift.findMany({ where, orderBy, select: SHIFT_SELECT, ...toSkipTake(query) }),
      this.prisma.shift.count({ where }),
    ]);
    return paginate(rows.map(toView), total, query);
  }

  async findOne(id: string): Promise<ShiftView> {
    const row = await this.prisma.shift.findUnique({ where: { id }, select: SHIFT_SELECT });
    if (!row) throw notFoundError('Shift tidak ditemukan');
    return toView(row);
  }

  async create(dto: CreateShiftDto): Promise<ShiftView> {
    const data = {
      ...DEFAULTS,
      ...omitUndefined(dto),
      name: dto.name,
      startTime: dto.startTime,
      endTime: dto.endTime,
    };
    const workDays = this.assertTiming(data);
    await this.assertUniqueName(dto.name);
    const row = await this.prisma.shift.create({
      data: { ...data, workDays },
      select: SHIFT_SELECT,
    });
    return toView(row);
  }

  async update(id: string, dto: UpdateShiftDto): Promise<ShiftView> {
    const current = await this.findOne(id);
    // Validasi lintas-field memakai gabungan nilai lama + perubahan.
    const workDays = this.assertTiming({ ...current, ...omitUndefined(dto) });
    if (dto.name) await this.assertUniqueName(dto.name, id);

    const row = await this.prisma.shift.update({
      where: { id },
      data: { ...dto, ...(dto.workDays !== undefined && { workDays }) },
      select: SHIFT_SELECT,
    });
    return toView(row);
  }

  /** Ditolak (409) bila masih dipakai karyawan — mencegah karyawan tanpa shift tak terduga. */
  async remove(id: string): Promise<void> {
    const shift = await this.findOne(id);
    if (shift.userCount > 0) {
      throw conflictError(
        `Shift masih dipakai ${shift.userCount} karyawan; pindahkan karyawan atau nonaktifkan shift`,
      );
    }
    await this.prisma.shift.delete({ where: { id } });
  }

  private assertTiming(shift: {
    startTime: string;
    endTime: string;
    checkInOpenMinutes: number;
    workDays: string;
  }): string {
    const { errors, workDays } = validateShiftTiming(shift);
    if (errors.length > 0) throw validationError(errors);
    return workDays;
  }

  private async assertUniqueName(name: string, excludeId?: string): Promise<void> {
    const existing = await this.prisma.shift.findFirst({
      where: { name, ...(excludeId && { NOT: { id: excludeId } }) },
      select: { id: true },
    });
    if (existing) {
      throw conflictError('Data sudah ada', [
        { field: 'name', messages: ['Nama shift sudah digunakan'] },
      ]);
    }
  }
}
