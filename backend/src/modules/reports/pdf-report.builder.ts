import { Injectable, type OnModuleInit } from '@nestjs/common';
import pdfmake from 'pdfmake';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { dateLabel, dayLong, hoursMinutes, monthLabel } from './report-format';
import type {
  DailyReportRow,
  MonthlyReportRow,
  MonthContext,
  DailyContext,
  PersonalReport,
} from './reports.service';

/** A4 dalam point (1/72 inci). */
export const A4 = { width: 595.28, height: 841.89 };
export const PAGE_MARGIN = 30;
/** Padding kiri+kanan sel tabel (layout `compact`). */
export const CELL_PADDING = 3;

/** Lebar kolom tabel rekap bulanan (A4 landscape). */
export const MONTHLY_WIDTHS = [18, 48, 120, 82, 36, 32, 40, 44, 30, 30, 30, 30, 44, 46];
/** Lebar kolom tabel harian (A4 landscape). */
export const DAILY_WIDTHS = [18, 48, 120, 82, 62, 34, 34, 44, 50, 40, 52, 70];
/** Lebar kolom tabel laporan pribadi (A4 portrait, 28–31 baris). */
export const PERSONAL_WIDTHS = [64, 46, 120, 40, 40, 50, 54, 48];

/** Total lebar tabel termasuk padding & garis — wajib ≤ lebar area cetak agar tidak terpotong. */
export function tableWidth(widths: number[]): number {
  return (
    widths.reduce((sum, width) => sum + width + CELL_PADDING * 2, 0) + (widths.length + 1) * 0.5
  );
}

export const printableWidth = (orientation: 'portrait' | 'landscape') =>
  (orientation === 'landscape' ? A4.height : A4.width) - PAGE_MARGIN * 2;

const FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const STANDARD_FONTS = new Set(Object.values(FONTS.Helvetica));

const COMPACT_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#BFBFBF',
  vLineColor: () => '#BFBFBF',
  paddingLeft: () => CELL_PADDING,
  paddingRight: () => CELL_PADDING,
  paddingTop: () => 2,
  paddingBottom: () => 2,
  fillColor: (rowIndex: number) =>
    rowIndex === 0 ? '#D9E1F2' : rowIndex % 2 === 0 ? '#F7F9FC' : null,
};

const header = (text: string): TableCell => ({ text, bold: true, alignment: 'center' });
const right = (text: string): TableCell => ({ text, alignment: 'right' });
const center = (text: string): TableCell => ({ text, alignment: 'center' });
const num = (value: number): TableCell => right(String(value));

/**
 * Laporan PDF (pdfmake, font standar PDF tanpa file font). Akses URL & file lokal dari
 * definisi dokumen dimatikan agar input tidak bisa memuat sumber eksternal.
 */
@Injectable()
export class PdfReportBuilder implements OnModuleInit {
  onModuleInit(): void {
    pdfmake.setFonts(FONTS);
    pdfmake.setUrlAccessPolicy(() => false);
    // Hanya nama font standar PDF (bukan file) yang boleh "dibaca"; akses file lain ditolak.
    pdfmake.setLocalAccessPolicy((path) => STANDARD_FONTS.has(path));
  }

  render(definition: TDocumentDefinitions): Promise<Buffer> {
    return pdfmake.createPdf(definition).getBuffer();
  }

  monthly(ctx: MonthContext, rows: MonthlyReportRow[], printedAt: string): TDocumentDefinitions {
    const body: TableCell[][] = [
      [
        'No',
        'NIP',
        'Nama',
        'Departemen',
        'Hari Kerja',
        'Hadir',
        'Terlambat',
        'Menit Terlambat',
        'Alpa',
        'Sakit',
        'Izin',
        'Cuti',
        'Jam Kerja',
        'Kehadiran',
      ].map(header),
      ...rows.map((row, index) => [
        num(index + 1),
        row.employeeCode,
        row.name,
        row.department ?? '-',
        num(row.workingDays),
        num(row.present),
        num(row.late),
        num(row.totalLateMinutes),
        num(row.absent),
        num(row.sick),
        num(row.permit),
        num(row.leave),
        right(hoursMinutes(row.totalWorkMinutes)),
        right(`${row.attendanceRate.toFixed(1)}%`),
      ]),
    ];

    const subtitle = `Periode: ${monthLabel(ctx.month)}${ctx.departmentName ? `   |   Departemen: ${ctx.departmentName}` : ''}`;
    return this.document(
      'landscape',
      ctx.companyName,
      'REKAP ABSENSI KARYAWAN',
      subtitle,
      printedAt,
      [
        rows.length === 0
          ? { text: 'Tidak ada data karyawan.', italics: true }
          : this.table(MONTHLY_WIDTHS, body),
      ],
    );
  }

  daily(ctx: DailyContext, rows: DailyReportRow[], printedAt: string): TDocumentDefinitions {
    const body: TableCell[][] = [
      [
        'No',
        'NIP',
        'Nama',
        'Departemen',
        'Status',
        'Masuk',
        'Pulang',
        'Terlambat',
        'Pulang Cepat',
        'Jam Kerja',
        'Metode',
        'Kiosk',
      ].map(header),
      ...rows.map((row, index) => [
        num(index + 1),
        row.employeeCode,
        row.name,
        row.department ?? '-',
        row.status,
        center(row.checkIn),
        center(row.checkOut),
        row.checkIn ? num(row.lateMinutes) : '',
        row.checkIn ? num(row.earlyLeaveMinutes) : '',
        right(row.workMinutes ? hoursMinutes(row.workMinutes) : ''),
        row.method,
        row.kiosk,
      ]),
    ];
    const subtitle = `Tanggal: ${dayLong(ctx.date)}, ${dateLabel(ctx.date)}${ctx.holidayName ? ` (Libur: ${ctx.holidayName})` : ''}`;
    return this.document('landscape', ctx.companyName, 'ABSENSI HARIAN', subtitle, printedAt, [
      rows.length === 0
        ? { text: 'Tidak ada data.', italics: true }
        : this.table(DAILY_WIDTHS, body),
    ]);
  }

  personal(report: PersonalReport, printedAt: string): TDocumentDefinitions {
    const { employee, summary, days, context } = report;
    const info: Content = {
      columns: [
        {
          width: '*',
          stack: [
            { text: `${employee.name} (${employee.employeeCode})`, bold: true, fontSize: 11 },
            `Departemen: ${employee.department ?? '-'}   |   Jabatan: ${employee.position ?? '-'}`,
            `Shift: ${employee.shift ?? '-'}`,
          ],
        },
        {
          width: 'auto',
          table: {
            body: [
              ['Hari kerja', num(summary.workingDays), 'Hadir', num(summary.present)],
              ['Terlambat', num(summary.late), 'Menit terlambat', num(summary.totalLateMinutes)],
              [
                'Alpa',
                num(summary.absent),
                'Sakit / Izin / Cuti',
                `${summary.sick} / ${summary.permit} / ${summary.leave}`,
              ],
              [
                'Jam kerja',
                hoursMinutes(summary.totalWorkMinutes),
                'Kehadiran',
                `${summary.attendanceRate.toFixed(1)}%`,
              ],
            ],
          },
          layout: COMPACT_LAYOUT,
        },
      ],
      columnGap: 12,
      margin: [0, 0, 0, 10],
    };

    const body: TableCell[][] = [
      [
        'Tanggal',
        'Hari',
        'Status',
        'Masuk',
        'Pulang',
        'Terlambat',
        'Pulang Cepat',
        'Jam Kerja',
      ].map(header),
      ...days.map((day) => [
        day.date,
        dayLong(day.date),
        day.status,
        center(day.checkIn),
        center(day.checkOut),
        // Menit hanya ditampilkan untuk hari yang benar-benar ada jam masuknya.
        day.checkIn ? num(day.lateMinutes) : '',
        day.checkIn ? num(day.earlyLeaveMinutes) : '',
        right(day.workMinutes ? hoursMinutes(day.workMinutes) : ''),
      ]),
    ];

    return this.document(
      'portrait',
      context.companyName,
      'LAPORAN KEHADIRAN KARYAWAN',
      `Periode: ${monthLabel(context.month)}`,
      printedAt,
      [info, this.table(PERSONAL_WIDTHS, body)],
    );
  }

  private table(widths: number[], body: TableCell[][]): Content {
    // headerRows: header diulang di setiap halaman; dontBreakRows: baris tidak terbelah.
    return { table: { headerRows: 1, dontBreakRows: true, widths, body }, layout: COMPACT_LAYOUT };
  }

  private document(
    orientation: 'portrait' | 'landscape',
    companyName: string,
    title: string,
    subtitle: string,
    printedAt: string,
    content: Content[],
  ): TDocumentDefinitions {
    return {
      pageSize: 'A4',
      pageOrientation: orientation,
      pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, 40],
      info: { title: `${title} - ${subtitle}`, author: companyName, creator: 'AbsenYok' },
      defaultStyle: { font: 'Helvetica', fontSize: 8 },
      content: [
        { text: companyName, bold: true, fontSize: 14 },
        { text: title, bold: true, fontSize: 11, margin: [0, 2, 0, 0] },
        { text: subtitle, fontSize: 9, margin: [0, 2, 0, 0] },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 4,
              x2: printableWidth(orientation),
              y2: 4,
              lineWidth: 1,
              lineColor: '#404040',
            },
          ],
          margin: [0, 0, 0, 10],
        },
        ...content,
      ],
      footer: (currentPage: number, pageCount: number): Content => ({
        columns: [
          { text: `Dicetak: ${printedAt}`, alignment: 'left' },
          { text: `Halaman ${currentPage} dari ${pageCount}`, alignment: 'right' },
        ],
        margin: [PAGE_MARGIN, 10, PAGE_MARGIN, 0],
        fontSize: 8,
        color: '#595959',
      }),
    };
  }
}
