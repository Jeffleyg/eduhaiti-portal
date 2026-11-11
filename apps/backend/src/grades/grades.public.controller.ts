import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GradesService } from './grades.service';
import {
  ClassAccessService,
  ClassRequester,
} from '../prisma/class-access.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '@prisma/client';

@Controller('grades')
export class GradesPublicController {
  constructor(
    private readonly gradesService: GradesService,
    private readonly classAccess: ClassAccessService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('my-grades')
  async getMyGrades(
    @Req() req: { user?: { sub?: string } },
    @Query('academicYearId') academicYearId?: string,
  ) {
    const userId = req.user?.sub;
    return this.gradesService.findByStudent(userId ?? '', academicYearId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('report/:academicYearId')
  async getStudentReport(
    @Req() req: { user?: { sub?: string } },
    @Param('academicYearId') academicYearId: string,
  ) {
    const userId = req.user?.sub;
    return this.gradesService.getStudentReport(userId ?? '', academicYearId);
  }

  /** Students issue their own verifiable transcript for a year. */
  @UseGuards(JwtAuthGuard)
  @Post('transcript/:academicYearId/issue')
  async issueTranscript(
    @Req() req: { user?: { sub?: string; role?: string } },
    @Param('academicYearId') academicYearId: string,
  ) {
    if (req.user?.role !== Role.STUDENT || !req.user.sub) {
      throw new ForbiddenException('Only students can issue their transcript');
    }
    return this.gradesService.issueTranscript(req.user.sub, academicYearId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-academic-years')
  async getMyAcademicYears(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub;
    return this.gradesService.listAcademicYearsForStudent(userId ?? '');
  }

  @UseGuards(JwtAuthGuard)
  @Get('evolution')
  async getMyEvolution(
    @Req() req: { user?: { sub?: string } },
    @Query('academicYearId') academicYearId?: string,
  ) {
    const userId = req.user?.sub;
    return this.gradesService.getStudentEvolution(userId ?? '', academicYearId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get('class/:classId')
  async getClassGrades(
    @Req() req: { user?: ClassRequester },
    @Param('classId') classId: string,
    @Query('disciplineId') disciplineId?: string,
  ) {
    await this.classAccess.assertCanManageClass(classId, req.user);
    return this.gradesService.findByClass(classId, disciplineId);
  }
}
