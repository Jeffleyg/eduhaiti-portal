import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common"
import { GradesService } from "./grades.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { RolesGuard } from "../common/guards/roles.guard"
import { Role } from "@prisma/client"

@Controller("grades")
export class GradesPublicController {
  constructor(private readonly gradesService: GradesService) {}

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

  @UseGuards(JwtAuthGuard)
  @Get("my-academic-years")
  async getMyAcademicYears(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub
    return this.gradesService.listAcademicYearsForStudent(userId ?? "")
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
}
