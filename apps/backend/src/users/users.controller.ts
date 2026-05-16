import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { ResendTempPasswordDto } from './dto/resend-temp-password.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('students')
  findAllStudents(@Req() req: { user?: { schoolId?: string } }) {
    return this.usersService.findAllStudents(req.user?.schoolId);
  }

  @Get('teachers')
  findAllTeachers(@Req() req: { user?: { schoolId?: string } }) {
    return this.usersService.findAllTeachers(req.user?.schoolId);
  }

  @Post('students')
  createStudent(@Req() req: { user?: { schoolId?: string } }, @Body() body: CreateStudentDto) {
    return this.usersService.createStudent(body, req.user?.schoolId);
  }

  @Post('teachers')
  createTeacher(@Req() req: { user?: { schoolId?: string } }, @Body() body: CreateTeacherDto) {
    return this.usersService.createTeacher(body, req.user?.schoolId);
  }

  @Post('resend-temp-password')
  resendTempPassword(@Body() body: ResendTempPasswordDto) {
    return this.usersService.resendTempPassword(body.email);
  }
}
