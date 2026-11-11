import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GradesService } from './grades.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, GradeStatus } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClassAccessService } from '../prisma/class-access.service';

@Controller('admin/grades')
export class GradesController {
  constructor(
    private readonly gradesService: GradesService,
    private readonly classAccess: ClassAccessService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  async createGrade(
    @Req() req: { user?: { sub?: string; role?: Role; schoolId?: string | null } },
    @Body()
    payload: {
      studentId: string;
      classId: string;
      disciplineId: string;
      academicYearId?: string;
      score: number;
      maxScore?: number;
      weight?: number;
    },
  ) {
    // Admins only inside their own school; teachers only in their classes.
    await this.classAccess.assertCanManageClass(payload.classId, req.user);
    return this.gradesService.create(payload, {
      id: req.user?.sub ?? '',
      role: (req.user?.role as Role) ?? Role.TEACHER,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Put(':id')
  async updateGrade(
    @Req() req: { user?: { sub?: string; role?: Role; schoolId?: string | null } },
    @Param('id') gradeId: string,
    @Body()
    payload: {
      score?: number;
      status?: GradeStatus;
    },
  ) {
    await this.classAccess.assertCanManageGrade(gradeId, req.user);
    return this.gradesService.update(gradeId, {
      score: payload?.score,
      status: payload?.status,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async deleteGrade(
    @Req() req: { user?: { sub?: string; role?: Role; schoolId?: string | null } },
    @Param('id') gradeId: string,
  ) {
    await this.classAccess.assertCanManageGrade(gradeId, req.user);
    return this.gradesService.delete(gradeId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post(':classId/publish')
  async publishGrades(
    @Req() req: { user?: { sub?: string; role?: Role; schoolId?: string | null } },
    @Param('classId') classId: string,
    @Query('disciplineId') disciplineId: string,
  ) {
    await this.classAccess.assertCanManageClass(classId, req.user);
    return this.gradesService.publishGrades(classId, disciplineId);
  }

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get('class/:classId')
  async getClassGrades(
    @Req() req: { user?: { sub?: string; role?: Role; schoolId?: string | null } },
    @Param('classId') classId: string,
    @Query('disciplineId') disciplineId?: string,
  ) {
    await this.classAccess.assertCanManageClass(classId, req.user);
    return this.gradesService.findByClass(classId, disciplineId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get('class/:classId/average')
  async getClassAverage(
    @Req() req: { user?: { sub?: string; role?: Role; schoolId?: string | null } },
    @Param('classId') classId: string,
    @Query('disciplineId') disciplineId: string,
  ) {
    await this.classAccess.assertCanManageClass(classId, req.user);
    return this.gradesService.calculateClassAverage(classId, disciplineId);
  }
}
