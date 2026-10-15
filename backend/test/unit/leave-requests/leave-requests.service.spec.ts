import { ErrorCode } from '@/common/constants/error-codes';
import { Role } from '@/common/constants/roles';
import type { AuthUser } from '@/common/types/auth-user.type';
import { setAppTimezone, toDbDate } from '@/common/utils/date.util';
import { AuditAction } from '@/modules/audit-logs/audit-action';
import type { AuditLogsService } from '@/modules/audit-logs/audit-logs.service';
import type {
  CreateLeaveRequestDto,
  LeaveQueryDto,
} from '@/modules/leave-requests/dto/leave-request.dto';
import type { LeaveAttachmentStorage } from '@/modules/leave-requests/leave-attachment.storage';
import { LeaveRequestsService } from '@/modules/leave-requests/leave-requests.service';
import type { SettingsService } from '@/modules/settings/settings.service';
import type { PrismaService } from '@/prisma/prisma.service';

/** Senin, 19 Oktober 2026 10:00 WIB. */
const NOW = new Date('2026-10-19T03:00:00.000Z');
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const LEAVE_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN: AuthUser = { id: 'admin-1', email: 'admin@absenyok.id', role: Role.ADMIN };
const CLIENT = { ipAddress: '10.0.0.1', userAgent: 'jest' };
const SETTINGS: Record<string, number> = { 'leave.maxRangeDays': 14, 'leave.annualQuota': 12 };

function leaveRow(overrides: Record<string, unknown> = {}) {
  return {
    id: LEAVE_ID,
    userId: OWNER,
    type: 'SICK',
    startDate: toDbDate('2026-10-19'),
    endDate: toDbDate('2026-10-20'),
    totalDays: 2,
    reason: 'Demam',
    attachmentUrl: null as string | null,
    status: 'PENDING',
    reviewedAt: null,
    reviewNote: null,
    createdAt: NOW,
    updatedAt: NOW,
    user: { id: OWNER, name: 'Budi', employeeCode: 'EMP001', department: null },
    reviewedBy: null,
    ...overrides,
  };
}

function setup() {
  const leaveRequest = {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([leaveRow()]),
    findUnique: jest.fn().mockResolvedValue(leaveRow()),
    create: jest.fn().mockResolvedValue(leaveRow()),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    groupBy: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(1),
  };
  /** Klien transaksi berbagi delegate leaveRequest dengan prisma; $queryRaw = kunci baris user. */
  const tx = {
    leaveRequest,
    attendance: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ shift: { workDays: '1,2,3,4,5', isActive: true } }),
    },
    holiday: { findMany: jest.fn().mockResolvedValue([]) },
    leaveRequest,
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => Promise<unknown>)(tx)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };
  const storage = {
    validate: jest.fn().mockResolvedValue({ buffer: Buffer.from('x'), ext: 'pdf' }),
    save: jest.fn().mockResolvedValue('leave/key.pdf'),
    remove: jest.fn().mockResolvedValue(undefined),
    open: jest.fn().mockResolvedValue({ mime: 'application/pdf' }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const settings = { get: jest.fn((key: string) => Promise.resolve(SETTINGS[key])) };
  const clock = { now: () => NOW };

  const service = new LeaveRequestsService(
    prisma as unknown as PrismaService,
    clock,
    settings as unknown as SettingsService,
    storage as unknown as LeaveAttachmentStorage,
    audit as unknown as AuditLogsService,
  );
  return { service, prisma, tx, storage, audit };
}

const dto = (overrides: Partial<CreateLeaveRequestDto> = {}): CreateLeaveRequestDto => ({
  type: 'PERMIT',
  startDate: '2026-10-20',
  endDate: '2026-10-20',
  reason: 'Urusan keluarga',
  ...overrides,
});

const file = { buffer: Buffer.from('%PDF-'), size: 5 } as Express.Multer.File;

const fieldErrorOn = (field: string) => ({
  code: ErrorCode.VALIDATION_ERROR,
  details: [expect.objectContaining({ field })],
});

describe('LeaveRequestsService', () => {
  beforeAll(() => setAppTimezone('Asia/Jakarta'));

  describe('create', () => {
    it.each([
      [
        'endDate sebelum startDate',
        dto({ startDate: '2026-10-21', endDate: '2026-10-20' }),
        'endDate',
      ],
      [
        'lebih dari 7 hari ke belakang',
        dto({ startDate: '2026-10-11', endDate: '2026-10-12' }),
        'startDate',
      ],
      [
        'rentang > leave.maxRangeDays',
        dto({ startDate: '2026-10-20', endDate: '2026-11-10' }),
        'endDate',
      ],
      [
        'cuti tahunan lintas tahun',
        dto({ type: 'ANNUAL', startDate: '2026-12-30', endDate: '2027-01-02' }),
        'endDate',
      ],
      ['hanya akhir pekan', dto({ startDate: '2026-10-24', endDate: '2026-10-25' }), 'startDate'],
    ])('menolak: %s', async (_label, input, field) => {
      const { service, prisma } = setup();
      await expect(service.create(OWNER, input, undefined)).rejects.toMatchObject(
        fieldErrorOn(field),
      );
      expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('7 hari ke belakang masih diterima (sakit mendadak)', async () => {
      const { service, prisma } = setup();
      await service.create(
        OWNER,
        dto({ startDate: '2026-10-12', endDate: '2026-10-12' }),
        undefined,
      );
      expect(prisma.leaveRequest.create).toHaveBeenCalled();
    });

    it.each([
      ['tanpa shift', null],
      ['shift nonaktif', { shift: { workDays: '1,2,3,4,5', isActive: false } }],
    ])('%s → NO_SHIFT_ASSIGNED', async (_label, user) => {
      const { service, prisma } = setup();
      prisma.user.findFirst.mockResolvedValue(user);
      await expect(service.create(OWNER, dto(), undefined)).rejects.toMatchObject({
        code: ErrorCode.NO_SHIFT_ASSIGNED,
      });
    });

    it('hari libur tidak dihitung; seluruh rentang libur → ditolak', async () => {
      const { service, prisma } = setup();
      prisma.holiday.findMany.mockResolvedValue([{ date: toDbDate('2026-10-20') }]);
      await expect(service.create(OWNER, dto(), undefined)).rejects.toMatchObject(
        fieldErrorOn('startDate'),
      );
    });

    it('bertabrakan dengan pengajuan PENDING/APPROVED → 409 dengan detail', async () => {
      const { service, prisma } = setup();
      prisma.leaveRequest.findFirst.mockResolvedValue(leaveRow({ status: 'APPROVED' }));
      const error = service.create(OWNER, dto(), undefined);
      await expect(error).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
        details: [{ field: 'startDate', messages: [expect.stringContaining('APPROVED')] }],
      });
      expect(prisma.leaveRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: OWNER,
            status: { in: ['PENDING', 'APPROVED'] },
          }),
        }),
      );
    });

    it('sakit > 1 hari tanpa lampiran → wajib surat dokter', async () => {
      const { service } = setup();
      await expect(
        service.create(OWNER, dto({ type: 'SICK', endDate: '2026-10-21' }), undefined),
      ).rejects.toMatchObject(fieldErrorOn('attachment'));
    });

    it('sakit 1 hari boleh tanpa lampiran', async () => {
      const { service, prisma } = setup();
      await service.create(OWNER, dto({ type: 'SICK' }), undefined);
      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalDays: 1, attachmentUrl: null }),
        }),
      );
    });

    it('cuti tahunan melebihi sisa kuota (termasuk PENDING) → ditolak', async () => {
      const { service, prisma } = setup();
      prisma.leaveRequest.groupBy.mockResolvedValue([
        { status: 'APPROVED', _sum: { totalDays: 9 } },
        { status: 'PENDING', _sum: { totalDays: 2 } },
      ]);
      const error = service.create(
        OWNER,
        dto({ type: 'ANNUAL', startDate: '2026-10-20', endDate: '2026-10-21' }),
        undefined,
      );
      await expect(error).rejects.toMatchObject({
        details: [{ field: 'type', messages: [expect.stringContaining('tersedia 1 hari')] }],
      });
    });

    it('cuti tahunan dalam kuota → tersimpan', async () => {
      const { service, prisma } = setup();
      prisma.leaveRequest.groupBy.mockResolvedValue([
        { status: 'APPROVED', _sum: { totalDays: 3 } },
      ]);
      await service.create(
        OWNER,
        dto({ type: 'ANNUAL', startDate: '2026-10-20', endDate: '2026-10-23' }),
        undefined,
      );
      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'ANNUAL', totalDays: 4 }),
        }),
      );
    });

    it('lampiran divalidasi & disimpan setelah semua validasi; respons memakai URL endpoint', async () => {
      const { service, prisma, storage } = setup();
      prisma.leaveRequest.create.mockResolvedValue(leaveRow({ attachmentUrl: 'leave/key.pdf' }));

      const view = await service.create(OWNER, dto({ type: 'SICK', endDate: '2026-10-21' }), file);

      expect(storage.validate).toHaveBeenCalledWith(file);
      expect(storage.save).toHaveBeenCalled();
      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ attachmentUrl: 'leave/key.pdf', totalDays: 2 }),
        }),
      );
      expect(view).toMatchObject({
        startDate: '2026-10-19',
        endDate: '2026-10-20',
        hasAttachment: true,
        attachmentUrl: `/api/v1/leave-requests/${LEAVE_ID}/attachment`,
      });
    });

    it('lampiran tidak disimpan bila validasi bisnis gagal', async () => {
      const { service, prisma, storage } = setup();
      prisma.leaveRequest.findFirst.mockResolvedValue(leaveRow());
      await expect(service.create(OWNER, dto(), file)).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
      });
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('cek tumpang tindih + kuota + simpan berjalan di transaksi yang mengunci baris user', async () => {
      const { service, prisma, tx } = setup();
      await service.create(OWNER, dto({ type: 'ANNUAL' }), undefined);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const lockSql = (tx.$queryRaw.mock.calls[0][0] as string[]).join('?');
      expect(lockSql).toBe('SELECT id FROM users WHERE id = ? FOR UPDATE');
      expect(tx.$queryRaw.mock.calls[0][1]).toBe(OWNER);
      // Kunci diambil sebelum cek tumpang tindih.
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.leaveRequest.findFirst.mock.invocationCallOrder[0],
      );
    });

    it('penyimpanan DB gagal → file lampiran dihapus lagi', async () => {
      const { service, prisma, storage } = setup();
      prisma.leaveRequest.create.mockRejectedValue(new Error('DB down'));
      await expect(service.create(OWNER, dto(), file)).rejects.toThrow('DB down');
      expect(storage.remove).toHaveBeenCalledWith('leave/key.pdf');
    });

    it('penyimpanan DB gagal tanpa lampiran → error diteruskan', async () => {
      const { service, prisma, storage } = setup();
      prisma.leaveRequest.create.mockRejectedValue(new Error('DB down'));
      await expect(service.create(OWNER, dto(), undefined)).rejects.toThrow('DB down');
      expect(storage.remove).not.toHaveBeenCalled();
    });
  });

  describe('myList & quota', () => {
    it('default tahun berjalan (zona APP_TIMEZONE), urut startDate terbaru', async () => {
      const { service, prisma } = setup();
      const rows = await service.myList(OWNER, {});
      expect(rows[0]).toMatchObject({ hasAttachment: false, attachmentUrl: null });
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: OWNER,
            status: undefined,
            startDate: { gte: toDbDate('2026-01-01'), lte: toDbDate('2026-12-31') },
          },
          orderBy: { startDate: 'desc' },
        }),
      );
    });

    it('filter tahun & status', async () => {
      const { service, prisma } = setup();
      await service.myList(OWNER, { year: 2025, status: 'APPROVED' });
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'APPROVED',
            startDate: { gte: toDbDate('2025-01-01'), lte: toDbDate('2025-12-31') },
          }),
        }),
      );
    });

    it('kuota: used = APPROVED, pending terpisah, remaining tidak negatif', async () => {
      const { service, prisma } = setup();
      prisma.leaveRequest.groupBy.mockResolvedValue([
        { status: 'APPROVED', _sum: { totalDays: 13 } },
        { status: 'PENDING', _sum: { totalDays: null } },
      ]);
      await expect(service.quota(OWNER)).resolves.toEqual({
        year: 2026,
        quota: 12,
        used: 13,
        pending: 0,
        remaining: 0,
      });
    });
  });

  describe('cancel', () => {
    it('hanya pemilik', async () => {
      const { service, prisma } = setup();
      await expect(service.cancel(OTHER, LEAVE_ID)).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
      expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
    });

    it('status bukan PENDING → 409', async () => {
      const { service, prisma } = setup();
      prisma.leaveRequest.findUnique.mockResolvedValue(leaveRow({ status: 'APPROVED' }));
      await expect(service.cancel(OWNER, LEAVE_ID)).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
      });
    });

    it('status berubah di tengah jalan (race) → 409', async () => {
      const { service, prisma } = setup();
      prisma.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.cancel(OWNER, LEAVE_ID)).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
      });
    });

    it('PENDING milik sendiri → CANCELLED (update bersyarat status PENDING)', async () => {
      const { service, prisma } = setup();
      prisma.leaveRequest.findUnique
        .mockResolvedValueOnce(leaveRow())
        .mockResolvedValueOnce(leaveRow({ status: 'CANCELLED' }));
      await expect(service.cancel(OWNER, LEAVE_ID)).resolves.toMatchObject({ status: 'CANCELLED' });
      expect(prisma.leaveRequest.updateMany).toHaveBeenCalledWith({
        where: { id: LEAVE_ID, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    });

    it('pengajuan tidak ada → 404', async () => {
      const { service, prisma } = setup();
      prisma.leaveRequest.findUnique.mockResolvedValue(null);
      await expect(service.cancel(OWNER, LEAVE_ID)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });

  describe('approve', () => {
    it('mengubah ABSENT tanpa check-in s/d hari ini menjadi status izin + audit dalam transaksi', async () => {
      const { service, prisma, tx, audit } = setup();
      prisma.leaveRequest.findUnique.mockResolvedValue(
        leaveRow({
          startDate: toDbDate('2026-10-15'),
          endDate: toDbDate('2026-10-22'),
          totalDays: 6,
        }),
      );

      await service.approve(LEAVE_ID, ADMIN, 'Semoga lekas sembuh', CLIENT);

      expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({
        where: { id: LEAVE_ID, status: 'PENDING' },
        data: expect.objectContaining({
          status: 'APPROVED',
          reviewedById: ADMIN.id,
          reviewedAt: NOW,
          reviewNote: 'Semoga lekas sembuh',
        }),
      });
      expect(tx.attendance.updateMany).toHaveBeenCalledWith({
        where: {
          userId: OWNER,
          date: { gte: toDbDate('2026-10-15'), lte: toDbDate('2026-10-19') },
          status: 'ABSENT',
          checkInAt: null,
        },
        data: expect.objectContaining({ status: 'SICK', leaveRequestId: LEAVE_ID, workMinutes: 0 }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LEAVE_APPROVED,
          entityId: LEAVE_ID,
          metadata: expect.objectContaining({
            convertedAttendances: 2,
            note: 'Semoga lekas sembuh',
          }),
          ip: CLIENT.ipAddress,
        }),
        tx,
      );
    });

    it('pengajuan yang seluruhnya di masa depan tidak mengubah absensi (diisi cron)', async () => {
      const { service, prisma, tx, audit } = setup();
      prisma.leaveRequest.findUnique.mockResolvedValue(
        leaveRow({
          type: 'PERMIT',
          startDate: toDbDate('2026-10-21'),
          endDate: toDbDate('2026-10-21'),
        }),
      );
      await service.approve(LEAVE_ID, ADMIN, undefined, CLIENT);
      expect(tx.attendance.updateMany).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ convertedAttendances: 0, note: null }),
        }),
        tx,
      );
    });

    it('pengajuan yang sudah lewat seluruhnya: batas atas = endDate', async () => {
      const { service, prisma, tx } = setup();
      prisma.leaveRequest.findUnique.mockResolvedValue(
        leaveRow({
          type: 'ANNUAL',
          startDate: toDbDate('2026-10-13'),
          endDate: toDbDate('2026-10-14'),
        }),
      );
      await service.approve(LEAVE_ID, ADMIN, undefined, CLIENT);
      expect(tx.attendance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: { gte: toDbDate('2026-10-13'), lte: toDbDate('2026-10-14') },
          }),
          data: expect.objectContaining({ status: 'LEAVE' }),
        }),
      );
    });

    it('cuti tahunan: kuota dicek ulang saat approve → 409 bila tidak cukup', async () => {
      const { service, prisma, tx } = setup();
      prisma.leaveRequest.findUnique.mockResolvedValue(leaveRow({ type: 'ANNUAL', totalDays: 3 }));
      prisma.leaveRequest.groupBy.mockResolvedValue([
        { status: 'APPROVED', _sum: { totalDays: 10 } },
      ]);
      await expect(service.approve(LEAVE_ID, ADMIN, undefined, CLIENT)).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
        message: expect.stringContaining('terpakai 10 dari 12 hari'),
      });
      expect(tx.leaveRequest.updateMany).not.toHaveBeenCalled();
    });

    it('cuti tahunan dalam kuota → disetujui (kuota dicek di dalam transaksi berkunci)', async () => {
      const { service, prisma, tx } = setup();
      prisma.leaveRequest.findUnique.mockResolvedValue(leaveRow({ type: 'ANNUAL', totalDays: 2 }));
      prisma.leaveRequest.groupBy.mockResolvedValue([
        { status: 'APPROVED', _sum: { totalDays: 10 } },
      ]);
      await service.approve(LEAVE_ID, ADMIN, undefined, CLIENT);
      expect(tx.leaveRequest.updateMany).toHaveBeenCalled();
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.leaveRequest.groupBy.mock.invocationCallOrder[0],
      );
    });

    it('bukan PENDING → 409; race di dalam transaksi → 409 tanpa audit', async () => {
      const { service, prisma, tx, audit } = setup();
      prisma.leaveRequest.findUnique.mockResolvedValueOnce(leaveRow({ status: 'REJECTED' }));
      await expect(service.approve(LEAVE_ID, ADMIN, undefined, CLIENT)).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
      });

      tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.approve(LEAVE_ID, ADMIN, undefined, CLIENT)).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
      });
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('menolak dengan catatan + audit LEAVE_REJECTED', async () => {
      const { service, tx, audit } = setup();
      await service.reject(LEAVE_ID, ADMIN, 'Dokumen kurang', CLIENT);
      expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({
        where: { id: LEAVE_ID, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          reviewedById: ADMIN.id,
          reviewedAt: NOW,
          reviewNote: 'Dokumen kurang',
        },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LEAVE_REJECTED,
          metadata: expect.objectContaining({ note: 'Dokumen kurang', startDate: '2026-10-19' }),
        }),
        tx,
      );
    });

    it('bukan PENDING / race → 409', async () => {
      const { service, prisma, tx } = setup();
      prisma.leaveRequest.findUnique.mockResolvedValueOnce(leaveRow({ status: 'CANCELLED' }));
      await expect(service.reject(LEAVE_ID, ADMIN, 'x', CLIENT)).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
      });
      tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.reject(LEAVE_ID, ADMIN, 'x', CLIENT)).rejects.toMatchObject({
        code: ErrorCode.CONFLICT,
      });
    });
  });

  describe('adminList', () => {
    it('filter rentang beririsan, departemen, pencarian, paginasi', async () => {
      const { service, prisma } = setup();
      const query = {
        page: 2,
        limit: 10,
        status: 'PENDING',
        type: 'SICK',
        departmentId: 'dep-1',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
        search: 'Budi',
        sortBy: 'startDate',
        sortOrder: 'asc',
      } as LeaveQueryDto;

      const result = await service.adminList(query);

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING',
            type: 'SICK',
            userId: undefined,
            startDate: { lte: toDbDate('2026-10-31') },
            endDate: { gte: toDbDate('2026-10-01') },
            user: {
              departmentId: 'dep-1',
              OR: [{ name: { contains: 'Budi' } }, { employeeCode: { contains: 'Budi' } }],
            },
          },
          orderBy: { startDate: 'asc' },
          skip: 10,
          take: 10,
        }),
      );
      expect(result.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
      expect(result.items[0]).toMatchObject({ id: LEAVE_ID, startDate: '2026-10-19' });
    });

    it('tanpa filter opsional', async () => {
      const { service, prisma } = setup();
      await service.adminList({ page: 1, limit: 20 } as LeaveQueryDto);
      const args = prisma.leaveRequest.findMany.mock.calls[0][0] as { where: object };
      expect(args.where).not.toHaveProperty('startDate');
      expect(args.where).not.toHaveProperty('endDate');
    });
  });

  describe('findOne & attachment (BOLA)', () => {
    const employee = (id: string): AuthUser => ({
      id,
      email: 'e@absenyok.id',
      role: Role.EMPLOYEE,
    });

    it('pemilik & admin boleh melihat; karyawan lain → 403', async () => {
      const { service } = setup();
      await expect(service.findOne(LEAVE_ID, employee(OWNER))).resolves.toMatchObject({
        id: LEAVE_ID,
      });
      await expect(service.findOne(LEAVE_ID, ADMIN)).resolves.toMatchObject({ id: LEAVE_ID });
      await expect(service.findOne(LEAVE_ID, employee(OTHER))).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
    });

    it('lampiran: 404 bila pengajuan/lampiran tidak ada, 403 bukan pemilik, selain itu dibuka', async () => {
      const { service, prisma, storage } = setup();
      prisma.leaveRequest.findUnique.mockResolvedValueOnce(null);
      await expect(service.attachment(LEAVE_ID, ADMIN)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });

      prisma.leaveRequest.findUnique.mockResolvedValue({ userId: OWNER, attachmentUrl: null });
      await expect(service.attachment(LEAVE_ID, ADMIN)).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
        message: 'Pengajuan ini tidak memiliki lampiran',
      });

      prisma.leaveRequest.findUnique.mockResolvedValue({
        userId: OWNER,
        attachmentUrl: 'leave/key.pdf',
      });
      await expect(service.attachment(LEAVE_ID, employee(OTHER))).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN,
      });
      await expect(service.attachment(LEAVE_ID, employee(OWNER))).resolves.toEqual({
        mime: 'application/pdf',
      });
      expect(storage.open).toHaveBeenCalledWith('leave/key.pdf');
    });
  });
});
