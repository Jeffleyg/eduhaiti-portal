import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class FamilyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private normalize(value: string) {
    return value.trim().toLowerCase()
  }

  private ensureGuardianMatch(student: { fatherName: string | null; motherName: string | null }, guardianName?: string) {
    if (!guardianName?.trim()) {
      throw new BadRequestException("guardianName is required")
    }

    const normalized = this.normalize(guardianName)
    const allowed = [student.fatherName, student.motherName]
      .filter(Boolean)
      .map((item) => this.normalize(item as string))

    if (!allowed.length || !allowed.includes(normalized)) {
      throw new BadRequestException("Guardian name does not match student records")
    }
  }

  private async getStudentByEnrollment(enrollmentNumber: string) {
    const student = await this.prisma.user.findFirst({
      where: {
        enrollmentNumber,
        role: "STUDENT",
      },
      select: {
        id: true,
        name: true,
        email: true,
        enrollmentNumber: true,
        fatherName: true,
        motherName: true,
      },
    })

    if (!student) {
      throw new NotFoundException("Student not found")
    }

    return student
  }

  private async getStudentSchoolId(studentId: string) {
    const classWithSchool = await this.prisma.class.findFirst({
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
      orderBy: {
        createdAt: "desc",
      },
    })

    return classWithSchool?.academicYear.schoolId ?? null
  }

  async getFamilyOverview(enrollmentNumber: string, guardianName?: string) {
    const student = await this.getStudentByEnrollment(enrollmentNumber)
    this.ensureGuardianMatch(student, guardianName)

    const schoolId = await this.getStudentSchoolId(student.id)

    const [classes, grades, attendance, announcements, notices] = await Promise.all([
      this.prisma.class.findMany({
        where: { students: { some: { id: student.id } } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.grade.findMany({
        where: {
          studentId: student.id,
          status: "PUBLISHED",
        },
        select: {
          id: true,
          score: true,
          maxScore: true,
          createdAt: true,
          discipline: { select: { name: true } },
          class: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      this.prisma.attendance.findMany({
        where: { studentId: student.id },
        select: {
          id: true,
          date: true,
          status: true,
          remarks: true,
          class: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: 40,
      }),
      schoolId
        ? this.prisma.announcement.findMany({
            where: { schoolId },
            select: {
              id: true,
              title: true,
              content: true,
              type: true,
              publishedAt: true,
            },
            orderBy: { publishedAt: "desc" },
            take: 8,
          })
        : Promise.resolve([]),
      this.prisma.auditLog.findMany({
        where: {
          entityType: "FAMILY_NOTICE",
          entityId: student.id,
          action: "CREATE",
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ])

    const parsedNotices = notices
      .map((item) => {
        try {
          return {
            id: item.id,
            createdAt: item.createdAt,
            ...(JSON.parse(item.changes) as Record<string, unknown>),
          }
        } catch {
          return null
        }
      })
      .filter(Boolean)

    return {
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        enrollmentNumber: student.enrollmentNumber,
        classes,
      },
      grades,
      attendance,
      announcements,
      familyNotices: parsedNotices,
    }
  }

  async createFamilyContactRequest(payload: {
    enrollmentNumber: string
    guardianName: string
    guardianPhone?: string
    subject: string
    body: string
    urgent?: boolean
  }) {
    const student = await this.getStudentByEnrollment(payload.enrollmentNumber)
    this.ensureGuardianMatch(student, payload.guardianName)

    const subject = payload.subject?.trim()
    const body = payload.body?.trim()

    if (!subject || !body) {
      throw new BadRequestException("subject and body are required")
    }

    await this.prisma.auditLog.create({
      data: {
        entityType: "FAMILY_CONTACT_REQUEST",
        entityId: student.id,
        action: "CREATE",
        changes: JSON.stringify({
          enrollmentNumber: payload.enrollmentNumber,
          guardianName: payload.guardianName,
          guardianPhone: payload.guardianPhone ?? null,
          subject,
          body,
          urgent: Boolean(payload.urgent),
        }),
      },
    })

    const admins = await this.prisma.user.findMany({
      where: {
        role: "ADMIN",
        isActive: true,
      },
      select: { id: true },
      take: 20,
    })

    if (admins.length > 0) {
      await this.prisma.message.createMany({
        data: admins.map((admin) => ({
          fromId: student.id,
          toId: admin.id,
          subject: `[FAMILIA] ${subject}`,
          body: `${body}\n\nResponsavel: ${payload.guardianName}${payload.guardianPhone ? ` | Tel: ${payload.guardianPhone}` : ""}${payload.urgent ? " | URGENTE" : ""}`,
        })),
      })
    }

    return { success: true }
  }

  async createSchoolFamilyNotice(payload: {
    enrollmentNumber: string
    title: string
    body: string
    severity?: "normal" | "urgent"
    channel?: "IN_APP" | "SMS" | "BOTH"
    guardianPhone?: string
    actorId: string
  }) {
    const student = await this.getStudentByEnrollment(payload.enrollmentNumber)

    const title = payload.title?.trim()
    const body = payload.body?.trim()

    if (!title || !body) {
      throw new BadRequestException("title and body are required")
    }

    const severity = payload.severity ?? "normal"
    const channel = payload.channel ?? "IN_APP"

    await this.prisma.auditLog.create({
      data: {
        entityType: "FAMILY_NOTICE",
        entityId: student.id,
        action: "CREATE",
        userId: payload.actorId,
        changes: JSON.stringify({
          title,
          body,
          severity,
          channel,
          guardianPhone: payload.guardianPhone ?? null,
          smsQueued: channel === "SMS" || channel === "BOTH",
        }),
      },
    })

    if (channel === "IN_APP" || channel === "BOTH") {
      await this.prisma.message.create({
        data: {
          fromId: payload.actorId,
          toId: student.id,
          subject: `[ESCOLA] ${title}`,
          body,
        },
      })
    }

    return { success: true }
  }
}
