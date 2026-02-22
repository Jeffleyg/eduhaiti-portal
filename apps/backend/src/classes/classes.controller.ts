import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { ClassesService } from "./classes.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../common/guards/roles.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role } from "@prisma/client"

@Controller("admin/classes")
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  async createClass(
    @Body()
    payload: {
      name: string
      level?: string
      academicYearId: string
      seriesId: string
      teacherId?: string
      maxStudents?: number
    },
  ) {
    return this.classesService.create(payload)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put(":id")
  async updateClass(
    @Param("id") classId: string,
    @Body()
    payload: {
      name?: string
      teacherId?: string
      maxStudents?: number
    },
  ) {
    return this.classesService.update(classId, payload)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(":id")
  async deleteClass(@Param("id") classId: string) {
    return this.classesService.delete(classId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post(":id/enroll")
  async enrollStudent(
    @Param("id") classId: string,
    @Body() payload: { studentId: string },
  ) {
    return this.classesService.enrollStudent(classId, payload.studentId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(":id/students/:studentId")
  async removeStudent(
    @Param("id") classId: string,
    @Param("studentId") studentId: string,
  ) {
    return this.classesService.removeStudent(classId, studentId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async getAllClasses(
    @Query("academicYearId") academicYearId?: string,
    @Query("seriesId") seriesId?: string,
  ) {
    return this.classesService.findAll(academicYearId, seriesId)
  }

  @UseGuards(JwtAuthGuard)
  @Get("my-classes")
  async getMyClasses(@Req() req: { user?: { sub?: string; role?: string } }) {
    const userId = req.user?.sub
    const role = req.user?.role

    if (role === "TEACHER") {
      return this.classesService.findByTeacher(userId ?? "")
    } else if (role === "STUDENT") {
      return this.classesService.findByStudent(userId ?? "")
    }

    return []
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async getClass(@Param("id") classId: string) {
    return this.classesService.findById(classId)
  }
}
