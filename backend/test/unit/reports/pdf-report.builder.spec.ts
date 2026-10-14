import type { Table } from 'pdfmake/interfaces';
import { setAppTimezone } from '@/common/utils/date.util';
import {
  DAILY_WIDTHS,
  MONTHLY_WIDTHS,
  PdfReportBuilder,
  PERSONAL_WIDTHS,
  printableWidth,
  tableWidth,
} from '@/modules/reports/pdf-report.builder';
import {
  CODE_LEGEND,
  dayLong,
  hoursMinutes,
  monthLabel,
  STATUS_CODES,
} from '@/modules/reports/report-format';
import type { MonthContext, PersonalReport } from '@/modules/reports/reports.service';

const context: MonthContext = {
  month: '2026-10',
  range: { from: '2026-10-01', to: '2026-10-31' },
  today: '2026-10-31',
  holidays: new Map(),
  companyName: 'PT Uji Coba',
  departmentName: null,
};

const summary = {
  present: 20,
  late: 2,
  absent: 0,
  sick: 0,
  permit: 0,
  leave: 0,
  totalLateMinutes: 30,
  totalWorkMinutes: 10_000,
  workingDays: 22,
  attendanceRate: 100,
};

function personalReport(): PersonalReport {
  const days = Array.from({ length: 31 }, (_, index) => ({
    date: `2026-10-${String(index + 1).padStart(2, '0')}`,
    status: 'Hadir',
    checkIn: '07:55',
    checkOut: '17:05',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    workMinutes: 550,
  }));
  return {
    context,
    employee: {
      employeeCode: 'EMP001',
      name: 'Budi Santoso',
      department: 'Teknologi Informasi',
      position: 'Engineer',
      shift: 'Reguler',
    },
    summary,
    days,
  };
}

const tableOf = (content: unknown[]): Table => {
  const node = content.find(
    (item) => typeof item === 'object' && item !== null && 'table' in item,
  ) as { table: Table } | undefined;
  if (!node) throw new Error('Tabel tidak ditemukan');
  return node.table;
};

describe('PdfReportBuilder', () => {
  const builder = new PdfReportBuilder();

  beforeAll(() => {
    setAppTimezone('Asia/Jakarta');
    builder.onModuleInit();
  });

  it.each([
    ['rekap bulanan (landscape)', MONTHLY_WIDTHS, 'landscape'],
    ['harian (landscape)', DAILY_WIDTHS, 'landscape'],
    ['pribadi 31 hari (portrait)', PERSONAL_WIDTHS, 'portrait'],
  ] as const)('tabel %s muat di area cetak A4 (tidak terpotong)', (_label, widths, orientation) => {
    expect(tableWidth([...widths])).toBeLessThanOrEqual(printableWidth(orientation));
  });

  it('laporan pribadi: 31 hari lengkap, header diulang tiap halaman, baris tidak terbelah', () => {
    const doc = builder.personal(personalReport(), '31/10/2026 17:00');
    const table = tableOf(doc.content as unknown[]);
    expect(doc.pageSize).toBe('A4');
    expect(table.body).toHaveLength(1 + 31);
    expect(table.headerRows).toBe(1);
    expect(table.dontBreakRows).toBe(true);
    expect(table.widths).toEqual(PERSONAL_WIDTHS);
  });

  it('rekap bulanan: A4 landscape, kop instansi, footer nomor halaman & tanggal cetak', () => {
    const doc = builder.monthly(
      context,
      [{ userId: 'u1', employeeCode: 'EMP001', name: 'Budi', department: null, ...summary }],
      '31/10/2026 17:00',
    );
    expect(doc.pageOrientation).toBe('landscape');
    expect(JSON.stringify(doc.content)).toContain('PT Uji Coba');
    expect(JSON.stringify(doc.content)).toContain('Periode: Oktober 2026');

    const footer = (doc.footer as (page: number, count: number) => unknown)(2, 5);
    expect(JSON.stringify(footer)).toContain('Halaman 2 dari 5');
    expect(JSON.stringify(footer)).toContain('Dicetak: 31/10/2026 17:00');
  });

  it('menghasilkan file PDF valid dengan font standar', async () => {
    const buffer = await builder.render(builder.personal(personalReport(), '31/10/2026 17:00'));
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('report-format', () => {
  beforeAll(() => setAppTimezone('Asia/Jakarta'));

  it('label bulan & hari dalam Bahasa Indonesia', () => {
    expect(monthLabel('2026-10')).toBe('Oktober 2026');
    expect(dayLong('2026-10-19')).toBe('Senin');
  });

  it('format jam kerja H:MM', () => {
    expect(hoursMinutes(553)).toBe('9:13');
    expect(hoursMinutes(60)).toBe('1:00');
  });

  it('setiap status absensi punya kode & legenda', () => {
    const legendCodes = CODE_LEGEND.map(([code]) => code);
    for (const code of Object.values(STATUS_CODES)) expect(legendCodes).toContain(code);
    expect(legendCodes).toEqual(expect.arrayContaining(['L', '-']));
  });
});
