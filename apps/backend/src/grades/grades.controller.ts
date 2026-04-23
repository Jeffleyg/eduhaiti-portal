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
} from "@nestjs/common"
import { GradesService } from "./grades.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role, GradeStatus } from "@prisma/client"
import { RolesGuard } from "../common/guards/roles.guard"

@Controller("admin/grades")
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  async createGrade(
    @Req() req: { user?: { sub?: string; role?: Role } },
    @Body()
    payload: {
      studentId: string
      classId: string
      disciplineId: string
      academicYearId: string
      score: number
      maxScore?: number
      weight?: number
    },
  ) {
    return this.gradesService.create(payload, {
      id: req.user?.sub ?? "",
      role: (req.user?.role as Role) ?? Role.TEACHER,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Put(":id")
  async updateGrade(
    @Param("id") gradeId: string,
    @Body()
    payload: {
      score?: number
      status?: GradeStatus
    },
  ) {
    return this.gradesService.update(gradeId, payload)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(":id")
  async deleteGrade(@Param("id") gradeId: string) {
    return this.gradesService.delete(gradeId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post(":classId/publish")
  async publishGrades(
    @Param("classId") classId: string,
    @Query("disciplineId") disciplineId: string,
  ) {
    return this.gradesService.publishGrades(classId, disciplineId)
  }

  @UseGuards(JwtAuthGuard)
  @Get("my-grades")
  async getMyGrades(
    @Req() req: { user?: { sub?: string } },
    @Query("academicYearId") academicYearId?: string,
  ) {
    const userId = req.user?.sub
    return this.gradesService.findByStudent(userId ?? "", academicYearId)
  }

  @UseGuards(JwtAuthGuard)
  @Get("report/:academicYearId")
  async getStudentReport(
    @Req() req: { user?: { sub?: string } },
    @Param("academicYearId") academicYearId: string,
  ) {
    const userId = req.user?.sub
    return this.gradesService.getStudentReport(userId ?? "", academicYearId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get("class/:classId")
  async getClassGrades(
    @Param("classId") classId: string,
    @Query("disciplineId") disciplineId?: string,
  ) {
    return this.gradesService.findByClass(classId, disciplineId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get("class/:classId/average")
  async getClassAverage(
    @Param("classId") classId: string,
    @Query("disciplineId") disciplineId: string,
  ) {
    return this.gradesService.calculateClassAverage(classId, disciplineId)
  }
}
