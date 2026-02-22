import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { GradeStatus } from "@prisma/client"

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: {
    studentId: string
    classId: string
    disciplineId: string
    academicYearId: string
    score: number
    maxScore?: number
    weight?: number
  }) {
    // Validate discipline belongs to the class's series
    const classData = await this.prisma.class.findUnique({
      where: { id: payload.classId },
      include: { series: true },
    })

    if (!classData) {
      throw new NotFoundException("Class not found")
    }

    const discipline = await this.prisma.discipline.findUnique({
      where: { id: payload.disciplineId },
    })

    if (!discipline || discipline.seriesId !== classData.seriesId) {
      throw new BadRequestException(
        "Discipline does not belong to this class's series",
      )
    }

    return this.prisma.grade.create({
      data: {
        studentId: payload.studentId,
        classId: payload.classId,
        disciplineId: payload.disciplineId,
        academicYearId: payload.academicYearId,
        score: payload.score,
        maxScore: payload.maxScore || 20,
        weight: payload.weight || 1.0,
        status: "DRAFT",
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        discipline: { select: { id: true, name: true } },
      },
    })
  }

  async update(
    gradeId: string,
    payload: {
      score?: number
      status?: GradeStatus
    },
  ) {
    const existing = await this.prisma.grade.findUnique({
      where: { id: gradeId },
    })

    if (!existing) {
      throw new NotFoundException("Grade not found")
    }

    return this.prisma.grade.update({
      where: { id: gradeId },
      data: payload,
      include: {
        student: { select: { id: true, name: true } },
        discipline: { select: { id: true, name: true } },
      },
    })
  }

  async delete(gradeId: string) {
    const existing = await this.prisma.grade.findUnique({
      where: { id: gradeId },
    })

    if (!existing) {
      throw new NotFoundException("Grade not found")
    }

    await this.prisma.grade.delete({ where: { id: gradeId } })
    return { message: "Grade deleted successfully" }
  }

  async publishGrades(classId: string, disciplineId: string) {
    return this.prisma.grade.updateMany({
      where: {
        classId,
        disciplineId,
        status: "DRAFT",
      },
      data: { status: "PUBLISHED" },
    })
  }

  async findByStudent(studentId: string, academicYearId?: string) {
    const where: any = { studentId }

    if (academicYearId) {
      where.academicYearId = academicYearId
    }

    return this.prisma.grade.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        discipline: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async findByClass(classId: string, disciplineId?: string) {
    const where: any = { classId }

    if (disciplineId) {
      where.disciplineId = disciplineId
    }

    return this.prisma.grade.findMany({
      where,
      include: {
        student: { select: { id: true, email: true, name: true } },
        discipline: { select: { id: true, name: true } },
      },
      orderBy: [{ discipline: { name: "asc" } }, { student: { name: "asc" } }],
    })
  }

  async calculateClassAverage(classId: string, disciplineId: string) {
    const grades = await this.prisma.grade.findMany({
      where: {
        classId,
        disciplineId,
        status: "PUBLISHED",
      },
      select: { score: true, maxScore: true, weight: true },
    })

    if (grades.length === 0) {
      return { average: 0, count: 0 }
    }

    const totalWeightedScore = grades.reduce(
      (sum, g) => sum + (g.score / g.maxScore) * g.weight,
      0,
    )
    const totalWeight = grades.reduce((sum, g) => sum + g.weight, 0)

    return {
      average: (totalWeightedScore / totalWeight) * 20, // normalize to 20
      count: grades.length,
    }
  }

  async getStudentReport(studentId: string, academicYearId: string) {
    const grades = await this.prisma.grade.findMany({
      where: {
        studentId,
        academicYearId,
        status: "PUBLISHED",
      },
      include: {
        discipline: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: { discipline: { name: "asc" } },
    })

    const summary = {}
    grades.forEach((grade) => {
      const key = grade.discipline.name
      if (!summary[key]) {
        summary[key] = []
      }
      summary[key].push({
        score: grade.score,
        maxScore: grade.maxScore,
        percentage: (grade.score / grade.maxScore) * 100,
      })
    })

    return {
      studentId,
      academicYearId,
      grades,
      summary,
    }
  }
}
      data: { score, status },
    })
  }
}
