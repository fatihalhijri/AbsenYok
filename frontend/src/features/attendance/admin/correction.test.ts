import { describe, expect, it } from 'vitest';
import type { AttendanceDetail } from '@/types';
import {
  AUTO_STATUS,
  correctionDefaults,
  correctionFormSchema,
  type CorrectionFormValues,
  manualFormSchema,
  previewCorrection,
  toManualInput,
  toZonedIso,
} from './correction';

/** Kamis 22 Okt 2026, shift Reguler 08:00–17:00 WIB (toleransi 15 menit). */
const NOW = new Date('2026-10-22T12:00:00.000Z'); // 19:00 WIB

function makeDetail(overrides: Partial<AttendanceDetail> = {}): AttendanceDetail {
  return {
    id: 'a1',
    userId: 'u1',
    date: '2026-10-22',
    status: 'LATE',
    checkInAt: '2026-10-22T01:22:37.000Z', // 08:22:37 WIB
    checkOutAt: '2026-10-22T10:00:00.000Z', // 17:00 WIB
    checkInMethod: 'KIOSK_QR',
    checkOutMethod: 'KIOSK_QR',
    lateMinutes: 22,
    earlyLeaveMinutes: 0,
    workMinutes: 517,
    note: null,
    kioskId: null,
    locationId: null,
    kiosk: null,
    location: null,
    user: { id: 'u1', name: 'Budi', employeeCode: 'EMP001', department: null },
    shiftSnapshot: {
      name: 'Reguler',
      startTime: '08:00',
      endTime: '17:00',
      lateToleranceMinutes: 15,
    },
    scannedBy: null,
    leaveRequest: null,
    scanLogs: [],
    corrections: [],
    createdAt: '2026-10-22T01:22:37.000Z',
    updatedAt: '2026-10-22T10:00:00.000Z',
    ...overrides,
  };
}

const values = (detail: AttendanceDetail, patch: Partial<CorrectionFormValues> = {}) => ({
  ...correctionDefaults(detail),
  reason: 'Sesuai rekaman CCTV lobi utama',
  ...patch,
});

describe('previewCorrection', () => {
  it('form awal → tidak ada perubahan & payload kosong (detik jam lama tidak hilang)', () => {
    const detail = makeDetail();
    const preview = previewCorrection(detail, values(detail), NOW);
    expect(preview.changed).toBe(false);
    expect(preview.payload).toEqual({});
    expect(preview.checkInAt?.toISOString()).toBe(detail.checkInAt);
  });

  it('jam masuk diubah ke dalam toleransi + status otomatis → PRESENT, terlambat 0', () => {
    const detail = makeDetail();
    const preview = previewCorrection(detail, values(detail, { checkIn: '07:55' }), NOW);
    expect(preview).toMatchObject({
      changed: true,
      status: 'PRESENT',
      metrics: { lateMinutes: 0, earlyLeaveMinutes: 0, workMinutes: 545 },
      payload: { checkInAt: '2026-10-22T07:55:00+07:00' },
    });
    expect(preview.payload).not.toHaveProperty('status');
  });

  it('jam masuk melewati toleransi → LATE dihitung dari jam mulai shift', () => {
    const detail = makeDetail({ status: 'PRESENT', lateMinutes: 0 });
    const preview = previewCorrection(detail, values(detail, { checkIn: '08:16' }), NOW);
    expect(preview.status).toBe('LATE');
    expect(preview.metrics?.lateMinutes).toBe(16);
  });

  it('status PRESENT eksplisit memaafkan keterlambatan', () => {
    const detail = makeDetail();
    const preview = previewCorrection(detail, values(detail, { status: 'PRESENT' }), NOW);
    expect(preview.payload).toEqual({ status: 'PRESENT' });
    expect(preview.metrics).toEqual({ lateMinutes: 0, earlyLeaveMinutes: 0, workMinutes: 517 });
  });

  it('status lama dipertahankan eksplisit saat jam masuk berubah → status ikut dikirim', () => {
    const detail = makeDetail();
    const preview = previewCorrection(
      detail,
      values(detail, { status: 'LATE', checkIn: '07:50' }),
      NOW,
    );
    expect(preview.payload).toMatchObject({ status: 'LATE' });
    expect(preview.metrics?.lateMinutes).toBe(0);
  });

  it('pulang lebih awal & lama kerja dihitung ulang', () => {
    const detail = makeDetail();
    const preview = previewCorrection(detail, values(detail, { checkOut: '16:30' }), NOW);
    expect(preview.metrics).toEqual({ lateMinutes: 22, earlyLeaveMinutes: 30, workMinutes: 487 });
  });

  it('status non-hadir dengan jam → error; jam dikosongkan → valid & metrik 0', () => {
    const detail = makeDetail();
    expect(previewCorrection(detail, values(detail, { status: 'SICK' }), NOW).errors).toEqual({
      checkIn: 'Status Sakit tidak boleh memiliki jam masuk/pulang',
    });
    const cleared = previewCorrection(
      detail,
      values(detail, { status: 'SICK', checkIn: '', checkOut: '' }),
      NOW,
    );
    expect(cleared.errors).toEqual({});
    expect(cleared.payload).toEqual({ checkInAt: null, checkOutAt: null, status: 'SICK' });
    expect(cleared.metrics).toEqual({ lateMinutes: 0, earlyLeaveMinutes: 0, workMinutes: 0 });
  });

  it('jam pulang sebelum jam masuk / di masa depan → error per field', () => {
    const detail = makeDetail();
    expect(
      previewCorrection(detail, values(detail, { checkOut: '08:00' }), NOW).errors.checkOut,
    ).toBe('Jam pulang harus setelah jam masuk');
    expect(
      previewCorrection(detail, values(detail, { checkOut: '20:30' }), NOW).errors.checkOut,
    ).toBe('Waktu tidak boleh di masa depan');
  });

  it('tanpa shiftSnapshot → status otomatis & metrik dihitung server', () => {
    const detail = makeDetail({ shiftSnapshot: null });
    const preview = previewCorrection(detail, values(detail, { checkIn: '07:55' }), NOW);
    expect(preview.statusKnown).toBe(false);
    expect(preview.metrics).toBeNull();
    expect(preview.changed).toBe(true);
  });
});

describe('correctionFormSchema', () => {
  const detail = makeDetail();
  const schema = correctionFormSchema(detail, () => NOW);

  it('alasan kosong → tidak bisa disimpan', () => {
    const result = schema.safeParse(values(detail, { checkIn: '07:55', reason: '   ' }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.find((issue) => issue.path[0] === 'reason')?.message).toBe(
      'Alasan koreksi wajib diisi',
    );
  });

  it('alasan < 10 karakter ditolak; ≥ 10 karakter + ada perubahan → valid', () => {
    expect(schema.safeParse(values(detail, { checkIn: '07:55', reason: 'CCTV' })).success).toBe(
      false,
    );
    expect(schema.safeParse(values(detail, { checkIn: '07:55' })).success).toBe(true);
  });

  it('tanpa perubahan → error root', () => {
    const result = schema.safeParse(values(detail, { status: AUTO_STATUS }));
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['root']);
  });
});

describe('absensi manual', () => {
  const schema = manualFormSchema(() => NOW);
  const base = {
    userId: 'u1',
    date: '2026-10-21',
    status: 'LATE' as const,
    checkIn: '08:20',
    checkOut: '17:00',
    reason: 'Lupa absen, dikonfirmasi atasan',
  };

  it('LATE tanpa jam masuk ditolak; payload memakai ISO berzona', () => {
    expect(schema.safeParse({ ...base, checkIn: '' }).success).toBe(false);
    expect(schema.safeParse(base).success).toBe(true);
    expect(toManualInput(base)).toEqual({
      userId: 'u1',
      date: '2026-10-21',
      status: 'LATE',
      reason: 'Lupa absen, dikonfirmasi atasan',
      checkInAt: '2026-10-21T08:20:00+07:00',
      checkOutAt: '2026-10-21T17:00:00+07:00',
    });
  });

  it('status Alpa tanpa jam → payload tanpa checkInAt/checkOutAt', () => {
    const input = toManualInput({ ...base, status: 'ABSENT', checkIn: '', checkOut: '' });
    expect(input).not.toHaveProperty('checkInAt');
    expect(input).not.toHaveProperty('checkOutAt');
  });

  it('toZonedIso memakai offset zona aplikasi', () => {
    expect(toZonedIso('2026-10-21', '00:05')).toBe('2026-10-21T00:05:00+07:00');
  });
});
