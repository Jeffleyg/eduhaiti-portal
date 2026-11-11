import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Param,
  Post,
  Query,
  Request,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import type { AnalyticsReportType } from './analytics.service';
import {
  EXPORT_FORMATS,
  ExportFormat,
  ExportReportDto,
} from './dto/export-report.dto';

type AnalyticsUser = { sub?: string; role?: Role; schoolId?: string | null };

/** Reports that aggregate data across every school; only the platform owner may read them. */
const CROSS_SCHOOL_REPORTS: ReadonlySet<string> = new Set(['media-notas-regiao']);

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('views/sqlserver')
  @Roles(Role.OWNER)
  @Header('content-type', 'text/plain; charset=utf-8')
  getSqlServerViewLocation() {
    return {
      file: 'src/analytics/sqlserver/analytics_views.sql',
      note: 'Deploy this script on SQL Server to materialize reporting views.',
    };
  }

  @Get('dashboard/diaspora-impact')
  async getDiasporaImpact(
    @Request() req: { user: AnalyticsUser },
    @Query('schoolId') schoolId?: string,
  ) {
    return this.analyticsService.getDiasporaScholarshipImpactDashboard(
      this.resolveSchoolScope(req.user, schoolId),
    );
  }

  @Get('dashboard/early-alert')
  async getEarlyWarning(
    @Request() req: { user: AnalyticsUser },
    @Query('schoolId') schoolId?: string,
  ) {
    const report = await this.analyticsService.getEarlyWarningReport(
      this.resolveSchoolScope(req.user, schoolId),
    );
    return { report };
  }

  /** Sends alert messages, so it is a POST (GET must stay free of side effects). */
  @Post('dashboard/early-alert/trigger')
  async triggerEarlyWarning(
    @Request() req: { user: AnalyticsUser },
    @Query('schoolId') schoolId?: string,
  ) {
    const scope = this.resolveSchoolScope(req.user, schoolId);
    const report = await this.analyticsService.getEarlyWarningReport(scope);
    const notification = await this.analyticsService.triggerEarlyWarningAlerts(
      scope,
      req.user.sub,
      report,
    );
    return { report, notification };
  }

  @Get('reports/:type')
  async getReport(
    @Request() req: { user: AnalyticsUser },
    @Param('type') type: AnalyticsReportType,
    @Query('schoolId') schoolId?: string,
  ) {
    this.assertReportAllowed(req.user, type);
    return this.analyticsService.buildReportData(
      type,
      this.resolveSchoolScope(req.user, schoolId),
    );
  }

  @Get('reports/:type/export')
  async exportReport(
    @Request() req: { user: AnalyticsUser },
    @Param('type') type: AnalyticsReportType,
    @Query() query: ExportReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertReportAllowed(req.user, type);
    const format = this.normalizeFormat(query.format);
    const exported = await this.analyticsService.exportReport(
      type,
      this.resolveSchoolScope(req.user, query.schoolId),
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

  /**
   * School admins are always pinned to their own school, whatever the query says.
   * The owner may target one school or (no schoolId) the whole platform.
   */
  private resolveSchoolScope(user: AnalyticsUser, requested?: string) {
    if (user.role === Role.OWNER) {
      return requested || undefined;
    }

    if (!user.schoolId) {
      throw new ForbiddenException('Admin is not linked to a school');
    }

    return user.schoolId;
  }

  private assertReportAllowed(user: AnalyticsUser, type: string) {
    if (CROSS_SCHOOL_REPORTS.has(type) && user.role !== Role.OWNER) {
      throw new ForbiddenException('This report is restricted to the platform owner');
    }
  }

  private normalizeFormat(value?: ExportFormat): ExportFormat {
    if (value && EXPORT_FORMATS.includes(value)) {
      return value;
    }

    return 'json.gz';
  }
}
