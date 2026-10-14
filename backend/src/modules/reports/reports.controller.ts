import { PassThrough } from 'node:stream';
import { Controller, Get, HttpStatus, Logger, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@/common/constants/roles';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { ApiDataResponse, ApiStandardErrors } from '@/common/swagger/api-response.decorators';
import {
  MonthlyExportQueryDto,
  DailyExportQueryDto,
  MonthlyReportQueryDto,
  MyExportQueryDto,
} from './dto/report.dto';
import { MonthlyReportEntity } from './entities/report.entity';
import { PdfReportBuilder } from './pdf-report.builder';
import { safeFilePart } from './report-format';
import { type MonthlyReportRow, ReportsService } from './reports.service';
import { XLSX_MIME, XlsxReportBuilder } from './xlsx-report.builder';

const PDF_MIME = 'application/pdf';

const FILE_RESPONSE = {
  status: HttpStatus.OK,
  description: 'File laporan (Content-Disposition: attachment)',
  content: {
    [XLSX_MIME]: { schema: { type: 'string', format: 'binary' } },
    [PDF_MIME]: { schema: { type: 'string', format: 'binary' } },
  },
} as const;

const attachment = (filename: string) => `attachment; filename="${filename}"`;

@ApiTags('Reports')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(
    private readonly reports: ReportsService,
    private readonly xlsx: XlsxReportBuilder,
    private readonly pdf: PdfReportBuilder,
  ) {}

  @Get('monthly')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Rekap bulanan per karyawan (JSON)' })
  @ApiDataResponse(MonthlyReportEntity)
  async monthly(@Query() query: MonthlyReportQueryDto): Promise<{
    month: string;
    companyName: string;
    departmentName: string | null;
    items: MonthlyReportRow[];
  }> {
    const { context, rows } = await this.reports.monthlyRows(query.month, query.departmentId);
    return {
      month: context.month,
      companyName: context.companyName,
      departmentName: context.departmentName,
      items: rows,
    };
  }

  @Get('monthly/export')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({
    summary: 'Export rekap bulanan (XLSX 2 sheet / PDF A4 landscape)',
    description:
      'XLSX: sheet "Rekap" & "Detail Harian" (kode H/T/A/S/I/C/L), ditulis streaming per batch.',
  })
  @ApiProduces(XLSX_MIME, PDF_MIME)
  @ApiResponse(FILE_RESPONSE)
  async monthlyExport(@Query() query: MonthlyExportQueryDto): Promise<StreamableFile> {
    const context = await this.reports.monthContext(query.month, query.departmentId);
    const suffix = context.departmentName ? `-${safeFilePart(context.departmentName)}` : '';
    const filename = `rekap-absensi-${query.month}${suffix}.${query.format}`;
    const printedAt = this.reports.printedAt();

    if (query.format === 'pdf') {
      const { rows } = await this.reports.monthlyRows(query.month, query.departmentId);
      const buffer = await this.pdf.render(this.pdf.monthly(context, rows, printedAt));
      return new StreamableFile(buffer, {
        type: PDF_MIME,
        disposition: attachment(filename),
        length: buffer.length,
      });
    }

    const longestName = await this.reports.longestNameLength(query.departmentId);
    return this.stream(filename, (output) =>
      this.xlsx.writeMonthly(
        output,
        context,
        () => this.reports.monthlyBatches(context, query.departmentId),
        longestName,
        printedAt,
      ),
    );
  }

  @Get('daily/export')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Export absensi satu hari (XLSX/PDF)' })
  @ApiProduces(XLSX_MIME, PDF_MIME)
  @ApiResponse(FILE_RESPONSE)
  async dailyExport(@Query() query: DailyExportQueryDto): Promise<StreamableFile> {
    const context = await this.reports.dailyContext(query.date);
    const filename = `absensi-harian-${query.date}.${query.format}`;
    const printedAt = this.reports.printedAt();

    if (query.format === 'pdf') {
      const rows = [];
      for await (const batch of this.reports.dailyBatches(context)) rows.push(...batch);
      const buffer = await this.pdf.render(this.pdf.daily(context, rows, printedAt));
      return new StreamableFile(buffer, {
        type: PDF_MIME,
        disposition: attachment(filename),
        length: buffer.length,
      });
    }

    const longestName = await this.reports.longestNameLength();
    return this.stream(filename, (output) =>
      this.xlsx.writeDaily(
        output,
        context,
        () => this.reports.dailyBatches(context),
        longestName,
        printedAt,
      ),
    );
  }

  @Get('me/export')
  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Laporan kehadiran pribadi (PDF A4)' })
  @ApiProduces(PDF_MIME)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File PDF',
    content: { [PDF_MIME]: { schema: { type: 'string', format: 'binary' } } },
  })
  async myExport(
    @CurrentUser('id') userId: string,
    @Query() query: MyExportQueryDto,
  ): Promise<StreamableFile> {
    const report = await this.reports.personal(userId, query.month);
    const buffer = await this.pdf.render(this.pdf.personal(report, this.reports.printedAt()));
    const filename = `kehadiran-${safeFilePart(report.employee.employeeCode)}-${query.month}.pdf`;
    return new StreamableFile(buffer, {
      type: PDF_MIME,
      disposition: attachment(filename),
      length: buffer.length,
    });
  }

  /** XLSX ditulis langsung ke respons (streaming); kegagalan di tengah jalan memutus unduhan. */
  private stream(filename: string, write: (output: PassThrough) => Promise<void>): StreamableFile {
    const output = new PassThrough();
    write(output).catch((error: unknown) => {
      this.logger.error(
        `Gagal membuat ${filename}`,
        error instanceof Error ? error.stack : String(error),
      );
      output.destroy(error instanceof Error ? error : new Error(String(error)));
    });
    return new StreamableFile(output, { type: XLSX_MIME, disposition: attachment(filename) });
  }
}
