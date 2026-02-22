import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTeacher(teacherId: string) {
    return this.prisma.class.findMany({
      where: { teacherId },
      include: { students: { select: { id: true, email: true, name: true } } },
    })
  }

  async findAll() {
    return this.prisma.class.findMany({
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        students: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async findById(classId: string) {
    return this.prisma.class.findUnique({
      where: { id: classId },
      include: { students: { select: { id: true, email: true, name: true } } },
    })
  }

  async findByStudent(studentId: string) {
    return this.prisma.class.findMany({
      where: { students: { some: { id: studentId } } },
    })
  }
}
