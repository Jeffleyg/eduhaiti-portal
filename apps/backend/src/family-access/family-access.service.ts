import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildAuditData, safeParseJson } from '../common/audit-compat';
import { HybridOutboundSmsService } from '../hybrid-gateway/services/hybrid-outbound-sms.service';

@Injectable()
export class FamilyAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboundSms: HybridOutboundSmsService,
  ) {}

  /** Staff endpoints only ever act inside the caller's own school. */
  private requireSchool(schoolId?: string | null): string {
    if (!schoolId) {
      throw new ForbiddenException('User is not linked to a school');
    }
    return schoolId;
  }

  private parseAuditChanges = (changes: unknown) =>
    safeParseJson<Record<string, unknown>>(changes);

  private async getStudentByEnrollment(enrollmentNumber: string) {
    const student = await this.prisma.user.findFirst({
      where: {
        enrollmentNumber,
        role: 'STUDENT',
      },
      select: {
        id: true,
        name: true,
        email: true,
        enrollmentNumber: true,
        fatherName: true,
        motherName: true,
        schoolId: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  private async getStudentById(studentId: string) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, role: 'STUDENT' },
      select: {
        id: true,
        name: true,
        email: true,
        enrollmentNumber: true,
        fatherName: true,
        motherName: true,
        schoolId: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  /** The student's school, falling back to the school of their latest class. */
  private async resolveStudentSchoolId(student: { id: string; schoolId?: string | null }) {
    return student.schoolId ?? (await this.getStudentSchoolId(student.id));
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
        createdAt: 'desc',
      },
    });

    return classWithSchool?.academicYear.schoolId ?? null;
  }

  /** Overview of the student bound to a verified family session. */
  async getFamilyOverview(studentId: string) {
    const student = await this.getStudentById(studentId);

    const schoolId = await this.resolveStudentSchoolId(student);

    const [classes, grades, attendance, announcements, notices] =
      await Promise.all([
        this.prisma.class.findMany({
          where: { students: { some: { id: student.id } } },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        this.prisma.grade.findMany({
          where: {
            studentId: student.id,
            status: 'PUBLISHED',
          },
          select: {
            id: true,
            score: true,
            maxScore: true,
            createdAt: true,
            discipline: { select: { name: true } },
            class: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
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
          orderBy: { date: 'desc' },
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
              orderBy: { publishedAt: 'desc' },
              take: 8,
            })
          : Promise.resolve([]),
        this.prisma.auditLog.findMany({
          where: {
            entityType: 'FAMILY_NOTICE',
            entityId: student.id,
            action: 'CREATE',
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);

    const parsedNotices = notices
      .map((item) => {
        const payload = this.parseAuditChanges(item.changes);
        if (!payload) return null;
        return {
          id: item.id,
          createdAt: item.createdAt,
          ...payload,
        };
      })
      .filter(Boolean);

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
    };
  }

  /** Contact request from a verified family session (guardian identity comes from it). */
  async createFamilyContactRequest(payload: {
    studentId: string;
    guardianName: string;
    guardianPhone?: string;
    subject: string;
    body: string;
    urgent?: boolean;
  }) {
    const student = await this.getStudentById(payload.studentId);

    const subject = payload.subject?.trim();
    const body = payload.body?.trim();

    if (!subject || !body) {
      throw new BadRequestException('subject and body are required');
    }

    await this.prisma.auditLog.create({
      data: buildAuditData({
        entityType: 'FAMILY_CONTACT_REQUEST',
        entityId: student.id,
        action: 'CREATE',
        changes: {
          enrollmentNumber: student.enrollmentNumber,
          guardianName: payload.guardianName,
          guardianPhone: payload.guardianPhone ?? null,
          subject,
          body,
          urgent: Boolean(payload.urgent),
        },
      }),
    });

    // Only the student's own school secretariat receives the request.
    const schoolId = await this.resolveStudentSchoolId(student);
    const admins = schoolId
      ? await this.prisma.user.findMany({
          where: {
            role: 'ADMIN',
            isActive: true,
            schoolId,
          },
          select: { id: true },
          take: 20,
        })
      : [];

    if (admins.length > 0) {
      await this.prisma.message.createMany({
        data: admins.map((admin) => ({
          fromId: student.id,
          toId: admin.id,
          subject: `[FAMILIA] ${subject}`,
          body: `${body}\n\nResponsavel: ${payload.guardianName}${payload.guardianPhone ? ` | Tel: ${payload.guardianPhone}` : ''}${payload.urgent ? ' | URGENTE' : ''}`,
        })),
      });
    }

    return { success: true };
  }

  async listFamilyContactRequests(callerSchoolId?: string | null) {
    const schoolId = this.requireSchool(callerSchoolId);
    // Filter in the query: taking the latest 100 platform-wide and filtering afterwards
    // let busy schools hide another school's requests.
    const schoolStudents = await this.prisma.user.findMany({
      where: { role: 'STUDENT', schoolId },
      select: { id: true },
    });
    if (schoolStudents.length === 0) {
      return [];
    }

    const requests = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'FAMILY_CONTACT_REQUEST',
        action: 'CREATE',
        entityId: { in: schoolStudents.map((student) => student.id) },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (requests.length === 0) {
      return [];
    }

    const studentIds = Array.from(
      new Set(requests.map((item) => item.entityId).filter(Boolean)),
    ) as string[];
    const requestIds = requests.map((item) => item.id);

    const [students, responses] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: studentIds } },
        select: {
          id: true,
          name: true,
          email: true,
          enrollmentNumber: true,
          schoolId: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          entityType: 'FAMILY_CONTACT_REQUEST',
          action: 'RESPOND',
          entityId: { in: requestIds },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const studentById = new Map(
      students.map((student) => [student.id, student]),
    );
    const latestResponseByRequestId = new Map<
      string,
      (typeof responses)[number]
    >();

    for (const response of responses) {
      if (!response.entityId) continue;
      if (!latestResponseByRequestId.has(response.entityId)) {
        latestResponseByRequestId.set(response.entityId, response);
      }
    }

    return requests.map((request) => {
      const payload = this.parseAuditChanges(request.changes);
      const response = latestResponseByRequestId.get(request.id);
      const responsePayload = response
        ? this.parseAuditChanges(response.changes)
        : null;
      const student = request.entityId ? studentById.get(request.entityId) : null;

      return {
        requestId: request.id,
        createdAt: request.createdAt,
        student: student
          ? {
              id: student.id,
              name: student.name,
              email: student.email,
              enrollmentNumber: student.enrollmentNumber,
            }
          : null,
        enrollmentNumber: String(
          payload?.enrollmentNumber ?? student?.enrollmentNumber ?? '',
        ),
        guardianName: payload?.guardianName
          ? String(payload.guardianName)
          : null,
        guardianPhone: payload?.guardianPhone
          ? String(payload.guardianPhone)
          : null,
        subject: payload?.subject ? String(payload.subject) : '',
        body: payload?.body ? String(payload.body) : '',
        urgent: Boolean(payload?.urgent),
        status: response ? 'RESPONDED' : 'PENDING',
        response: response
          ? {
              respondedAt: response.createdAt,
              responderId: response.userId,
              responseMessage: responsePayload?.responseMessage
                ? String(responsePayload.responseMessage)
                : '',
            }
          : null,
      };
    });
  }

  async respondToFamilyContactRequest(payload: {
    requestId: string;
    responseMessage: string;
    actorId: string;
    schoolId?: string | null;
    notifyFamily?: boolean;
  }) {
    const schoolId = this.requireSchool(payload.schoolId);
    if (!payload.actorId) {
      throw new BadRequestException('actorId is required');
    }

    const responseMessage = payload.responseMessage?.trim();
    if (!responseMessage) {
      throw new BadRequestException('responseMessage is required');
    }

    const request = await this.prisma.auditLog.findUnique({
      where: { id: payload.requestId },
    });

    if (
      !request ||
      request.entityType !== 'FAMILY_CONTACT_REQUEST' ||
      request.action !== 'CREATE'
    ) {
      throw new NotFoundException('Family contact request not found');
    }

    const requester = request.entityId
      ? await this.prisma.user.findUnique({
          where: { id: request.entityId },
          select: { id: true, schoolId: true },
        })
      : null;
    if (!requester || (await this.resolveStudentSchoolId(requester)) !== schoolId) {
      // Same answer as "missing" so other schools' request ids are not confirmed.
      throw new NotFoundException('Family contact request not found');
    }

    const requestDetails = this.parseAuditChanges(request.changes);
    const notifyFamily = payload.notifyFamily !== false;

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: buildAuditData({
          entityType: 'FAMILY_CONTACT_REQUEST',
          entityId: request.id,
          action: 'RESPOND',
          userId: payload.actorId,
          changes: { responseMessage, notifyFamily },
        }),
      });

      if (!notifyFamily) {
        return;
      }

      const titleBase = requestDetails?.subject
        ? String(requestDetails.subject)
        : 'Solicitacao familiar';

      await tx.auditLog.create({
        data: buildAuditData({
          entityType: 'FAMILY_NOTICE',
          entityId: request.entityId,
          action: 'CREATE',
          userId: payload.actorId,
          changes: {
            title: `Resposta da secretaria: ${titleBase}`,
            body: responseMessage,
            severity: requestDetails?.urgent ? 'urgent' : 'normal',
            channel: 'IN_APP',
            sourceRequestId: request.id,
          },
        }),
      });

      if (request.entityId) {
        await tx.message.create({
          data: {
            fromId: payload.actorId,
            toId: request.entityId,
            subject: `[ESCOLA] Resposta: ${titleBase}`,
            body: responseMessage,
          },
        });
      }
    });

    return { success: true };
  }

  async createSchoolFamilyNotice(payload: {
    enrollmentNumber: string;
    title: string;
    body: string;
    severity?: 'normal' | 'urgent';
    channel?: 'IN_APP' | 'SMS' | 'BOTH';
    guardianPhone?: string;
    actorId: string;
    schoolId?: string | null;
  }) {
    const schoolId = this.requireSchool(payload.schoolId);
    const student = await this.getStudentByEnrollment(payload.enrollmentNumber);
    if ((await this.resolveStudentSchoolId(student)) !== schoolId) {
      throw new NotFoundException('Student not found');
    }

    const title = payload.title?.trim();
    const body = payload.body?.trim();

    if (!title || !body) {
      throw new BadRequestException('title and body are required');
    }

    const severity = payload.severity ?? 'normal';
    const channel = payload.channel ?? 'IN_APP';
    const wantsSms = channel === 'SMS' || channel === 'BOTH';
    const smsRecipients = wantsSms
      ? await this.resolveGuardianPhones(student.id, payload.guardianPhone)
      : [];

    await this.prisma.auditLog.create({
      data: buildAuditData({
        entityType: 'FAMILY_NOTICE',
        entityId: student.id,
        action: 'CREATE',
        userId: payload.actorId,
        changes: {
          title,
          body,
          severity,
          channel,
          guardianPhone: payload.guardianPhone ?? null,
          smsRecipients: smsRecipients.length,
        },
      }),
    });

    let smsSent = 0;
    for (const phone of smsRecipients) {
      const result = await this.outboundSms.sendSms({
        to: phone,
        text: `EduHaiti - ${title}: ${body}`.slice(0, 320),
        context: { purpose: 'FAMILY_NOTICE', studentId: student.id },
      });
      if (result.delivered || result.queued) {
        smsSent += 1;
      }
    }

    if (channel === 'IN_APP' || channel === 'BOTH') {
      await this.prisma.message.create({
        data: {
          fromId: payload.actorId,
          toId: student.id,
          subject: `[ESCOLA] ${title}`,
          body,
        },
      });
    }

    return {
      success: true,
      smsRequested: wantsSms,
      smsSent,
      // Lets the UI warn that nobody could be texted.
      smsWithoutRecipient: wantsSms && smsRecipients.length === 0,
    };
  }

  /** The phone typed by staff, or else every guardian phone linked to the student. */
  private async resolveGuardianPhones(studentId: string, typedPhone?: string) {
    const typed = typedPhone?.trim();
    if (typed) {
      return [typed];
    }
    const links = await this.prisma.guardianStudent.findMany({
      where: { studentId },
      select: { guardian: { select: { phoneNumber: true } } },
    });
    return Array.from(
      new Set(
        links
          .map((link) => link.guardian.phoneNumber?.trim())
          .filter((phone): phone is string => Boolean(phone)),
      ),
    );
  }
}
