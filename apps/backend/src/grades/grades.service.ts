import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByStudent(studentId: string) {
    return this.prisma.grade.findMany({
      where: { studentId },
      include: { class: true },
    })
  }

  async findByClass(classId: string) {
    return this.prisma.grade.findMany({
      where: { classId },
      include: { student: { select: { id: true, email: true, name: true } } },
    })
  }

  async create(studentId: string, classId: string, subject: string, score: number, maxScore: number = 20) {
    return this.prisma.grade.create({
      data: { studentId, classId, subject, score, maxScore, status: "draft" },
    })
  }

  async update(gradeId: string, score: number, status: string) {
    return this.prisma.grade.update({
      where: { id: gradeId },
      data: { score, status },
    })
  }
}
