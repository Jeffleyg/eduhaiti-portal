import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { ResendTempPasswordDto } from './dto/resend-temp-password.dto';
import { UpdateGuardiansDto } from './dto/update-guardians.dto';
import { GuardiansService } from './guardians.service';

type AdminRequest = { user?: { schoolId?: string | null } };

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly guardiansService: GuardiansService,
  ) {}

  /** Every admin action is limited to the admin's own school. */
  private school(req: AdminRequest): string {
    if (!req.user?.schoolId) {
      throw new ForbiddenException('Admin is not linked to a school');
    }
    return req.user.schoolId;
  }

  @Get('students')
  findAllStudents(@Req() req: AdminRequest) {
    return this.usersService.findAllStudents(this.school(req));
  }

  @Get('teachers')
  findAllTeachers(@Req() req: AdminRequest) {
    return this.usersService.findAllTeachers(this.school(req));
  }

  @Post('students')
  createStudent(@Req() req: AdminRequest, @Body() body: CreateStudentDto) {
    return this.usersService.createStudent(body, this.school(req));
  }

  @Post('teachers')
  createTeacher(@Req() req: AdminRequest, @Body() body: CreateTeacherDto) {
    return this.usersService.createTeacher(body, this.school(req));
  }

  @Post('resend-temp-password')
  resendTempPassword(
    @Req() req: AdminRequest,
    @Body() body: ResendTempPasswordDto,
  ) {
    return this.usersService.resendTempPassword(body.email, this.school(req));
  }

  @Get('students/:id/guardians')
  async listGuardians(
    @Req() req: AdminRequest,
    @Param('id') studentId: string,
  ) {
    await this.guardiansService.assertStudentInSchool(
      studentId,
      this.school(req),
    );
    return this.guardiansService.listForStudent(studentId);
  }

  @Put('students/:id/guardians')
  async replaceGuardians(
    @Req() req: AdminRequest,
    @Param('id') studentId: string,
    @Body() body: UpdateGuardiansDto,
  ) {
    await this.guardiansService.assertStudentInSchool(
      studentId,
      this.school(req),
    );
    return this.guardiansService.replaceForStudent(studentId, body.guardians);
  }
}
