import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async findByStudent(studentId: string) {
    return this.prisma.attendance.findMany({
      where: { studentId },
      include: { class: true },
    })
  }

  async findByClass(classId: string) {
    return this.prisma.attendance.findMany({
      where: { classId },
      include: { student: { select: { id: true, email: true, name: true } } },
      orderBy: { date: "desc" },
    })
  }

  async markAttendance(studentId: string, classId: string, date: Date, status: string) {
    const existing = await this.prisma.attendance.findFirst({
      where: { studentId, classId, date: { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) } },
    })

    if (existing) {
      return this.prisma.attendance.update({
        where: { id: existing.id },
        data: { status },
      })
    }

    return this.prisma.attendance.create({
      data: { studentId, classId, date: new Date(date), status },
    })
  }
}
