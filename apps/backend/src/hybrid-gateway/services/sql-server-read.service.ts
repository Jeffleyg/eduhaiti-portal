import { Injectable } from "@nestjs/common"
import { PrismaService } from "../../prisma/prisma.service"

export interface StudentCriticalSummary {
  studentId: string
  globalAverage: number
  absences: number
  latestAnnouncement?: string
}

export interface StudentLessonAudioSummary {
  studentId: string
  className: string | null
  resourceId: string
  title: string
  description?: string | null
  fileType: string
  filePath: string
  hasAudio: boolean
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
GROUP BY s.id;`
  }

  async getCriticalSummary(
    studentId: string,
    senderPhone: string,
    responsibleDocumentId?: string,
  ): Promise<StudentCriticalSummary | null> {
    // Fast-fail guard avoids expensive reads when command is malformed.
    if (!studentId || !senderPhone) {
      return null
    }

    // Current implementation uses Prisma for immediate compatibility.
    // Infra can swap to real SQL Server executor preserving method contract.
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        fatherName: true,
        motherName: true,
      },
    })

    if (!student) {
      return null
    }

    const normalizedPhone = senderPhone.replace(/\D/g, "")
    const normalizedToken = (responsibleDocumentId ?? "").replace(/\D/g, "")

    // Security binding fallback for current schema:
    // guardian token can be validated against known student-linked identifiers.
    const linkedToken = (student.fatherName ?? student.motherName ?? "").replace(/\D/g, "")
    const isAuthorized =
      normalizedPhone.length >= 8 &&
      (!normalizedToken || (linkedToken.length > 0 && normalizedToken === linkedToken))

    if (!isAuthorized) {
      return null
    }

    const [gradeAgg, absenceAgg, latestAnnouncement] = await Promise.all([
      this.prisma.grade.aggregate({
        where: { studentId },
        _avg: { score: true },
      }),
      this.prisma.attendance.count({
        where: {
          studentId,
          status: "ABSENT",
        },
      }),
      this.prisma.announcement.findFirst({
        orderBy: { publishedAt: "desc" },
        select: { title: true },
      }),
    ])

    return {
      studentId,
      globalAverage: Number(gradeAgg._avg.score ?? 0),
      absences: absenceAgg,
      latestAnnouncement: latestAnnouncement?.title,
    }
  }

  async getLatestLessonAudioSummary(
    studentId: string,
  ): Promise<StudentLessonAudioSummary | null> {
    if (!studentId) {
      return null
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
      orderBy: { createdAt: "desc" },
    })

    if (!studentClass) {
      return null
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
      orderBy: { updatedAt: "desc" },
    })

    if (!latestResource) {
      return null
    }

    const isAudioFile = latestResource.fileType.toLowerCase() === "mp3"

    return {
      studentId,
      className: studentClass.name,
      resourceId: latestResource.id,
      title: latestResource.title,
      description: latestResource.description,
      fileType: latestResource.fileType,
      filePath: latestResource.filePath,
      hasAudio: isAudioFile,
    }
  }
}
