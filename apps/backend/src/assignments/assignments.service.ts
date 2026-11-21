import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { displayName, removeStoredFile } from './assignment-files';

export type AssignmentRequester = {
  sub?: string;
  role?: Role | string;
  schoolId?: string | null;
};

const studentSelect = { select: { id: true, name: true, email: true } };

const assignmentInclude = {
  createdBy: studentSelect,
  submissions: { include: { student: studentSelect } },
};

/** Adds the user-facing file names (without the generated storage prefix). */
function withFileNames<
  T extends { filePath?: string | null; submissions?: { filePath: string }[] },
>(assignment: T) {
  return {
    ...assignment,
    fileName: displayName(assignment.filePath),
    ...(assignment.submissions && {
      submissions: assignment.submissions.map((submission) => ({
        ...submission,
        fileName: displayName(submission.filePath),
      })),
    }),
  };
}

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
    const assignment = await this.prisma.assignment.create({
      data: {
        classId,
        title,
        description,
        dueDate,
        filePath,
        createdById,
      },
      include: assignmentInclude,
    });
    return withFileNames(assignment);
  }

  /**
   * Assignments of a class (the caller was already checked against the class).
   * Hand-ins are private: a student only gets their own, and only the teacher
   * who created the assignment receives the others.
   */
  async findByClass(classId: string, user?: AssignmentRequester) {
    const rows = await this.prisma.assignment.findMany({
      where: { classId },
      include: assignmentInclude,
      orderBy: { dueDate: 'asc' },
    });

    return rows.map((row) => {
      if (user?.role === Role.STUDENT) {
        return withFileNames({
          ...row,
          submissions: row.submissions.filter((s) => s.studentId === user.sub),
        });
      }
      const isCreator = !!user?.sub && row.createdById === user.sub;
      return withFileNames({
        ...row,
        submissionCount: row.submissions.length,
        submissions: isCreator ? row.submissions : [],
      });
    });
  }

  async findById(assignmentId: string) {
    return this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: assignmentInclude,
    });
  }

  async findForStudent(studentId: string) {
    // Only assignments of the classes the student is enrolled in
    const classes = await this.prisma.class.findMany({
      where: { students: { some: { id: studentId } } },
      select: { id: true },
    });

    const classIds = classes.map((c) => c.id);

    const rows = await this.prisma.assignment.findMany({
      where: { classId: { in: classIds } },
      include: {
        createdBy: studentSelect,
        class: { select: { id: true, name: true } },
        submissions: {
          where: { studentId },
          include: { student: studentSelect },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
    return rows.map(withFileNames);
  }

  /** The teacher's document of an assignment (access to the class is checked by the caller). */
  async findAssignmentFile(assignmentId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, classId: true, filePath: true },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (!assignment.filePath) {
      throw new NotFoundException('This assignment has no attached document');
    }
    return assignment as { id: string; classId: string; filePath: string };
  }

  /** Only the teacher who created the assignment receives its hand-ins. */
  async assertIsCreator(assignmentId: string, user?: AssignmentRequester) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { createdById: true },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (!user?.sub || assignment.createdById !== user.sub) {
      throw new ForbiddenException(
        'Only the teacher who created this assignment can access its submissions',
      );
    }
  }

  async listSubmissions(assignmentId: string, user?: AssignmentRequester) {
    await this.assertIsCreator(assignmentId, user);
    const rows = await this.prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: { student: studentSelect },
      orderBy: { submittedAt: 'desc' },
    });
    return rows.map((row) => ({ ...row, fileName: displayName(row.filePath) }));
  }

  /**
   * A hand-in can be read by the student who sent it and by the teacher who
   * created the assignment; nobody else (not even classmates).
   */
  async findSubmissionFile(
    assignmentId: string,
    submissionId: string,
    user?: AssignmentRequester,
  ) {
    const submission = await this.prisma.assignmentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        assignmentId: true,
        studentId: true,
        filePath: true,
        assignment: { select: { createdById: true } },
      },
    });
    if (!submission || submission.assignmentId !== assignmentId) {
      throw new NotFoundException('Submission not found');
    }
    const isOwner = !!user?.sub && submission.studentId === user.sub;
    const isCreator =
      !!user?.sub && submission.assignment.createdById === user.sub;
    if (!isOwner && !isCreator) {
      throw new ForbiddenException('Not allowed to read this submission');
    }
    return submission;
  }

  /**
   * Only students enrolled in the assignment's class can hand it in. Sending
   * again replaces the previous document (the student "edits" the hand-in)
   * until the teacher grades it.
   */
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
        class: {
          select: {
            students: { where: { id: studentId }, select: { id: true } },
          },
        },
      },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
    if (assignment.class.students.length === 0) {
      throw new ForbiddenException('Student is not enrolled in this class');
    }

    const previous = await this.prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      select: { filePath: true, grade: true },
    });
    if (previous && previous.grade != null) {
      throw new BadRequestException(
        'This submission was already graded and can no longer be changed',
      );
    }

    const status = new Date() > assignment.dueDate ? 'LATE' : 'SUBMITTED';

    const saved = await this.prisma.assignmentSubmission.upsert({
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
      include: { student: studentSelect },
    });

    if (previous?.filePath && previous.filePath !== filePath) {
      removeStoredFile(previous.filePath);
    }
    return { ...saved, fileName: displayName(saved.filePath) };
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

  /** Deletes the assignment, its hand-ins (cascade) and their documents. */
  async delete(assignmentId: string) {
    const files = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: { filePath: true, submissions: { select: { filePath: true } } },
    });
    const deleted = await this.prisma.assignment.delete({
      where: { id: assignmentId },
    });
    removeStoredFile(files?.filePath);
    files?.submissions.forEach((s) => removeStoredFile(s.filePath));
    return deleted;
  }
}
