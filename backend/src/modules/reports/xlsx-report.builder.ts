import type { Writable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { eachDate } from '@/common/utils/date-range.util';
import { CODE_LEGEND, dateLabel, dayShort, monthLabel } from './report-format';
import type { DailyContext, DailyReportRow, EmployeeMonth, MonthContext } from './reports.service';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type Batches<T> = () => AsyncIterable<T[]>;

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9E1F2' },
};
const THIN: ExcelJS.Border = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/** Warna sel kode di "Detail Harian". */
const CODE_FILLS: Record<string, string> = {
  H: 'FFC6EFCE',
  T: 'FFFFEB9C',
  A: 'FFFFC7CE',
  S: 'FFDDEBF7',
  I: 'FFDDEBF7',
  C: 'FFDDEBF7',
  L: 'FFE7E6E6',
};

const REKAP_COLUMNS = [
  { key: 'no', header: 'No', width: 5 },
  { key: 'employeeCode', header: 'NIP', width: 12 },
  { key: 'name', header: 'Nama', width: 24 },
  { key: 'department', header: 'Departemen', width: 22 },
  { key: 'workingDays', header: 'Hari Kerja', width: 10 },
  { key: 'present', header: 'Hadir', width: 8 },
  { key: 'late', header: 'Terlambat', width: 10 },
  { key: 'totalLateMinutes', header: 'Total Menit Terlambat', width: 12 },
  { key: 'absent', header: 'Alpa', width: 8 },
  { key: 'sick', header: 'Sakit', width: 8 },
  { key: 'permit', header: 'Izin', width: 8 },
  { key: 'leave', header: 'Cuti', width: 8 },
  { key: 'workHours', header: 'Total Jam Kerja', width: 11 },
  { key: 'attendanceRate', header: 'Kehadiran', width: 11 },
] as const;

const DAILY_COLUMNS = [
  { key: 'no', header: 'No', width: 5 },
  { key: 'employeeCode', header: 'NIP', width: 12 },
  { key: 'name', header: 'Nama', width: 24 },
  { key: 'department', header: 'Departemen', width: 22 },
  { key: 'status', header: 'Status', width: 14 },
  { key: 'checkIn', header: 'Masuk', width: 8 },
  { key: 'checkOut', header: 'Pulang', width: 8 },
  { key: 'lateMinutes', header: 'Terlambat (mnt)', width: 11 },
  { key: 'earlyLeaveMinutes', header: 'Pulang Cepat (mnt)', width: 12 },
  { key: 'workHours', header: 'Jam Kerja', width: 10 },
  { key: 'method', header: 'Metode', width: 12 },
  { key: 'kiosk', header: 'Kiosk', width: 16 },
] as const;

/**
 * Laporan XLSX dengan writer streaming exceljs: baris ditulis & di-commit per batch sehingga
 * data besar tidak dimuat ke memori sekaligus. Konsekuensi: lebar kolom ditentukan sebelum
 * baris ditulis (dari header & panjang nama terpanjang).
 */
@Injectable()
export class XlsxReportBuilder {
  async writeMonthly(
    output: Writable,
    ctx: MonthContext,
    batches: Batches<EmployeeMonth>,
    longestName: number,
    printedAt: string,
  ): Promise<void> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output, useStyles: true });
    workbook.creator = ctx.companyName;
    const nameWidth = Math.min(45, Math.max(18, longestName + 2));
    const period = `Periode: ${monthLabel(ctx.month)}${ctx.departmentName ? ` · Departemen: ${ctx.departmentName}` : ''}`;

    // ------------------------------- Rekap -------------------------------
    const rekap = workbook.addWorksheet('Rekap', {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      },
    });
    rekap.columns = REKAP_COLUMNS.map((column) => ({
      key: column.key,
      width: column.key === 'name' ? nameWidth : column.width,
    }));
    this.writeTitle(
      rekap,
      REKAP_COLUMNS.length,
      `REKAP ABSENSI KARYAWAN — ${ctx.companyName}`,
      period,
      printedAt,
    );
    this.writeHeader(rekap.addRow(REKAP_COLUMNS.map((column) => column.header))).commit();
    rekap.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: REKAP_COLUMNS.length },
    };

    let no = 0;
    for await (const batch of batches()) {
      for (const { row } of batch) {
        no += 1;
        const excelRow = rekap.addRow({
          no,
          employeeCode: row.employeeCode,
          name: row.name,
          department: row.department ?? '',
          workingDays: row.workingDays,
          present: row.present,
          late: row.late,
          totalLateMinutes: row.totalLateMinutes,
          absent: row.absent,
          sick: row.sick,
          permit: row.permit,
          leave: row.leave,
          workHours: Math.round((row.totalWorkMinutes / 60) * 10) / 10,
          attendanceRate: row.attendanceRate / 100,
        });
        excelRow.eachCell({ includeEmpty: true }, (cell) => (cell.border = BORDER));
        excelRow.getCell('workHours').numFmt = '0.0';
        excelRow.getCell('attendanceRate').numFmt = '0.0%';
        excelRow.commit();
      }
    }
    rekap.commit();

    // --------------------------- Detail Harian ---------------------------
    const dates = eachDate(ctx.range);
    const detail = workbook.addWorksheet('Detail Harian', {
      views: [{ state: 'frozen', xSplit: 2, ySplit: 5 }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      },
    });
    detail.columns = [
      { key: 'employeeCode', width: 12 },
      { key: 'name', width: nameWidth },
      ...dates.map((date) => ({ key: date, width: 4.5 })),
    ];
    const totalColumns = dates.length + 2;
    this.writeTitle(
      detail,
      totalColumns,
      `DETAIL ABSENSI HARIAN — ${ctx.companyName}`,
      period,
      printedAt,
    );
    this.writeHeader(
      detail.addRow(['NIP', 'Nama', ...dates.map((date) => Number(date.slice(8)))]),
    ).commit();
    const dayRow = detail.addRow(['', '', ...dates.map(dayShort)]);
    this.writeHeader(dayRow);
    dates.forEach((date, index) => {
      if (ctx.holidays.has(date))
        dayRow.getCell(index + 3).font = { bold: true, color: { argb: 'FFC00000' } };
    });
    dayRow.commit();

    for await (const batch of batches()) {
      for (const { row, codes } of batch) {
        const excelRow = detail.addRow([
          row.employeeCode,
          row.name,
          ...dates.map((date) => codes[date] ?? ''),
        ]);
        excelRow.eachCell({ includeEmpty: true }, (cell, column) => {
          cell.border = BORDER;
          if (column <= 2) return;
          cell.alignment = { horizontal: 'center' };
          const fill = CODE_FILLS[cell.text];
          if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        });
        excelRow.commit();
      }
    }

    detail.addRow([]).commit();
    const legendTitle = detail.addRow(['Keterangan:']);
    legendTitle.font = { bold: true };
    legendTitle.commit();
    for (const [code, label] of CODE_LEGEND) {
      const legendRow = detail.addRow([code, label]);
      legendRow.getCell(1).alignment = { horizontal: 'center' };
      const fill = CODE_FILLS[code];
      if (fill)
        legendRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      legendRow.commit();
    }
    detail.commit();

    await workbook.commit();
  }

  async writeDaily(
    output: Writable,
    ctx: DailyContext,
    batches: Batches<DailyReportRow>,
    longestName: number,
    printedAt: string,
  ): Promise<void> {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: output, useStyles: true });
    workbook.creator = ctx.companyName;
    const sheet = workbook.addWorksheet('Harian', {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      },
    });
    sheet.columns = DAILY_COLUMNS.map((column) => ({
      key: column.key,
      width: column.key === 'name' ? Math.min(45, Math.max(18, longestName + 2)) : column.width,
    }));
    const subtitle = `Tanggal: ${dateLabel(ctx.date)}${ctx.holidayName ? ` (Libur: ${ctx.holidayName})` : ''}`;
    this.writeTitle(
      sheet,
      DAILY_COLUMNS.length,
      `ABSENSI HARIAN — ${ctx.companyName}`,
      subtitle,
      printedAt,
    );
    this.writeHeader(sheet.addRow(DAILY_COLUMNS.map((column) => column.header))).commit();
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: DAILY_COLUMNS.length },
    };

    let no = 0;
    for await (const batch of batches()) {
      for (const row of batch) {
        no += 1;
        const excelRow = sheet.addRow({
          no,
          ...row,
          department: row.department ?? '',
          workHours: Math.round((row.workMinutes / 60) * 10) / 10,
        });
        excelRow.eachCell({ includeEmpty: true }, (cell) => (cell.border = BORDER));
        excelRow.getCell('workHours').numFmt = '0.0';
        excelRow.commit();
      }
    }
    sheet.commit();
    await workbook.commit();
  }

  private writeTitle(
    sheet: ExcelJS.Worksheet,
    columns: number,
    title: string,
    subtitle: string,
    printedAt: string,
  ): void {
    const lines: [string, Partial<ExcelJS.Font>][] = [
      [title, { bold: true, size: 14 }],
      [subtitle, { size: 11 }],
      [`Dicetak: ${printedAt}`, { size: 9, italic: true, color: { argb: 'FF595959' } }],
    ];
    lines.forEach(([text, font], index) => {
      const row = sheet.addRow([text]);
      row.font = font;
      sheet.mergeCells(index + 1, 1, index + 1, columns);
      row.commit();
    });
  }

  /** Gaya header (belum di-commit agar pemanggil bisa menambah gaya). */
  private writeHeader(row: ExcelJS.Row): ExcelJS.Row {
    row.font = { bold: true };
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = HEADER_FILL;
      cell.border = BORDER;
    });
    return row;
  }
}
