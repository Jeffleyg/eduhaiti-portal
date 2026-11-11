import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type ClassRequester = {
  sub?: string;
  role?: Role | string;
  schoolId?: string | null;
};

/**
 * Centralises "can this user manage this class?" checks.
 * - TEACHER: only classes where they are the assigned teacher.
 * - ADMIN: only classes belonging to their own school; an admin without a school gets nothing.
 * - OWNER: unrestricted.
 */
@Injectable()
export class ClassAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanManageClass(classId: string, user?: ClassRequester) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    const classRow = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        teacherId: true,
        academicYear: { select: { schoolId: true } },
      },
    });

    if (!classRow) {
      throw new NotFoundException('Class not found');
    }

    if (user.role === Role.OWNER) {
      return classRow;
    }

    if (user.role === Role.TEACHER) {
      if (classRow.teacherId !== user.sub) {
        throw new ForbiddenException('Teacher can only manage own classes');
      }
      return classRow;
    }

    if (user.role === Role.ADMIN) {
      if (!user.schoolId || classRow.academicYear?.schoolId !== user.schoolId) {
        throw new ForbiddenException('Class belongs to another school');
      }
      return classRow;
    }

    throw new ForbiddenException('Not allowed to manage this class');
  }

  /**
   * Read access: anyone who can manage the class, plus students enrolled in it.
   */
  async assertCanViewClass(classId: string, user?: ClassRequester) {
    if (user?.role === Role.STUDENT) {
      const enrolled = await this.prisma.class.findFirst({
        where: { id: classId, students: { some: { id: user.sub } } },
        select: { id: true },
      });
      if (!enrolled) {
        throw new ForbiddenException('Student is not enrolled in this class');
      }
      return;
    }
    await this.assertCanManageClass(classId, user);
  }

  async assertSeriesInSchool(seriesId: string, user?: ClassRequester) {
    const series = await this.prisma.series.findUnique({
      where: { id: seriesId },
      select: { academicYear: { select: { schoolId: true } } },
    });
    if (!series) {
      throw new NotFoundException('Series not found');
    }
    if (
      user?.role !== Role.OWNER &&
      (!user?.schoolId || series.academicYear?.schoolId !== user.schoolId)
    ) {
      throw new ForbiddenException('Series belongs to another school');
    }
  }

  async assertDisciplineInSchool(disciplineId: string, user?: ClassRequester) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id: disciplineId },
      select: { seriesId: true },
    });
    if (!discipline) {
      throw new NotFoundException('Discipline not found');
    }
    await this.assertSeriesInSchool(discipline.seriesId, user);
  }

  async assertCanManageGrade(gradeId: string, user?: ClassRequester) {
    const grade = await this.prisma.grade.findUnique({
      where: { id: gradeId },
      select: { classId: true },
    });
    if (!grade) {
      throw new NotFoundException('Grade not found');
    }
    await this.assertCanManageClass(grade.classId, user);
  }

  async assertCanManageAssignment(assignmentId: string, user?: ClassRequester) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { classId: true },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    await this.assertCanManageClass(assignment.classId, user);
  }

  async assertCanManageSubmission(
    assignmentId: string,
    submissionId: string,
    user?: ClassRequester,
  ) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      select: { assignmentId: true },
    });
    if (!submission || submission.assignmentId !== assignmentId) {
      throw new NotFoundException('Submission not found');
    }
    await this.assertCanManageAssignment(assignmentId, user);
  }

  async assertCanManageResource(resourceId: string, user?: ClassRequester) {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      select: { classId: true },
    });
    if (!resource) {
      throw new NotFoundException('Resource not found');
    }
    await this.assertCanManageClass(resource.classId, user);
  }
}
