import { Injectable } from '@nestjs/common';
import { AttendanceStatus, GradeStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildAuditData } from '../common/audit-compat';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The rules, in one place, so the UI can explain them. */
export const EARLY_WARNING_RULES = {
  /** Two windows of this size are compared: the last one and the one before. */
  windowDays: 30,
  /** Absences in the window that are always chronic. */
  chronicAbsences: 5,
  /** Absence rate that is chronic… */
  chronicRate: 0.35,
  /** …once there are at least this many roll calls (1 absence out of 2 is not chronic). */
  minRecordsForRate: 4,
  /** Drop of the average (out of 20) between the two windows. */
  gradeDrop: 3,
  /** A student is not re-alerted before this many days. */
  alertCooldownDays: 7,
};

const ALERT_ENTITY = 'EARLY_WARNING_ALERT';

export type EarlyWarningRow = {
  studentId: string;
  schoolId: string | null;
  studentName: string | null;
  enrollmentNumber: string | null;
  className: string | null;
  guardianFallbackName: string | null;
  guardians: Array<{
    name: string;
    phone: string;
    relationship: string | null;
  }>;
  currentRecords: number;
  currentAbsences: number;
  currentAbsenceRate: number;
  previousAbsenceRate: number;
  /** null when the student has no published grade in the window. */
  currentAverage: number | null;
  previousAverage: number | null;
  absenceDelta: number;
  /** 0 when one of the two averages is unknown. */
  gradeDelta: number;
  chronicAbsence: boolean;
  suddenGradeDrop: boolean;
  atRisk: boolean;
  lastAlertAt: string | null;
};

type Window = {
  total: number;
  absent: number;
  gradeSum: number;
  gradeCount: number;
};
const emptyWindow = (): Window => ({
  total: 0,
  absent: 0,
  gradeSum: 0,
  gradeCount: 0,
});
const round = (value: number, digits: number) => Number(value.toFixed(digits));

/**
 * Early warning of school dropout: compares the last 30 days with the 30
 * before for every active student and flags chronic absence or a sudden drop
 * of the average. Used by the admin page, the dashboard and the alert digest.
 */
@Injectable()
export class EarlyWarningService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(
    schoolId?: string,
    now = new Date(),
  ): Promise<EarlyWarningRow[]> {
    const rules = EARLY_WARNING_RULES;
    const currentStart = new Date(now.getTime() - rules.windowDays * DAY_MS);
    const previousStart = new Date(
      now.getTime() - 2 * rules.windowDays * DAY_MS,
    );
    const classScope: Prisma.ClassWhereInput = schoolId
      ? { academicYear: { schoolId } }
      : {};

    const students = await this.prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        isActive: true,
        ...(schoolId ? { classesAttending: { some: classScope } } : {}),
      },
      select: {
        id: true,
        name: true,
        enrollmentNumber: true,
        fatherName: true,
        motherName: true,
        schoolId: true,
        classesAttending: {
          where: classScope,
          select: { name: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        guardianLinks: {
          select: {
            guardian: {
              select: { fullName: true, phoneNumber: true, relationship: true },
            },
          },
        },
      },
      take: 5000,
    });
    if (students.length === 0) return [];

    const ids = students.map((s) => s.id);
    const [attendance, grades, alerts] = await Promise.all([
      this.prisma.attendance.findMany({
        where: {
          studentId: { in: ids },
          date: { gte: previousStart, lte: now },
        },
        select: { studentId: true, status: true, date: true },
      }),
      this.prisma.grade.findMany({
        where: {
          studentId: { in: ids },
          status: GradeStatus.PUBLISHED,
          createdAt: { gte: previousStart, lte: now },
        },
        select: {
          studentId: true,
          score: true,
          maxScore: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: { entityType: ALERT_ENTITY, entityId: { in: ids } },
        select: { entityId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const windows = new Map<string, { current: Window; previous: Window }>();
    const slot = (id: string) => {
      const existing = windows.get(id);
      if (existing) return existing;
      const created = { current: emptyWindow(), previous: emptyWindow() };
      windows.set(id, created);
      return created;
    };
    for (const row of attendance) {
      const w =
        row.date >= currentStart
          ? slot(row.studentId).current
          : slot(row.studentId).previous;
      w.total += 1;
      if (row.status === AttendanceStatus.ABSENT) w.absent += 1;
    }
    for (const row of grades) {
      if (row.maxScore <= 0) continue;
      const w =
        row.createdAt >= currentStart
          ? slot(row.studentId).current
          : slot(row.studentId).previous;
      w.gradeSum += (row.score / row.maxScore) * 20;
      w.gradeCount += 1;
    }
    const lastAlert = new Map<string, Date>();
    for (const alert of alerts) {
      if (alert.entityId && !lastAlert.has(alert.entityId)) {
        lastAlert.set(alert.entityId, alert.createdAt);
      }
    }

    return students.map((student) => {
      const { current, previous } = windows.get(student.id) ?? {
        current: emptyWindow(),
        previous: emptyWindow(),
      };
      const currentRate = current.total ? current.absent / current.total : 0;
      const previousRate = previous.total
        ? previous.absent / previous.total
        : 0;
      const currentAverage = current.gradeCount
        ? current.gradeSum / current.gradeCount
        : null;
      const previousAverage = previous.gradeCount
        ? previous.gradeSum / previous.gradeCount
        : null;
      // A drop needs grades in both windows: no grade this month is not a drop.
      const gradeDelta =
        currentAverage !== null && previousAverage !== null
          ? currentAverage - previousAverage
          : 0;
      const chronicAbsence =
        current.absent >= rules.chronicAbsences ||
        (current.total >= rules.minRecordsForRate &&
          currentRate >= rules.chronicRate);
      const suddenGradeDrop = gradeDelta <= -rules.gradeDrop;

      return {
        studentId: student.id,
        schoolId: student.schoolId ?? null,
        studentName: student.name,
        enrollmentNumber: student.enrollmentNumber,
        className: student.classesAttending[0]?.name ?? null,
        guardianFallbackName: student.fatherName ?? student.motherName ?? null,
        guardians: student.guardianLinks.map(({ guardian }) => ({
          name: guardian.fullName,
          phone: guardian.phoneNumber,
          relationship: guardian.relationship,
        })),
        currentRecords: current.total,
        currentAbsences: current.absent,
        currentAbsenceRate: round(currentRate, 4),
        previousAbsenceRate: round(previousRate, 4),
        currentAverage:
          currentAverage === null ? null : round(currentAverage, 2),
        previousAverage:
          previousAverage === null ? null : round(previousAverage, 2),
        absenceDelta: round(currentRate - previousRate, 4),
        gradeDelta: round(gradeDelta, 2),
        chronicAbsence,
        suddenGradeDrop,
        atRisk: chronicAbsence || suddenGradeDrop,
        lastAlertAt: lastAlert.get(student.id)?.toISOString() ?? null,
      };
    });
  }

  /**
   * Sends ONE digest message to each admin of the schools concerned, listing
   * the at-risk students not alerted in the last 7 days.
   */
  async triggerAlerts(
    schoolId: string | undefined,
    senderId: string | undefined,
    report?: EarlyWarningRow[],
    now = new Date(),
  ) {
    const rows = report ?? (await this.getReport(schoolId, now));
    const atRisk = rows.filter((row) => row.atRisk);
    const cooldownStart =
      now.getTime() - EARLY_WARNING_RULES.alertCooldownDays * DAY_MS;
    const toAlert = atRisk.filter(
      (row) =>
        !row.lastAlertAt || new Date(row.lastAlertAt).getTime() < cooldownStart,
    );
    const skipped = atRisk.length - toAlert.length;
    if (toAlert.length === 0) {
      return { triggered: 0, skipped, recipients: 0 };
    }

    const bySchool = new Map<string, EarlyWarningRow[]>();
    for (const row of toAlert) {
      if (!row.schoolId) continue;
      bySchool.set(row.schoolId, [...(bySchool.get(row.schoolId) ?? []), row]);
    }
    const admins = bySchool.size
      ? await this.prisma.user.findMany({
          where: {
            role: Role.ADMIN,
            isActive: true,
            schoolId: { in: [...bySchool.keys()] },
          },
          select: { id: true, schoolId: true },
        })
      : [];

    const messages = admins.map((admin) => {
      const students = bySchool.get(admin.schoolId as string) ?? [];
      return {
        // Sent on behalf of whoever triggered it; falls back to the admin itself.
        fromId: senderId ?? admin.id,
        toId: admin.id,
        subject: `[Alerte précoce / Alèt bonè] ${students.length} élève(s) à risque de décrochage`,
        body: digestBody(students),
      };
    });
    if (messages.length > 0) {
      await this.prisma.message.createMany({ data: messages });
    }

    await this.prisma.auditLog.createMany({
      data: toAlert.map(
        (row) =>
          buildAuditData({
            userId: senderId,
            entityType: ALERT_ENTITY,
            entityId: row.studentId,
            action: 'TRIGGER',
            changes: {
              currentAbsenceRate: row.currentAbsenceRate,
              gradeDelta: row.gradeDelta,
              chronicAbsence: row.chronicAbsence,
              suddenGradeDrop: row.suddenGradeDrop,
            },
          }) as Prisma.AuditLogCreateManyInput,
      ),
    });

    return { triggered: toAlert.length, skipped, recipients: messages.length };
  }
}

const pct = (rate: number) => `${Math.round(rate * 100)} %`;
const num = (value: number) => value.toFixed(1).replace('.', ',');

/** Bilingual (French / Haitian Creole) digest, one line per student. */
export function digestBody(students: EarlyWarningRow[]) {
  const lines = students.map((s) => {
    const who = [s.enrollmentNumber, s.className].filter(Boolean).join(', ');
    const facts = [
      s.chronicAbsence ? `absences / absans ${pct(s.currentAbsenceRate)}` : '',
      s.suddenGradeDrop && s.currentAverage !== null
        ? `moyenne / mwayèn ${num(s.currentAverage)}/20 (${num(s.gradeDelta)})`
        : '',
    ].filter(Boolean);
    return `- ${s.studentName ?? s.enrollmentNumber ?? s.studentId}${who ? ` (${who})` : ''} : ${facts.join(' ; ')}`;
  });
  return [
    'Élèves à risque de décrochage (30 derniers jours) :',
    'Elèv ki riske kite lekòl (30 dènye jou) :',
    '',
    ...lines,
    '',
    'Détails et contacts des familles : EduHaiti > Alerte précoce.',
    'Detay ak kontak fanmi yo : EduHaiti > Alèt bonè.',
  ].join('\n');
}
