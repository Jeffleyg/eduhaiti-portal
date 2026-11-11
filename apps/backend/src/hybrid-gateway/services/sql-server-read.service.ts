import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface StudentCriticalSummary {
  studentId: string;
  globalAverage: number;
  absences: number;
  passAverage: number;
  approvalStatus: 'APROVADO' | 'REPROVADO';
  latestAnnouncement?: string;
}

export interface StudentLessonAudioSummary {
  studentId: string;
  className: string | null;
  resourceId: string;
  title: string;
  description?: string | null;
  fileType: string;
  filePath: string;
  hasAudio: boolean;
}

/** Minimum digits for a phone number to be considered (Haitian local numbers have 8). */
const MIN_PHONE_DIGITS = 8;

function digitsOnly(value?: string | null) {
  return (value ?? '').replace(/\D/g, '');
}

/**
 * Compares two phone numbers ignoring formatting and an optional country code,
 * e.g. "+509 3712-3456" matches "37123456".
 */
export function phonesMatch(a?: string | null, b?: string | null) {
  const left = digitsOnly(a);
  const right = digitsOnly(b);
  if (left.length < MIN_PHONE_DIGITS || right.length < MIN_PHONE_DIGITS) {
    return false;
  }
  return left === right || left.endsWith(right) || right.endsWith(left);
}

@Injectable()
export class SqlServerReadService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * SQL Server-optimized query shape for infra teams using mssql driver.
   * Keep payload narrow to reduce mobile network latency.
   */
  buildOptimizedSqlServerQuery(): string {
    return `
SELECT TOP 1
  s.id AS studentId,
  CAST(AVG(g.score) AS DECIMAL(5,2)) AS globalAverage,
  SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) AS absences
FROM Students s
LEFT JOIN Grades g ON g.student_id = s.id
LEFT JOIN Attendance a ON a.student_id = s.id
INNER JOIN GuardiansStudents gs ON gs.student_id = s.id
INNER JOIN Guardians gu ON gu.id = gs.guardian_id
WHERE s.id = @studentId
  AND gu.phone_number = @senderPhone
  AND (@responsibleDocumentId IS NULL OR gu.document_id = @responsibleDocumentId)
GROUP BY s.id;`;
  }

  async getCriticalSummary(
    studentId: string,
    senderPhone: string,
    responsibleDocumentId?: string,
  ): Promise<StudentCriticalSummary | null> {
    // Fast-fail guard avoids expensive reads when command is malformed.
    if (!studentId || !senderPhone) {
      return null;
    }

    // Mirrors buildOptimizedSqlServerQuery(): the caller's phone must belong to a
    // guardian linked to this student, and the document id (when sent) must match.
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        guardianLinks: {
          select: {
            guardian: { select: { phoneNumber: true, documentId: true } },
          },
        },
      },
    });

    if (!student) {
      return null;
    }

    const normalizedToken = digitsOnly(responsibleDocumentId);
    const isAuthorized = student.guardianLinks.some(({ guardian }) => {
      if (!phonesMatch(senderPhone, guardian.phoneNumber)) {
        return false;
      }
      if (!normalizedToken) {
        return true;
      }
      return digitsOnly(guardian.documentId) === normalizedToken;
    });

    if (!isAuthorized) {
      return null;
    }

    const [gradeAgg, absenceAgg, latestAnnouncement, latestClass] =
      await Promise.all([
        this.prisma.grade.aggregate({
          where: { studentId },
          _avg: { score: true },
        }),
        this.prisma.attendance.count({
          where: {
            studentId,
            status: 'ABSENT',
          },
        }),
        this.prisma.announcement.findFirst({
          orderBy: { publishedAt: 'desc' },
          select: { title: true },
        }),
        this.prisma.class.findFirst({
          where: {
            students: {
              some: { id: studentId },
            },
          },
          select: {
            academicYear: {
              select: {
                schoolId: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    const { academicYear } = latestClass ?? {};
    const schoolId = academicYear?.schoolId;
    const settings = schoolId
      ? await this.prisma.academicSetting.findUnique({
          where: { schoolId },
          select: { passAverage: true },
        })
      : null;

    const globalAverage = Number(gradeAgg._avg.score ?? 0);
    const passAverage = Number(settings?.passAverage ?? 10);
    const approvalStatus =
      globalAverage >= passAverage ? 'APROVADO' : 'REPROVADO';

    return {
      studentId,
      globalAverage,
      absences: absenceAgg,
      passAverage,
      approvalStatus,
      latestAnnouncement: latestAnnouncement?.title,
    };
  }

  async getLatestLessonAudioSummary(
    studentId: string,
  ): Promise<StudentLessonAudioSummary | null> {
    if (!studentId) {
      return null;
    }

    const studentClass = await this.prisma.class.findFirst({
      where: {
        students: {
          some: { id: studentId },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!studentClass) {
      return null;
    }

    const latestResource = await this.prisma.resource.findFirst({
      where: {
        classId: studentClass.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        fileType: true,
        filePath: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!latestResource) {
      return null;
    }

    const isAudioFile = latestResource.fileType.toLowerCase() === 'mp3';

    return {
      studentId,
      className: studentClass.name,
      resourceId: latestResource.id,
      title: latestResource.title,
      description: latestResource.description,
      fileType: latestResource.fileType,
      filePath: latestResource.filePath,
      hasAudio: isAudioFile,
    };
  }
}
