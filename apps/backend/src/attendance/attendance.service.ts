import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { AttendanceStatus } from "@prisma/client"

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async markAttendance(payload: {
    studentId: string
    classId: string
    date: Date
    status: AttendanceStatus
    remarks?: string
  }) {
    const student = await this.prisma.user.findUnique({
      where: { id: payload.studentId },
    })

    if (!student) {
      throw new NotFoundException("Student not found")
    }

    const classData = await this.prisma.class.findUnique({
      where: { id: payload.classId },
    })

    if (!classData) {
      throw new NotFoundException("Class not found")
    }

    // Check if attendance already recorded for this date
    const startOfDay = new Date(payload.date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(payload.date)
    endOfDay.setHours(23, 59, 59, 999)

    const existing = await this.prisma.attendance.findFirst({
      where: {
        studentId: payload.studentId,
        classId: payload.classId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    })

    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: payload.status,
          remarks: payload.remarks,
        },
        include: {
          student: { select: { id: true, name: true } },
          class: { select: { id: true, name: true } },
        },
      })
    }

    return this.prisma.attendance.create({
      data: {
        studentId: payload.studentId,
        classId: payload.classId,
        date: new Date(payload.date),
        status: payload.status,
        remarks: payload.remarks,
      },
      include: {
        student: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
    })
  }

  async findByStudent(
    studentId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = { studentId }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = startDate
      if (endDate) where.date.lte = endDate
    }

    return this.prisma.attendance.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    })
  }

  async findByClass(classId: string, date?: Date) {
    const where: any = { classId }

    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)

      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)

      where.date = {
        gte: startOfDay,
        lte: endOfDay,
      }
    }

    return this.prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: { id: true, email: true, name: true, enrollmentNumber: true },
        },
      },
      orderBy: { date: "desc" },
    })
  }

  async getStudentAttendanceStats(studentId: string, classId: string) {
    const records = await this.prisma.attendance.findMany({
      where: { studentId, classId },
      select: { status: true },
    })

    const stats = {
      total: records.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    }

    records.forEach((r) => {
      if (r.status === "PRESENT") stats.present++
      else if (r.status === "ABSENT") stats.absent++
      else if (r.status === "LATE") stats.late++
      else if (r.status === "EXCUSED") stats.excused++
    })

    const absencePercentage = stats.total > 0 ? (stats.absent / stats.total) * 100 : 0

    return {
      ...stats,
      absencePercentage,
      isAtRisk: absencePercentage > 25, // Haiti standard: 25% absence threshold
    }
  }

  async getClassAttendanceReport(classId: string) {
    const students = await this.prisma.user.findMany({
      where: {
        classesAttending: {
          some: { id: classId },
        },
      },
      select: { id: true, name: true, email: true },
    })

    const report = await Promise.all(
      students.map(async (student) => {
        const stats = await this.getStudentAttendanceStats(student.id, classId)
        return {
          student,
          ...stats,
        }
      }),
    )

    return report
  }

  async delete(attendanceId: string) {
    const existing = await this.prisma.attendance.findUnique({
      where: { id: attendanceId },
    })

    if (!existing) {
      throw new NotFoundException("Attendance record not found")
    }

    await this.prisma.attendance.delete({ where: { id: attendanceId } })
    return { message: "Attendance record deleted" }
  }
}
