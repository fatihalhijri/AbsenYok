import { describe, expect, it } from 'vitest';
import { MAX_BULK_HOLIDAYS, parseBulkHolidays } from './holiday-bulk';
import { checkInOpensAt, describeWorkDays, shiftPreview, toWorkDaysString } from './shift-utils';

describe('shift-utils', () => {
  it('describeWorkDays meringkas rentang', () => {
    expect(describeWorkDays([1, 2, 3, 4, 5])).toBe('Senin–Jumat');
    expect(describeWorkDays([5, 1, 3])).toBe('Senin, Rabu, Jumat');
    expect(describeWorkDays([1, 2, 3, 5, 6])).toBe('Senin–Rabu, Jumat, Sabtu');
    expect(describeWorkDays([1, 2, 3, 4, 5, 6, 7])).toBe('Setiap hari');
    expect(describeWorkDays([])).toBe('Tanpa hari kerja');
  });

  it('toWorkDaysString terurut & unik (format backend)', () => {
    expect(toWorkDaysString([5, 1, 3, 1])).toBe('1,3,5');
  });

  it('preview sesuai contoh prompt', () => {
    expect(
      shiftPreview({
        startTime: '08:00',
        endTime: '17:00',
        lateToleranceMinutes: 15,
        checkInOpenMinutes: 60,
        workDays: [1, 2, 3, 4, 5],
      }),
    ).toBe('Senin–Jumat, 08:00–17:00, toleransi 15 menit, absen dibuka 07:00');
  });

  it('jam buka absen sebelum 00:00 → null', () => {
    expect(checkInOpensAt('01:00', 90)).toBeNull();
    expect(checkInOpensAt('07:30', 45)).toBe('06:45');
  });
});

describe('parseBulkHolidays', () => {
  it('mengurai baris valid, mengabaikan kosong & komentar', () => {
    const result = parseBulkHolidays(
      '# daftar\n2026-12-25;Hari Raya Natal\n\n 2026-01-01 ; Tahun Baru Masehi ',
    );
    expect(result).toEqual({
      items: [
        { date: '2026-12-25', name: 'Hari Raya Natal' },
        { date: '2026-01-01', name: 'Tahun Baru Masehi' },
      ],
      errors: [],
    });
  });

  it('melaporkan format, tanggal mustahil, nama pendek & tanggal ganda per baris', () => {
    const result = parseBulkHolidays(
      [
        '2026-12-25 Natal',
        '2026-02-30;Tidak ada',
        '2026-03-01;X',
        '2026-05-01;Hari Buruh',
        '2026-05-01;Lagi',
      ].join('\n'),
    );
    expect(result.items).toEqual([{ date: '2026-05-01', name: 'Hari Buruh' }]);
    expect(result.errors.map((error) => error.line)).toEqual([1, 2, 3, 5]);
    expect(result.errors[3]?.message).toMatch(/baris 4/);
  });

  it(`lebih dari ${MAX_BULK_HOLIDAYS} tanggal ditolak`, () => {
    const lines = Array.from({ length: MAX_BULK_HOLIDAYS + 1 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
      return `${date};Libur ${index + 1}`;
    });
    expect(parseBulkHolidays(lines.join('\n')).errors).toEqual([
      { line: 0, message: `Maksimal ${MAX_BULK_HOLIDAYS} tanggal sekali kirim` },
    ]);
  });
});
