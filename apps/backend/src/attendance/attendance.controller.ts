import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common"
import { AttendanceService } from "./attendance.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role } from "@prisma/client"
import { RolesGuard } from "../common/guards/roles.guard"

@Controller("attendance")
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseGuards(JwtAuthGuard)
  @Get("my-attendance")
  async getMyAttendance(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub
    return this.attendanceService.findByStudent(userId ?? "")
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get("class/:classId")
  async getClassAttendance(@Req() req: { user?: { sub?: string } }, classId: string) {
    return this.attendanceService.findByClass(classId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  async markAttendance(@Body() body: any) {
    return this.attendanceService.markAttendance(body.studentId, body.classId, body.date, body.status)
  }
}
