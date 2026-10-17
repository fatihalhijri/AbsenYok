import { describe, expect, it } from 'vitest';
import { auditDetails, formatAuditValue } from './diff';

describe('auditDetails', () => {
  it('koreksi absensi: field berubah di atas, waktu & status mudah dibaca, alasan terpisah', () => {
    const details = auditDetails({
      userId: 'u1',
      date: '2026-10-22',
      before: {
        status: 'LATE',
        checkInAt: '2026-10-22T01:22:00.000Z',
        lateMinutes: 22,
        note: null,
      },
      after: {
        status: 'PRESENT',
        checkInAt: '2026-10-22T00:55:00.000Z',
        lateMinutes: 0,
        note: null,
      },
      reason: 'Sesuai rekaman CCTV lobi utama',
    });
    expect(details.reason).toBe('Sesuai rekaman CCTV lobi utama');
    expect(details.hasBefore).toBe(true);
    expect(details.diff.map((row) => [row.label, row.before, row.after, row.changed])).toEqual([
      ['Status', 'Terlambat', 'Hadir', true],
      ['Jam masuk', '22 Okt 2026 08:22', '22 Okt 2026 07:55', true],
      ['Terlambat (menit)', '22', '0', true],
      ['Catatan', '—', '—', false],
    ]);
    expect(details.info).toEqual([
      { key: 'userId', label: 'ID karyawan', value: 'u1' },
      { key: 'date', label: 'Tanggal', value: '22 Okt 2026' },
    ]);
  });

  it('data baru (hanya after) → kolom sebelum "—"', () => {
    const details = auditDetails({
      after: { status: 'ABSENT' },
      reason: 'Tidak hadir tanpa kabar',
    });
    expect(details.hasBefore).toBe(false);
    expect(details.diff).toEqual([
      { key: 'status', label: 'Status', before: '—', after: 'Alpa', changed: true },
    ]);
  });

  it('pengaturan: before/after nilai tunggal', () => {
    expect(auditDetails({ before: 30, after: 45 }).diff).toEqual([
      { key: 'value', label: 'Nilai', before: '30', after: '45', changed: true },
    ]);
    expect(auditDetails({ before: false, after: true }).diff[0]).toMatchObject({
      before: 'Tidak',
      after: 'Ya',
    });
  });

  it('tanpa diff: info + kode alasan diterjemahkan; metadata null aman', () => {
    expect(auditDetails({ email: 'x@y.id', reason: 'UNKNOWN_EMAIL' })).toEqual({
      diff: [],
      hasBefore: false,
      info: [{ key: 'email', label: 'Email', value: 'x@y.id' }],
      reason: 'Email tidak terdaftar',
    });
    expect(auditDetails(null)).toEqual({ diff: [], hasBefore: false, info: [], reason: null });
  });
});

describe('formatAuditValue', () => {
  it('enum metode & tipe izin, objek → JSON', () => {
    expect(formatAuditValue('checkInMethod', 'PERSONAL_QR')).toBe('QR personal');
    expect(formatAuditValue('type', 'ANNUAL')).toBe('Cuti tahunan');
    expect(formatAuditValue('extra', { a: 1 })).toBe('{"a":1}');
  });
});
