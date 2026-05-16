import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: {
    name: string;
    level?: string;
    academicYearId: string;
    seriesId: string;
    teacherId?: string;
    maxStudents?: number;
  }, schoolId?: string) {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: payload.academicYearId },
      select: { id: true, schoolId: true },
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found');
    }

    if (schoolId && academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Academic year does not belong to this school');
    }

    const series = await this.prisma.series.findUnique({
      where: { id: payload.seriesId },
      select: { id: true, name: true, academicYearId: true, academicYear: { select: { schoolId: true } } },
    });

    if (!series || series.academicYearId !== payload.academicYearId) {
      throw new BadRequestException(
        'Series does not belong to the specified academic year',
      );
    }

    if (schoolId && series.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Series does not belong to this school');
    }

    // Check for duplicate class name
    const existing = await this.prisma.class.findFirst({
      where: {
        academicYearId: payload.academicYearId,
        seriesId: payload.seriesId,
        name: payload.name,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Class with this name already exists in this series',
      );
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
    });
  }

  async update(
    classId: string,
    payload: {
      name?: string;
      teacherId?: string;
      maxStudents?: number;
    },
    schoolId?: string,
  ) {
    const existing = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { academicYear: { select: { schoolId: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Class not found');
    }

    if (schoolId && existing.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Class does not belong to this school');
    }

    if (payload.name && payload.name !== existing.name) {
      const duplicate = await this.prisma.class.findFirst({
        where: {
          id: { not: classId },
          academicYearId: existing.academicYearId,
          seriesId: existing.seriesId,
          name: payload.name,
        },
      });

      if (duplicate) {
        throw new BadRequestException(
          'Class with this name already exists in this series',
        );
      }
    }

    if (payload.teacherId) {
      const teacher = await this.prisma.user.findUnique({
        where: { id: payload.teacherId },
        select: { id: true, role: true },
      });

      if (!teacher || teacher.role !== Role.TEACHER) {
        throw new BadRequestException('Teacher not found');
      }
    }

    if (payload.maxStudents !== undefined && payload.maxStudents < 1) {
      throw new BadRequestException('maxStudents must be greater than zero');
    }

    return this.prisma.class.update({
      where: { id: classId },
      data: payload,
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        students: { select: { id: true, name: true } },
      },
    });
  }

  async delete(classId: string, schoolId?: string) {
    const existing = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { students: { select: { id: true } }, academicYear: { select: { schoolId: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Class not found');
    }

    if (schoolId && existing.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Class does not belong to this school');
    }

    if (existing.students && existing.students.length > 0) {
      throw new BadRequestException(
        'Cannot delete class with enrolled students',
      );
    }

    await this.prisma.class.delete({
      where: { id: classId },
    });

    return { message: 'Class deleted successfully' };
  }

  async enrollStudent(classId: string, studentId: string, schoolId?: string) {
    const classExists = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { students: { select: { id: true } }, academicYear: { select: { schoolId: true } } },
    });

    if (!classExists) {
      throw new NotFoundException('Class not found');
    }

    if (schoolId && classExists.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Class does not belong to this school');
    }

    if (
      classExists.maxStudents &&
      classExists.students.length >= classExists.maxStudents
    ) {
      throw new BadRequestException('Class is full');
    }

    if (classExists.students.some((s) => s.id === studentId)) {
      throw new BadRequestException('Student already enrolled in this class');
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
    });
  }

  async removeStudent(classId: string, studentId: string, schoolId?: string) {
    const classExists = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, academicYear: { select: { schoolId: true } } },
    });

    if (!classExists) {
      throw new NotFoundException('Class not found');
    }

    if (schoolId && classExists.academicYear.schoolId !== schoolId) {
      throw new ForbiddenException('Class does not belong to this school');
    }

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
    });
  }

  async findByTeacher(teacherId: string) {
    return this.prisma.class.findMany({
      where: { teacherId },
      include: {
        teacher: { select: { id: true, name: true } },
        students: { select: { id: true, email: true, name: true } },
        series: { select: { id: true, name: true } },
        academicYear: { select: { id: true, year: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findAll(academicYearId?: string, seriesId?: string, schoolId?: string) {
    const where: any = {};

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    if (seriesId) {
      where.seriesId = seriesId;
    }

    if (schoolId) {
      where.academicYear = { ...(where.academicYear ?? {}), schoolId };
    }

    return this.prisma.class.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        students: { select: { id: true, name: true } },
        series: { select: { id: true, name: true } },
        academicYear: { select: { year: true } },
      },
      orderBy: [{ academicYear: { year: 'desc' } }, { name: 'asc' }],
    });
  }

  async findById(classId: string, schoolId?: string) {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        academicYear: { select: { id: true, schoolId: true, year: true } },
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
    });

    if (!classData) {
      throw new NotFoundException('Class not found');
    }

    if (schoolId && classData.academicYear?.schoolId && classData.academicYear.schoolId !== schoolId) {
      throw new NotFoundException('Class not found');
    }

    return classData;
  }

  async findByStudent(studentId: string, schoolId?: string) {
    return this.prisma.class.findMany({
      where: {
        students: { some: { id: studentId } },
        ...(schoolId ? { academicYear: { schoolId } } : {}),
      },
      include: {
        teacher: { select: { id: true, name: true } },
        series: { select: { id: true, name: true } },
        academicYear: { select: { id: true, year: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listAcademicYears(schoolId?: string) {
    return this.prisma.academicYear.findMany({
      where: schoolId ? { schoolId } : undefined,
      select: {
        id: true,
        year: true,
        startDate: true,
        endDate: true,
        isActive: true,
      },
      orderBy: { year: 'desc' },
    });
  }

  async listSeries(academicYearId?: string, schoolId?: string) {
    const where: any = academicYearId ? { academicYearId } : {};

    if (schoolId) {
      where.academicYear = { schoolId };
    }

    return this.prisma.series.findMany({
      where,
      select: {
        id: true,
        name: true,
        academicYearId: true,
        academicYear: { select: { id: true, year: true } },
      },
      orderBy: [{ academicYear: { year: 'desc' } }, { name: 'asc' }],
    });
  }
}
