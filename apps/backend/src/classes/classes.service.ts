import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { Role } from "@prisma/client"

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: {
    name: string
    level?: string
    academicYearId: string
    seriesId: string
    teacherId?: string
    maxStudents?: number
  }) {
    // Validate that the series belongs to the academic year
    const series = await this.prisma.series.findUnique({
      where: { id: payload.seriesId },
    })

    if (!series || series.academicYearId !== payload.academicYearId) {
      throw new BadRequestException(
        "Series does not belong to the specified academic year",
      )
    }

    // Check for duplicate class name
    const existing = await this.prisma.class.findFirst({
      where: {
        academicYearId: payload.academicYearId,
        seriesId: payload.seriesId,
        name: payload.name,
      },
    })

    if (existing) {
      throw new BadRequestException(
        "Class with this name already exists in this series",
      )
    }

    return this.prisma.class.create({
      data: {
        name: payload.name,
        level: payload.level || series.name,
        academicYearId: payload.academicYearId,
        seriesId: payload.seriesId,
        teacherId: payload.teacherId,
        maxStudents: payload.maxStudents || 30,
      },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        series: { select: { id: true, name: true } },
        students: { select: { id: true, name: true } },
      },
    })
  }

  async update(
    classId: string,
    payload: {
      name?: string
      teacherId?: string
      maxStudents?: number
    },
  ) {
    const existing = await this.prisma.class.findUnique({
      where: { id: classId },
    })

    if (!existing) {
      throw new NotFoundException("Class not found")
    }

    if (payload.name && payload.name !== existing.name) {
      const duplicate = await this.prisma.class.findFirst({
        where: {
          id: { not: classId },
          academicYearId: existing.academicYearId,
          seriesId: existing.seriesId,
          name: payload.name,
        },
      })

      if (duplicate) {
        throw new BadRequestException(
          "Class with this name already exists in this series",
        )
      }
    }

    if (payload.teacherId) {
      const teacher = await this.prisma.user.findUnique({
        where: { id: payload.teacherId },
        select: { id: true, role: true },
      })

      if (!teacher || teacher.role !== Role.TEACHER) {
        throw new BadRequestException("Teacher not found")
      }
    }

    if (payload.maxStudents !== undefined && payload.maxStudents < 1) {
      throw new BadRequestException("maxStudents must be greater than zero")
    }

    return this.prisma.class.update({
      where: { id: classId },
      data: payload,
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        students: { select: { id: true, name: true } },
      },
    })
  }

  async delete(classId: string) {
    const existing = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { students: { select: { id: true } } },
    })

    if (!existing) {
      throw new NotFoundException("Class not found")
    }

    if (existing.students && existing.students.length > 0) {
      throw new BadRequestException(
        "Cannot delete class with enrolled students",
      )
    }

    await this.prisma.class.delete({
      where: { id: classId },
    })

    return { message: "Class deleted successfully" }
  }

  async enrollStudent(classId: string, studentId: string) {
    const classExists = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { students: { select: { id: true } } },
    })

    if (!classExists) {
      throw new NotFoundException("Class not found")
    }

    if (
      classExists.maxStudents &&
      classExists.students.length >= classExists.maxStudents
    ) {
      throw new BadRequestException("Class is full")
    }

    if (classExists.students.some((s) => s.id === studentId)) {
      throw new BadRequestException("Student already enrolled in this class")
    }

    return this.prisma.class.update({
      where: { id: classId },
      data: {
        students: {
          connect: { id: studentId },
        },
      },
      include: {
        students: { select: { id: true, name: true, email: true } },
      },
    })
  }

  async removeStudent(classId: string, studentId: string) {
    return this.prisma.class.update({
      where: { id: classId },
      data: {
        students: {
          disconnect: { id: studentId },
        },
      },
      include: {
        students: { select: { id: true, name: true } },
      },
    })
  }

  async findByTeacher(teacherId: string) {
    return this.prisma.class.findMany({
      where: { teacherId },
      include: {
        teacher: { select: { id: true, name: true } },
        students: { select: { id: true, email: true, name: true } },
        series: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    })
  }

  async findAll(academicYearId?: string, seriesId?: string) {
    const where: any = {}

    if (academicYearId) {
      where.academicYearId = academicYearId
    }

    if (seriesId) {
      where.seriesId = seriesId
    }

    return this.prisma.class.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        students: { select: { id: true, name: true } },
        series: { select: { id: true, name: true } },
        academicYear: { select: { year: true } },
      },
      orderBy: [{ academicYear: { year: "desc" } }, { name: "asc" }],
    })
  }

  async findById(classId: string) {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        teacher: { select: { id: true, email: true, name: true } },
        students: { select: { id: true, email: true, name: true } },
        series: { select: { id: true, name: true } },
        grades: {
          select: {
            id: true,
            studentId: true,
            score: true,
            disciplineId: true,
          },
        },
      },
    })

    if (!classData) {
      throw new NotFoundException("Class not found")
    }

    return classData
  }

  async findByStudent(studentId: string) {
    return this.prisma.class.findMany({
      where: { students: { some: { id: studentId } } },
      include: {
        teacher: { select: { id: true, name: true } },
        series: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    })
  }

  async listAcademicYears() {
    return this.prisma.academicYear.findMany({
      select: { id: true, year: true, startDate: true, endDate: true, isActive: true },
      orderBy: { year: "desc" },
    })
  }

  async listSeries(academicYearId?: string) {
    return this.prisma.series.findMany({
      where: academicYearId ? { academicYearId } : undefined,
      select: {
        id: true,
        name: true,
        academicYearId: true,
        academicYear: { select: { id: true, year: true } },
      },
      orderBy: [{ academicYear: { year: "desc" } }, { name: "asc" }],
    })
  }
}
