import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { gunzipSync } from 'node:zlib';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { AnalyticsService } from './analytics.service';

const DAY = 24 * 60 * 60 * 1000;

describe('AnalyticsService', () => {
  let prisma: PrismaMock;
  let svc: AnalyticsService;
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * DAY);

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new AnalyticsService(prisma as any);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.attendance.findMany.mockResolvedValue([]);
    prisma.grade.findMany.mockResolvedValue([]);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);
  });
  afterEach(() => {
    delete process.env.SCHOLARSHIP_UNIT_HTG;
  });

  describe('getDropoutRiskReport', () => {
    it('returns [] without students', async () => {
      expect(await svc.getDropoutRiskReport('s')).toEqual([]);
      expect(prisma.user.findMany.mock.calls[0][0].where).toHaveProperty('classesAttending');
    });

    it('flags students with chronic absence and low grades', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'risk', name: 'R', enrollmentNumber: 'E1' },
        { id: 'ok', name: 'O', enrollmentNumber: 'E2' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        ...Array.from({ length: 6 }, () => ({ studentId: 'risk', status: 'ABSENT' })),
        ...Array.from({ length: 4 }, () => ({ studentId: 'risk', status: 'PRESENT' })),
      ]);
      prisma.grade.findMany.mockResolvedValue([
        { studentId: 'risk', score: 6, createdAt: daysAgo(10) },
        { studentId: 'risk', score: 8, createdAt: daysAgo(2) },
        { studentId: 'risk', score: 7, createdAt: daysAgo(5) },
      ]);
      const [risk, ok] = await svc.getDropoutRiskReport();
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ role: 'STUDENT' });
      expect(risk).toMatchObject({ absences90d: 6, absenceRate90d: 0.6, avgScore90d: 7, atRiskDropout: true });
      expect(risk.lastGradeAt).toBe(daysAgo(2).toISOString());
      expect(ok).toMatchObject({ absenceRate90d: 0, avgScore90d: 0, lastGradeAt: null, atRiskDropout: false });
    });
  });

  describe('getEarlyWarningReport', () => {
    it('returns [] without students', async () => {
      expect(await svc.getEarlyWarningReport('s')).toEqual([]);
    });

    it('compares the current and previous 30-day windows', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'a', name: 'A', enrollmentNumber: 'E1', fatherName: 'F', motherName: 'M' },
        { id: 'b', name: 'B', enrollmentNumber: 'E2', fatherName: null, motherName: 'M' },
        { id: 'c', name: 'C', enrollmentNumber: 'E3', fatherName: null, motherName: null },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        ...Array.from({ length: 5 }, () => ({ studentId: 'a', status: 'ABSENT', date: daysAgo(3) })),
        { studentId: 'a', status: 'PRESENT', date: daysAgo(45) },
        { studentId: 'a', status: 'ABSENT', date: daysAgo(40) },
        { studentId: 'b', status: 'PRESENT', date: daysAgo(3) },
      ]);
      prisma.grade.findMany.mockResolvedValue([
        { studentId: 'b', score: 8, maxScore: 20, createdAt: daysAgo(3) },
        { studentId: 'b', score: 16, maxScore: 20, createdAt: daysAgo(45) },
        { studentId: 'c', score: 5, maxScore: 0, createdAt: daysAgo(3) },
      ]);
      const [a, b, c] = await svc.getEarlyWarningReport();
      expect(a).toMatchObject({
        guardianFallbackName: 'F',
        currentAbsenceRate: 1,
        previousAbsenceRate: 0.5,
        chronicAbsence: true,
        atRisk: true,
      });
      expect(b).toMatchObject({
        guardianFallbackName: 'M',
        currentAverage: 8,
        previousAverage: 16,
        gradeDelta: -8,
        suddenGradeDrop: true,
        chronicAbsence: false,
      });
      expect(c).toMatchObject({ guardianFallbackName: null, currentAverage: 0, previousAverage: 0, atRisk: false });
    });
  });

  describe('triggerEarlyWarningAlerts', () => {
    it('does nothing when nobody is at risk', async () => {
      jest.spyOn(svc, 'getEarlyWarningReport').mockResolvedValue([{ atRisk: false } as any]);
      expect(await svc.triggerEarlyWarningAlerts()).toEqual({ triggered: 0, recipients: 0 });
    });

    it("messages only the admins of each student's own school, from the sender", async () => {
      const report = [
        { studentId: 's1', schoolId: 'A', studentName: 'Ana', atRisk: true, suddenGradeDrop: true, chronicAbsence: false, currentAverage: 5, previousAverage: 12, currentAbsenceRate: 0.1 },
        { studentId: 's2', schoolId: 'B', studentName: null, enrollmentNumber: 'E2', atRisk: true, suddenGradeDrop: false, chronicAbsence: true },
        { studentId: 's3', schoolId: null, studentName: null, enrollmentNumber: null, atRisk: true },
      ] as any;
      prisma.user.findMany.mockResolvedValue([
        { id: 'adminA1', schoolId: 'A' },
        { id: 'adminA2', schoolId: 'A' },
        { id: 'adminB', schoolId: 'B' },
      ]);

      expect(await svc.triggerEarlyWarningAlerts('A', 'sender', report)).toEqual({ triggered: 3, recipients: 3 });
      expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({ schoolId: { in: ['A', 'B'] } });
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(3);
      expect(prisma.auditLog.create.mock.calls[0][0].data.userId).toBe('sender');

      const messages = prisma.message.createMany.mock.calls[0][0].data;
      expect(messages.map((m: any) => [m.toId, m.fromId])).toEqual([
        ['adminA1', 'sender'],
        ['adminA2', 'sender'],
        ['adminB', 'sender'],
      ]);
      expect(messages[0].body).toContain('Aluno: Ana');
      expect(messages[0].body).toContain('Queda brusca');
      expect(messages[2].body).toContain('Aluno: E2');
      expect(messages[2].body).toContain('Frequencia critica');
    });

    it('builds the report itself and sends from the admin when there is no sender', async () => {
      jest.spyOn(svc, 'getEarlyWarningReport').mockResolvedValue([{ studentId: 's', schoolId: 'A', atRisk: true } as any]);
      prisma.user.findMany.mockResolvedValue([{ id: 'adminA', schoolId: 'A' }]);
      expect(await svc.triggerEarlyWarningAlerts('A')).toEqual({ triggered: 1, recipients: 1 });
      expect(prisma.message.createMany.mock.calls[0][0].data[0]).toMatchObject({ fromId: 'adminA', toId: 'adminA' });
      expect(prisma.message.createMany.mock.calls[0][0].data[0].body).toContain('Aluno: s');
    });

    it('skips the admin lookup and messages for students without a school', async () => {
      jest.spyOn(svc, 'getEarlyWarningReport').mockResolvedValue([{ studentId: 's', schoolId: null, atRisk: true } as any]);
      expect(await svc.triggerEarlyWarningAlerts()).toEqual({ triggered: 1, recipients: 0 });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.message.createMany).not.toHaveBeenCalled();
    });
  });

  it('averages grades by region', async () => {
    const school = (city: string | null, country: string | null) => ({
      class: { academicYear: { school: { city, country } } },
    });
    prisma.grade.findMany.mockResolvedValue([
      { score: 10, updatedAt: daysAgo(2), ...school('Cap', 'HT') },
      { score: 14, updatedAt: daysAgo(1), ...school(' Cap ', 'HT') },
      { score: 12, updatedAt: daysAgo(3), ...school('Cap', 'HT') },
      { score: 8, updatedAt: daysAgo(1), ...school(' ', 'Haiti') },
      { score: 6, updatedAt: daysAgo(1), ...school(null, null) },
    ]);
    expect(await svc.getAverageGradesByRegionReport()).toEqual([
      { region: 'Cap', gradesCount: 3, avgGrade: 12, lastUpdateAt: daysAgo(1).toISOString() },
      { region: 'Haiti', gradesCount: 1, avgGrade: 8, lastUpdateAt: daysAgo(1).toISOString() },
      { region: 'Unknown', gradesCount: 1, avgGrade: 6, lastUpdateAt: daysAgo(1).toISOString() },
    ]);
  });

  it('buckets payments in 15-minute windows by status', async () => {
    const t = new Date('2026-01-01T10:07:00Z');
    prisma.payment.findMany.mockResolvedValue([
      { createdAt: new Date('2026-01-01T10:20:00Z'), status: 'PAID', amount: 5 },
      { createdAt: t, status: 'PAID', amount: 1.005 },
      { createdAt: new Date('2026-01-01T10:14:00Z'), status: 'PAID', amount: 2 },
      { createdAt: t, status: 'PENDING', amount: 3 },
    ]);
    const r = await svc.getRealtimePaymentsFlowReport('s');
    expect(prisma.payment.findMany.mock.calls[0][0].where).toHaveProperty('schoolId', 's');
    expect(r).toEqual([
      { bucket15m: '2026-01-01T10:00:00.000Z', status: 'PAID', paymentsCount: 2, amountTotal: 3 },
      { bucket15m: '2026-01-01T10:00:00.000Z', status: 'PENDING', paymentsCount: 1, amountTotal: 3 },
      { bucket15m: '2026-01-01T10:15:00.000Z', status: 'PAID', paymentsCount: 1, amountTotal: 5 },
    ]);
    await svc.getRealtimePaymentsFlowReport();
    expect(prisma.payment.findMany.mock.calls[1][0].where).not.toHaveProperty('schoolId');
  });

  describe('getDiasporaScholarshipImpactDashboard', () => {
    it('returns zeros without remittances', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ entityId: null }]);
      expect(await svc.getDiasporaScholarshipImpactDashboard()).toEqual({
        remittanceVolume: 0,
        creditedTotalHtg: 0,
        estimatedScholarships: 0,
        scholarshipUnitHtg: 15000,
        timeline: [],
      });
    });

    it('summarizes credited remittances per day', async () => {
      process.env.SCHOLARSHIP_UNIT_HTG = '1000';
      prisma.auditLog.findMany.mockResolvedValue([{ entityId: 'p1' }, { entityId: 'p2' }, { entityId: 'p3' }]);
      prisma.payment.findMany.mockResolvedValue([
        { id: 'p1', amount: 1500, createdAt: new Date('2026-01-01T10:00:00Z') },
        { id: 'p2', amount: 700, createdAt: new Date('2026-01-01T12:00:00Z') },
        { id: 'p3', amount: 900, createdAt: new Date('2026-01-02T12:00:00Z') },
      ]);
      const r = await svc.getDiasporaScholarshipImpactDashboard('s');
      expect(prisma.payment.findMany.mock.calls[0][0].where).toMatchObject({ schoolId: 's' });
      expect(r).toEqual({
        remittanceVolume: 3,
        creditedTotalHtg: 3100,
        estimatedScholarships: 3,
        scholarshipUnitHtg: 1000,
        timeline: [
          { date: '2026-01-01', remittanceVolume: 2, creditedTotalHtg: 2200, estimatedScholarships: 2 },
          { date: '2026-01-02', remittanceVolume: 1, creditedTotalHtg: 900, estimatedScholarships: 0 },
        ],
      });
      await svc.getDiasporaScholarshipImpactDashboard();
    });

    it('ignores invalid scholarship units', async () => {
      process.env.SCHOLARSHIP_UNIT_HTG = '-5';
      expect((await svc.getDiasporaScholarshipImpactDashboard()).scholarshipUnitHtg).toBe(15000);
    });
  });

  it('routes report types', async () => {
    const spies = {
      dropout: jest.spyOn(svc, 'getDropoutRiskReport').mockResolvedValue([]),
      early: jest.spyOn(svc, 'getEarlyWarningReport').mockResolvedValue([]),
      region: jest.spyOn(svc, 'getAverageGradesByRegionReport').mockResolvedValue([]),
      payments: jest.spyOn(svc, 'getRealtimePaymentsFlowReport').mockResolvedValue([]),
      diaspora: jest.spyOn(svc, 'getDiasporaScholarshipImpactDashboard').mockResolvedValue({} as any),
    };
    await svc.buildReportData('evasao-escolar', 's');
    await svc.buildReportData('alerta-precoce-evasao', 's');
    await svc.buildReportData('media-notas-regiao');
    await svc.buildReportData('fluxo-pagamentos-realtime', 's');
    await svc.buildReportData('impacto-diaspora-bolsas', 's');
    for (const spy of Object.values(spies)) expect(spy).toHaveBeenCalledTimes(1);
  });

  describe('exportReport', () => {
    it('exports CSV for arrays (with escaping) and empty arrays', async () => {
      jest
        .spyOn(svc, 'buildReportData')
        .mockResolvedValueOnce([
          { a: 'x,y', b: 'say "hi"', c: { n: 1 } },
          { a: 'line\nbreak', d: true, e: 3, f: null, g: undefined, h: Symbol('s') as any },
        ] as any)
        .mockResolvedValueOnce([]);
      const csv = await svc.exportReport('evasao-escolar', 's', 'csv');
      expect(csv.contentType).toBe('text/csv; charset=utf-8');
      expect(csv.fileName).toMatch(/^evasao-escolar-.*\.csv$/);
      const lines = csv.buffer.toString('utf8').split('\n');
      expect(lines[0]).toBe('a,b,c,d,e,f,g,h');
      expect(lines[1]).toBe('"x,y","say ""hi""","{""n"":1}",,,,,');
      expect(csv.buffer.toString('utf8')).toContain('"line\nbreak",,,true,3,,,');

      const empty = await svc.exportReport('evasao-escolar', 's', 'csv');
      expect(empty.buffer.toString('utf8')).toBe('empty\ntrue\n');
    });

    it('exports CSV for single objects and gzip JSON', async () => {
      jest
        .spyOn(svc, 'buildReportData')
        .mockResolvedValueOnce({ total: 3, label: 'ok' } as any)
        .mockResolvedValueOnce([{ a: 1 }] as any);
      const obj = await svc.exportReport('impacto-diaspora-bolsas', undefined, 'csv');
      expect(obj.buffer.toString('utf8')).toBe('total,label\n3,ok\n');

      const gz = await svc.exportReport('evasao-escolar', undefined, 'json.gz');
      expect(gz.contentType).toBe('application/gzip');
      expect(JSON.parse(gunzipSync(gz.buffer).toString('utf8'))).toEqual([{ a: 1 }]);
    });
  });
});
