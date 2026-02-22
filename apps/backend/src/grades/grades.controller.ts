import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common"
import { GradesService } from "./grades.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role } from "@prisma/client"
import { RolesGuard } from "../common/guards/roles.guard"

@Controller("grades")
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @UseGuards(JwtAuthGuard)
  @Get("my-grades")
  async getMyGrades(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub
    return this.gradesService.findByStudent(userId ?? "")
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get("class/:classId")
  async getClassGrades(@Param("classId") classId: string) {
    return this.gradesService.findByClass(classId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  async createGrade(@Body() body: any) {
    return this.gradesService.create(body.studentId, body.classId, body.subject, body.score, body.maxScore)
  }
}
