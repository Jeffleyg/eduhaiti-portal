import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { normalizeExportLanguage } from '../common/csv';
import {
  ClassAccessService,
  ClassRequester,
} from '../prisma/class-access.service';
import {
  AttendanceReportScope,
  AttendanceReportService,
} from './attendance-report.service';
import { attendanceFileName, buildAttendanceCsv } from './attendance-export';

export class AttendanceReportQueryDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  lang?: string;
}

type ReportRequest = { user?: ClassRequester };

@Controller('attendance/report')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.ADMIN)
export class AttendanceReportController {
  constructor(
    private readonly reports: AttendanceReportService,
    private readonly classAccess: ClassAccessService,
  ) {}

  @Get()
  async report(
    @Req() req: ReportRequest,
    @Query() query: AttendanceReportQueryDto,
  ) {
    return this.reports.build(await this.scope(req, query.classId), query);
  }

  @Get('export')
  async export(
    @Req() req: ReportRequest,
    @Query() query: AttendanceReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const language = normalizeExportLanguage(query.lang);
    const report = await this.reports.build(
      await this.scope(req, query.classId),
      query,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${attendanceFileName(language)}"`,
    );
    return buildAttendanceCsv(report.students, language);
  }

  /**
   * One class (checked by ClassAccessService), the whole school for an admin,
   * or every class a teacher teaches.
   */
  private async scope(
    req: ReportRequest,
    classId?: string,
  ): Promise<AttendanceReportScope> {
    const user = req.user;
    if (classId) {
      const row = await this.classAccess.assertCanManageClass(classId, user);
      return {
        schoolId: row.academicYear?.schoolId ?? null,
        classWhere: { id: classId },
      };
    }
    if (user?.role === Role.ADMIN) {
      if (!user.schoolId) {
        throw new ForbiddenException('Admin is not linked to a school');
      }
      return {
        schoolId: user.schoolId,
        classWhere: { academicYear: { schoolId: user.schoolId } },
      };
    }
    return {
      schoolId: user?.schoolId ?? null,
      classWhere: { teacherId: user?.sub ?? '' },
    };
  }
}
