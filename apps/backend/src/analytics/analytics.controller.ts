import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import type { AnalyticsReportType } from './analytics.service';
import {
  EXPORT_FORMATS,
  ExportFormat,
  ExportReportDto,
} from './dto/export-report.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('views/sqlserver')
  @Header('content-type', 'text/plain; charset=utf-8')
  getSqlServerViewLocation() {
    return {
      file: 'src/analytics/sqlserver/analytics_views.sql',
      note: 'Deploy this script on SQL Server to materialize reporting views.',
    };
  }

  @Get('dashboard/impacto-diaspora')
  async getDiasporaImpact(@Query('schoolId') schoolId?: string) {
    return this.analyticsService.getDiasporaScholarshipImpactDashboard(
      schoolId,
    );
  }

  @Get('dashboard/alerta-precoce')
  async getEarlyWarning(
    @Query('schoolId') schoolId?: string,
    @Query('trigger') trigger?: string,
  ) {
    const report = await this.analyticsService.getEarlyWarningReport(schoolId);
    if (trigger === '1' || trigger === 'true') {
      const notification = await this.analyticsService.triggerEarlyWarningAlerts(
        schoolId,
      );
      return { report, notification };
    }

    return { report };
  }

  @Get('reports/:type')
  async getReport(
    @Param('type') type: AnalyticsReportType,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.analyticsService.buildReportData(type, schoolId);
  }

  @Get('reports/:type/export')
  async exportReport(
    @Param('type') type: AnalyticsReportType,
    @Query() query: ExportReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const format = this.normalizeFormat(query.format);
    const exported = await this.analyticsService.exportReport(
      type,
      query.schoolId,
      format,
    );

    res.setHeader('Content-Type', exported.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exported.fileName}"`,
    );
    res.setHeader('Content-Length', String(exported.buffer.byteLength));

    return new StreamableFile(exported.buffer);
  }

  private normalizeFormat(value?: ExportFormat): ExportFormat {
    if (value && EXPORT_FORMATS.includes(value)) {
      return value;
    }

    return 'json.gz';
  }
}
