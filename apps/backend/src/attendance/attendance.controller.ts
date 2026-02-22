import {
  Body,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { AttendanceService } from "./attendance.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role, AttendanceStatus } from "@prisma/client"
import { RolesGuard } from "../common/guards/roles.guard"

@Controller("admin/attendance")
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Post()
  async markAttendance(
    @Body()
    payload: {
      studentId: string
      classId: string
      date: Date
      status: AttendanceStatus
      remarks?: string
    },
  ) {
    return this.attendanceService.markAttendance(payload)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(":id")
  async deleteAttendance(@Param("id") attendanceId: string) {
    return this.attendanceService.delete(attendanceId)
  }

  @UseGuards(JwtAuthGuard)
  @Get("my-attendance")
  async getMyAttendance(
    @Req() req: { user?: { sub?: string } },
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const userId = req.user?.sub
    return this.attendanceService.findByStudent(
      userId ?? "",
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    )
  }

  @UseGuards(JwtAuthGuard)
  @Get("my-stats/:classId")
  async getMyStats(
    @Req() req: { user?: { sub?: string } },
    @Param("classId") classId: string,
  ) {
    const userId = req.user?.sub
    return this.attendanceService.getStudentAttendanceStats(userId ?? "", classId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get("class/:classId")
  async getClassAttendance(
    @Param("classId") classId: string,
    @Query("date") date?: string,
  ) {
    return this.attendanceService.findByClass(classId, date ? new Date(date) : undefined)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get("class/:classId/report")
  async getClassReport(@Param("classId") classId: string) {
    return this.attendanceService.getClassAttendanceReport(classId)
  }
}
