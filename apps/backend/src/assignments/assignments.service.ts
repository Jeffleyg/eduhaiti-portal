import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    classId: string,
    title: string,
    description: string | undefined,
    dueDate: Date,
    filePath: string | undefined,
    createdById: string,
  ) {
    return this.prisma.assignment.create({
      data: {
        classId,
        title,
        description,
        dueDate,
        filePath,
        createdById,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        submissions: {
          include: {
            student: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
  }

  async findByClass(classId: string) {
    return this.prisma.assignment.findMany({
      where: { classId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        submissions: {
          include: {
            student: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findById(assignmentId: string) {
    return this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        submissions: {
          include: {
            student: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
  }

  async findForStudent(studentId: string) {
    // Get all assignments from classes the student is in
    const classes = await this.prisma.class.findMany({
      where: {
        students: {
          some: {
            id: studentId,
          },
        },
      },
      select: { id: true },
    });

    const classIds = classes.map((c) => c.id);

    return this.prisma.assignment.findMany({
      where: {
        classId: { in: classIds },
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        submissions: {
          where: { studentId },
          include: {
            student: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  /** Only students enrolled in the assignment's class can hand it in. */
  async submitAssignment(
    assignmentId: string,
    studentId: string,
    filePath: string,
  ) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id: assignmentId },
      select: {
        id: true,
        dueDate: true,
        class: { select: { students: { where: { id: studentId }, select: { id: true } } } },
      },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (assignment.class.students.length === 0) {
      throw new ForbiddenException('Student is not enrolled in this class');
    }

    const status = new Date() > assignment.dueDate ? 'LATE' : 'SUBMITTED';

    return this.prisma.assignmentSubmission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId,
        },
      },
      update: {
        filePath,
        submittedAt: new Date(),
        status,
      },
      create: {
        assignmentId,
        studentId,
        filePath,
        status,
      },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async update(
    assignmentId: string,
    title: string,
    description: string | undefined,
    dueDate: Date,
  ) {
    return this.prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        title,
        description,
        dueDate,
      },
    });
  }

  async gradeSubmission(
    submissionId: string,
    grade: number,
    feedback: string | undefined,
  ) {
    return this.prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        grade,
        feedback,
      },
    });
  }

  async delete(assignmentId: string) {
    return this.prisma.assignment.delete({
      where: { id: assignmentId },
    });
  }
}
