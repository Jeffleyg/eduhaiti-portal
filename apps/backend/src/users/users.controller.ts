import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common"
import { UsersService } from "./users.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../common/guards/roles.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role } from "@prisma/client"
import { CreateStudentDto } from "./dto/create-student.dto"
import { CreateTeacherDto } from "./dto/create-teacher.dto"

@Controller("admin/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("students")
  findAllStudents() {
    return this.usersService.findAllStudents()
  }

  @Get("teachers")
  findAllTeachers() {
    return this.usersService.findAllTeachers()
  }

  @Post("students")
  createStudent(@Body() body: CreateStudentDto) {
    return this.usersService.createStudent(body)
  }

  @Post("teachers")
  createTeacher(@Body() body: CreateTeacherDto) {
    return this.usersService.createTeacher(body)
  }
}
