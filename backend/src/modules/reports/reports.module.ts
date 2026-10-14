import { Module } from '@nestjs/common';
import { PdfReportBuilder } from './pdf-report.builder';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { XlsxReportBuilder } from './xlsx-report.builder';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, XlsxReportBuilder, PdfReportBuilder],
  exports: [ReportsService],
})
export class ReportsModule {}
