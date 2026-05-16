import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin/classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  async createClass(
    @Req() req: { user?: { schoolId?: string } },
    @Body()
    payload: {
      name: string;
      level?: string;
      academicYearId: string;
      seriesId: string;
      teacherId?: string;
      maxStudents?: number;
    },
  ) {
    return this.classesService.create(payload, req.user?.schoolId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put(':id')
  async updateClass(
    @Req() req: { user?: { schoolId?: string } },
    @Param('id') classId: string,
    @Body()
    payload: {
      name?: string;
      teacherId?: string;
      maxStudents?: number;
    },
  ) {
    return this.classesService.update(classId, payload, req.user?.schoolId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async deleteClass(
    @Req() req: { user?: { schoolId?: string } },
    @Param('id') classId: string,
  ) {
    return this.classesService.delete(classId, req.user?.schoolId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/enroll')
  async enrollStudent(
    @Req() req: { user?: { schoolId?: string } },
    @Param('id') classId: string,
    @Body() payload: { studentId: string },
  ) {
    return this.classesService.enrollStudent(classId, payload.studentId, req.user?.schoolId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id/students/:studentId')
  async removeStudent(
    @Req() req: { user?: { schoolId?: string } },
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.classesService.removeStudent(classId, studentId, req.user?.schoolId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async getAllClasses(
    @Req() req: { user?: { schoolId?: string } },
    @Query('academicYearId') academicYearId?: string,
    @Query('seriesId') seriesId?: string,
  ) {
    return this.classesService.findAll(academicYearId, seriesId, req.user?.schoolId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('meta/academic-years')
  async getAcademicYears(@Req() req: { user?: { schoolId?: string } }) {
    return this.classesService.listAcademicYears(req.user?.schoolId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('meta/series')
  async getSeries(
    @Req() req: { user?: { schoolId?: string } },
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.classesService.listSeries(academicYearId, req.user?.schoolId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-classes')
  async getMyClasses(@Req() req: { user?: { sub?: string; role?: string; schoolId?: string } }) {
    const userId = req.user?.sub;
    const role = req.user?.role;

    if (role === 'TEACHER') {
      return this.classesService.findByTeacher(userId ?? '');
    }

    if (role === 'STUDENT') {
      return this.classesService.findByStudent(userId ?? '', req.user?.schoolId);
    }

    return [];
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getClass(
    @Req() req: { user?: { schoolId?: string } },
    @Param('id') classId: string,
  ) {
    return this.classesService.findById(classId, req.user?.schoolId);
  }
}
