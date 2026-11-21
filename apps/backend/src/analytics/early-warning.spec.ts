import { beforeEach, describe, expect, it } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import {
  digestBody,
  EARLY_WARNING_RULES,
  EarlyWarningRow,
  EarlyWarningService,
} from './early-warning.service';

const NOW = new Date('2026-11-21T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const student = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: id.toUpperCase(),
  enrollmentNumber: `E-${id}`,
  fatherName: null,
  motherName: null,
  schoolId: 'sc',
  classesAttending: [{ name: '3e A' }],
  guardianLinks: [],
  ...over,
});
const absences = (studentId: string, n: number, ago: number) =>
  Array.from({ length: n }, () => ({
    studentId,
    status: 'ABSENT',
    date: daysAgo(ago),
  }));
const presents = (studentId: string, n: number, ago: number) =>
  Array.from({ length: n }, () => ({
    studentId,
    status: 'PRESENT',
    date: daysAgo(ago),
  }));

const row = (over: Partial<EarlyWarningRow>): EarlyWarningRow => ({
  studentId: 's',
  schoolId: 'sc',
  studentName: 'Ana',
  enrollmentNumber: 'E1',
  className: '3e A',
  guardianFallbackName: null,
  guardians: [],
  currentRecords: 10,
  currentAbsences: 5,
  currentAbsenceRate: 0.5,
  previousAbsenceRate: 0.1,
  currentAverage: 8,
  previousAverage: 12,
  absenceDelta: 0.4,
  gradeDelta: -4,
  chronicAbsence: true,
  suddenGradeDrop: true,
  atRisk: true,
  lastAlertAt: null,
  ...over,
});

describe('EarlyWarningService.getReport', () => {
  let prisma: PrismaMock;
  let svc: EarlyWarningService;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new EarlyWarningService(prisma as any);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.grade.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);
  });

  it('returns [] without students and scopes active students to the school', async () => {
    expect(await svc.getReport('sc', NOW)).toEqual([]);
    const query = prisma.user.findMany.mock.calls[0][0];
    expect(query.where).toEqual({
      role: 'STUDENT',
      isActive: true,
      classesAttending: { some: { academicYear: { schoolId: 'sc' } } },
    });
    expect(query.select.classesAttending.where).toEqual({
      academicYear: { schoolId: 'sc' },
    });

    await svc.getReport(undefined, NOW);
    expect(prisma.user.findMany.mock.calls[1][0].where).toEqual({
      role: 'STUDENT',
      isActive: true,
    });
    expect(prisma.attendance.findMany).not.toHaveBeenCalled();
  });

  it('applies the rules without false alarms', async () => {
    prisma.user.findMany.mockResolvedValue([
      student('chronic', {
        fatherName: 'Papa',
        guardianLinks: [
          {
            guardian: {
              fullName: 'Marie',
              phoneNumber: '+509 1',
              relationship: 'Mère',
            },
          },
        ],
      }),
      student('fewcalls', { motherName: 'Maman' }),
      student('rate', { classesAttending: [] }),
      student('drop'),
      student('nogradesnow'),
      student('zeromax'),
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      ...absences('chronic', 5, 3),
      ...presents('chronic', 2, 45),
      // 1 absence out of 2 calls: rate 50 %, but too few calls to be chronic.
      ...absences('fewcalls', 1, 2),
      ...presents('fewcalls', 1, 2),
      // 2 out of 4: chronic by rate.
      ...absences('rate', 2, 5),
      ...presents('rate', 2, 5),
    ]);
    prisma.grade.findMany.mockResolvedValue([
      { studentId: 'drop', score: 8, maxScore: 20, createdAt: daysAgo(3) },
      { studentId: 'drop', score: 15, maxScore: 20, createdAt: daysAgo(40) },
      // Only grades in the previous window: not a drop.
      {
        studentId: 'nogradesnow',
        score: 18,
        maxScore: 20,
        createdAt: daysAgo(40),
      },
      { studentId: 'zeromax', score: 5, maxScore: 0, createdAt: daysAgo(3) },
    ]);
    prisma.auditLog.findMany.mockResolvedValue([
      { entityId: 'chronic', createdAt: daysAgo(2) },
      { entityId: 'chronic', createdAt: daysAgo(20) },
      { entityId: null, createdAt: daysAgo(1) },
    ]);

    const rows = await svc.getReport('sc', NOW);
    const by = Object.fromEntries(rows.map((r) => [r.studentId, r]));

    expect(prisma.grade.findMany.mock.calls[0][0].where).toMatchObject({
      status: 'PUBLISHED',
    });
    expect(by.chronic).toMatchObject({
      className: '3e A',
      guardianFallbackName: 'Papa',
      guardians: [{ name: 'Marie', phone: '+509 1', relationship: 'Mère' }],
      currentRecords: 5,
      currentAbsences: 5,
      currentAbsenceRate: 1,
      previousAbsenceRate: 0,
      chronicAbsence: true,
      atRisk: true,
      lastAlertAt: daysAgo(2).toISOString(),
    });
    expect(by.fewcalls).toMatchObject({
      guardianFallbackName: 'Maman',
      currentAbsenceRate: 0.5,
      chronicAbsence: false,
      atRisk: false,
    });
    expect(by.rate).toMatchObject({ className: null, chronicAbsence: true });
    expect(by.drop).toMatchObject({
      currentAverage: 8,
      previousAverage: 15,
      gradeDelta: -7,
      suddenGradeDrop: true,
    });
    expect(by.nogradesnow).toMatchObject({
      currentAverage: null,
      previousAverage: 18,
      gradeDelta: 0,
      suddenGradeDrop: false,
      atRisk: false,
    });
    expect(by.zeromax).toMatchObject({
      currentAverage: null,
      lastAlertAt: null,
    });
  });
});

describe('EarlyWarningService.triggerAlerts', () => {
  let prisma: PrismaMock;
  let svc: EarlyWarningService;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new EarlyWarningService(prisma as any);
  });

  it('does nothing when nobody is at risk or everyone was alerted recently', async () => {
    expect(
      await svc.triggerAlerts('sc', 'u', [row({ atRisk: false })], NOW),
    ).toEqual({ triggered: 0, skipped: 0, recipients: 0 });
    expect(
      await svc.triggerAlerts(
        'sc',
        'u',
        [row({ lastAlertAt: daysAgo(3).toISOString() })],
        NOW,
      ),
    ).toEqual({
      triggered: 0,
      skipped: 1,
      recipients: 0,
    });
    expect(prisma.message.createMany).not.toHaveBeenCalled();
  });

  it('sends one digest per admin and records each alert', async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: 'adminA', schoolId: 'sc' },
      { id: 'adminB', schoolId: 'other' },
    ]);
    const result = await svc.triggerAlerts(
      'sc',
      'sender',
      [
        row({ studentId: 'a' }),
        row({
          studentId: 'b',
          studentName: 'Bob',
          lastAlertAt: daysAgo(10).toISOString(),
        }),
        row({ studentId: 'c', lastAlertAt: daysAgo(1).toISOString() }),
        row({ studentId: 'd', schoolId: 'other' }),
        row({ studentId: 'e', schoolId: null }),
      ],
      NOW,
    );
    expect(result).toEqual({ triggered: 4, skipped: 1, recipients: 2 });
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
      role: 'ADMIN',
      isActive: true,
      schoolId: { in: ['sc', 'other'] },
    });
    const messages = prisma.message.createMany.mock.calls[0][0].data;
    expect(messages.map((m: any) => [m.fromId, m.toId])).toEqual([
      ['sender', 'adminA'],
      ['sender', 'adminB'],
    ]);
    expect(messages[0].subject).toContain('2 élève(s)');
    expect(messages[0].body).toContain('- Bob (E1, 3e A)');
    expect(messages[1].subject).toContain('1 élève(s)');
    const audits = prisma.auditLog.createMany.mock.calls[0][0].data;
    expect(audits.map((a: any) => a.entityId)).toEqual(['a', 'b', 'd', 'e']);
    expect(audits[0]).toMatchObject({
      entityType: 'EARLY_WARNING_ALERT',
      action: 'TRIGGER',
      userId: 'sender',
    });
  });

  it('builds the report itself, skips admins without schools and falls back to the admin as sender', async () => {
    const noSchool = await svc.triggerAlerts(
      undefined,
      undefined,
      [row({ schoolId: null })],
      NOW,
    );
    expect(noSchool).toEqual({ triggered: 1, skipped: 0, recipients: 0 });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.message.createMany).not.toHaveBeenCalled();

    prisma.user.findMany
      .mockResolvedValueOnce([student('x')])
      .mockResolvedValueOnce([
        { id: 'adminA', schoolId: 'sc' },
        { id: 'orphan', schoolId: null },
      ]);
    prisma.attendance.findMany.mockResolvedValue(absences('x', 5, 1));
    prisma.grade.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);
    const built = await svc.triggerAlerts('sc', undefined);
    expect(built).toEqual({ triggered: 1, skipped: 0, recipients: 2 });
    const messages = prisma.message.createMany.mock.calls[0][0].data;
    expect(messages[0]).toMatchObject({ fromId: 'adminA', toId: 'adminA' });
    expect(messages[1].subject).toContain('0 élève(s)');
  });
});

describe('digestBody', () => {
  it('describes each student in French and Creole', () => {
    const body = digestBody([
      row({
        studentName: 'Ana',
        currentAbsenceRate: 0.4,
        currentAverage: 8.25,
        gradeDelta: -4.5,
      }),
      row({
        studentName: null,
        enrollmentNumber: 'E9',
        className: null,
        chronicAbsence: false,
        suddenGradeDrop: true,
        currentAverage: null,
      }),
      row({
        studentName: null,
        enrollmentNumber: null,
        className: null,
        studentId: 'id-z',
        suddenGradeDrop: false,
      }),
    ]);
    expect(body).toContain('Élèves à risque de décrochage');
    expect(body).toContain('Elèv ki riske kite lekòl');
    expect(body).toContain(
      '- Ana (E1, 3e A) : absences / absans 40 % ; moyenne / mwayèn 8,3/20 (-4,5)',
    );
    expect(body).toContain('- E9 (E9) : ');
    expect(body).toContain('- id-z : absences / absans 50 %');
    expect(EARLY_WARNING_RULES.alertCooldownDays).toBe(7);
  });
});
