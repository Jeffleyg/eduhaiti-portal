import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamificationService {
  private readonly POINTS_PER_PERFECT_CLASS = 100;
  private readonly POINTS_PER_EARLY_SUBMISSION = 20;

  constructor(private readonly prisma: PrismaService) {}

  async getStudentSummary(studentId: string) {
    return this.computeSummary(studentId);
  }

  async getClassLeaderboard(
    classId: string,
    requester: { id: string; role: Role },
  ) {
    const classRow = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        teacherId: true,
        students: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!classRow) {
      throw new NotFoundException('Class not found');
    }

    if (
      requester.role === Role.TEACHER &&
      classRow.teacherId &&
      classRow.teacherId !== requester.id
    ) {
      throw new ForbiddenException('Not allowed to access this class leaderboard');
    }

    const ranked = await Promise.all(
      classRow.students.map(async (student) => {
        const summary = await this.computeSummary(student.id, classId);
        return {
          student,
          points: summary.points,
          badges: summary.badges,
          attendanceRate: summary.attendanceRate,
          earlySubmissions: summary.earlySubmissions,
        };
      }),
    );

    return {
      classId: classRow.id,
      className: classRow.name,
      leaderboard: ranked.sort((a, b) => b.points - a.points),
    };
  }

  private async computeSummary(studentId: string, classId?: string) {
    const [attendanceRows, submissions] = await Promise.all([
      this.prisma.attendance.findMany({
        where: {
          studentId,
          ...(classId ? { classId } : {}),
        },
        select: {
          classId: true,
          status: true,
        },
      }),
      this.prisma.assignmentSubmission.findMany({
        where: {
          studentId,
          ...(classId ? { assignment: { classId } } : {}),
        },
        select: {
          submittedAt: true,
          assignment: {
            select: {
              classId: true,
              dueDate: true,
            },
          },
        },
      }),
    ]);

    const attendanceByClass = new Map<
      string,
      { total: number; absences: number; presents: number }
    >();

    for (const row of attendanceRows) {
      const current = attendanceByClass.get(row.classId) ?? {
        total: 0,
        absences: 0,
        presents: 0,
      };
      current.total += 1;
      if (row.status === AttendanceStatus.ABSENT) {
        current.absences += 1;
      }
      if (row.status === AttendanceStatus.PRESENT) {
        current.presents += 1;
      }
      attendanceByClass.set(row.classId, current);
    }

    const perfectAttendanceClasses = Array.from(attendanceByClass.values()).filter(
      (row) => row.total > 0 && row.absences === 0,
    ).length;

    const earlySubmissions = submissions.filter(
      (submission) => submission.submittedAt <= submission.assignment.dueDate,
    ).length;

    const attendancePoints =
      perfectAttendanceClasses * this.POINTS_PER_PERFECT_CLASS;
    const assignmentPoints =
      earlySubmissions * this.POINTS_PER_EARLY_SUBMISSION;

    const totalAttendance = attendanceRows.length;
    const presentAttendance = attendanceRows.filter(
      (row) => row.status === AttendanceStatus.PRESENT,
    ).length;
    const attendanceRate =
      totalAttendance > 0
        ? Math.round((presentAttendance / totalAttendance) * 100)
        : 0;

    return {
      points: attendancePoints + assignmentPoints,
      attendancePoints,
      assignmentPoints,
      perfectAttendanceClasses,
      earlySubmissions,
      attendanceRate,
      badges: this.buildBadges({
        perfectAttendanceClasses,
        earlySubmissions,
        attendanceRate,
      }),
    };
  }

  private buildBadges(params: {
    perfectAttendanceClasses: number;
    earlySubmissions: number;
    attendanceRate: number;
  }) {
    const badges = [] as Array<{
      code: string;
      name: string;
      description: string;
    }>;

    if (params.perfectAttendanceClasses > 0) {
      badges.push({
        code: 'PERFECT_ATTENDANCE',
        name: 'Presenca Exemplar',
        description:
          'Sem faltas em pelo menos uma turma no periodo avaliado.',
      });
    }

    if (params.earlySubmissions >= 3) {
      badges.push({
        code: 'EARLY_SUBMITTER',
        name: 'Entrega Antecipada',
        description:
          'Pelo menos 3 tarefas enviadas antes do prazo final.',
      });
    }

    if (params.attendanceRate >= 95) {
      badges.push({
        code: 'CONSISTENT',
        name: 'Constancia Academica',
        description: 'Taxa de presenca igual ou superior a 95%.',
      });
    }

    return badges;
  }
}
