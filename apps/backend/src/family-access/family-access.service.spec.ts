import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { FamilyAccessService } from './family-access.service';

describe('FamilyAccessService', () => {
  let prisma: PrismaMock;
  let sms: { sendSms: jest.Mock<(...a: any[]) => Promise<any>> };
  let svc: FamilyAccessService;
  const student = {
    id: 's',
    name: 'Ana',
    email: 'a@x',
    enrollmentNumber: 'E1',
    fatherName: 'Jean Pierre',
    motherName: null,
    schoolId: 'sc',
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    sms = { sendSms: jest.fn<(...a: any[]) => Promise<any>>().mockResolvedValue({ delivered: true, queued: false }) };
    svc = new FamilyAccessService(prisma as any, sms as any);
    prisma.user.findFirst.mockResolvedValue(student);
  });

  describe('getFamilyOverview', () => {
    const emptyLists = () => {
      prisma.class.findMany.mockResolvedValue([]);
      prisma.grade.findMany.mockResolvedValue([]);
      prisma.attendance.findMany.mockResolvedValue([]);
      prisma.auditLog.findMany.mockResolvedValue([]);
    };

    it('returns the overview with school announcements and parsed notices', async () => {
      prisma.class.findMany.mockResolvedValue([{ id: 'c', name: '3e' }]);
      prisma.grade.findMany.mockResolvedValue([{ id: 'g' }]);
      prisma.attendance.findMany.mockResolvedValue([{ id: 'a' }]);
      prisma.announcement.findMany.mockResolvedValue([{ id: 'n' }]);
      prisma.auditLog.findMany.mockResolvedValue([
        { id: 'l1', createdAt: new Date('2026-01-01'), changes: { title: 'T' } },
        { id: 'l2', createdAt: new Date(), changes: null },
      ]);
      const r = await svc.getFamilyOverview('s');
      expect(r.student).toMatchObject({ id: 's', classes: [{ id: 'c', name: '3e' }] });
      expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ id: 's', role: 'STUDENT' });
      expect(r.announcements).toEqual([{ id: 'n' }]);
      expect(r.familyNotices).toEqual([{ id: 'l1', createdAt: new Date('2026-01-01'), title: 'T' }]);
      expect(prisma.announcement.findMany.mock.calls[0][0].where).toEqual({ schoolId: 'sc' });
      expect(prisma.class.findFirst).not.toHaveBeenCalled();
    });

    it("falls back to the latest class's school", async () => {
      prisma.user.findFirst.mockResolvedValue({ ...student, schoolId: null });
      prisma.class.findFirst.mockResolvedValue({ academicYear: { schoolId: 'from-class' } });
      emptyLists();
      prisma.announcement.findMany.mockResolvedValue([]);
      await svc.getFamilyOverview('s');
      expect(prisma.announcement.findMany.mock.calls[0][0].where).toEqual({ schoolId: 'from-class' });
    });

    it('rejects unknown students', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(svc.getFamilyOverview('ghost')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('skips announcements when the student has no school', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...student, schoolId: null });
      prisma.class.findFirst.mockResolvedValue(null);
      emptyLists();
      const r = await svc.getFamilyOverview('s');
      expect(r.announcements).toEqual([]);
      expect(prisma.announcement.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createFamilyContactRequest', () => {
    const payload = (over: Record<string, unknown> = {}) =>
      ({ studentId: 's', guardianName: 'Jean Pierre', subject: ' S ', body: ' B ', ...over }) as any;

    it('validates content', async () => {
      await expect(svc.createFamilyContactRequest(payload({ subject: ' ' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(svc.createFamilyContactRequest(payload({ body: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("records the request and notifies only the student's school admins", async () => {
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }]);
      await expect(
        svc.createFamilyContactRequest(payload({ guardianPhone: '509', urgent: true })),
      ).resolves.toEqual({ success: true });
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ role: 'ADMIN', isActive: true, schoolId: 'sc' });
      expect(prisma.auditLog.create.mock.calls[0][0].data.changes).toMatchObject({
        enrollmentNumber: 'E1',
        subject: 'S',
        body: 'B',
        guardianPhone: '509',
        urgent: true,
      });
      const messages = prisma.message.createMany.mock.calls[0][0].data;
      expect(messages).toHaveLength(2);
      expect(messages[0].body).toBe('B\n\nResponsavel: Jean Pierre | Tel: 509 | URGENTE');

      prisma.user.findMany.mockResolvedValueOnce([{ id: 'a1' }]);
      await svc.createFamilyContactRequest(payload());
      expect(prisma.message.createMany.mock.calls[1][0].data[0].body).toBe('B\n\nResponsavel: Jean Pierre');
      expect(prisma.auditLog.create.mock.calls[1][0].data.changes).toMatchObject({ guardianPhone: null, urgent: false });

      prisma.user.findMany.mockResolvedValueOnce([]);
      await svc.createFamilyContactRequest(payload());
      expect(prisma.message.createMany).toHaveBeenCalledTimes(2);
    });

    it('notifies nobody when the student has no school', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...student, schoolId: null });
      prisma.class.findFirst.mockResolvedValue(null);
      await svc.createFamilyContactRequest(payload());
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.message.createMany).not.toHaveBeenCalled();
    });
  });

  describe('listFamilyContactRequests', () => {
    it('requires a school', async () => {
      await expect(svc.listFamilyContactRequests()).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.listFamilyContactRequests(null)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns [] for a school without students or requests', async () => {
      prisma.user.findMany.mockResolvedValueOnce([]);
      expect(await svc.listFamilyContactRequests('sc')).toEqual([]);
      expect(prisma.auditLog.findMany).not.toHaveBeenCalled();

      prisma.user.findMany.mockResolvedValueOnce([{ id: 's' }]);
      prisma.auditLog.findMany.mockResolvedValueOnce([]);
      expect(await svc.listFamilyContactRequests('sc')).toEqual([]);
    });

    it("queries only the school's students and joins the latest responses", async () => {
      const requests = [
        { id: 'r1', entityId: 's', createdAt: new Date(), changes: { enrollmentNumber: 'E1', guardianName: 'G', guardianPhone: '509', subject: 'S', body: 'B', urgent: true } },
        { id: 'r2', entityId: 's2', createdAt: new Date(), changes: null },
        { id: 'r3', entityId: null, createdAt: new Date(), changes: {} },
      ];
      const responses = [
        { entityId: 'r1', createdAt: new Date('2026-02-01'), userId: 'adm', changes: { responseMessage: 'ok' } },
        { entityId: 'r1', createdAt: new Date('2026-01-01'), userId: 'adm', changes: { responseMessage: 'older' } },
        { entityId: null, changes: {} },
        { entityId: 'r2', createdAt: new Date(), userId: 'adm', changes: null },
      ];
      prisma.auditLog.findMany.mockImplementation(async (args: any) =>
        args.where.action === 'RESPOND' ? responses : requests,
      );
      prisma.user.findMany
        .mockResolvedValueOnce([{ id: 's' }, { id: 's2' }])
        .mockResolvedValueOnce([
          { id: 's', name: 'Ana', email: 'a', enrollmentNumber: 'E1', schoolId: 'sc' },
          { id: 's2', name: 'B', email: 'b', enrollmentNumber: 'E2', schoolId: 'sc' },
        ]);

      const all = await svc.listFamilyContactRequests('sc');
      expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({ role: 'STUDENT', schoolId: 'sc' });
      expect(prisma.auditLog.findMany.mock.calls[0][0].where.entityId).toEqual({ in: ['s', 's2'] });
      expect(all).toHaveLength(3);
      expect(all[0]).toMatchObject({
        requestId: 'r1',
        status: 'RESPONDED',
        guardianName: 'G',
        guardianPhone: '509',
        urgent: true,
        response: { responseMessage: 'ok', responderId: 'adm' },
      });
      expect(all[1]).toMatchObject({
        requestId: 'r2',
        enrollmentNumber: 'E2',
        subject: '',
        body: '',
        guardianName: null,
        status: 'RESPONDED',
        response: { responseMessage: '' },
      });
      expect(all[2]).toMatchObject({ student: null, enrollmentNumber: '', status: 'PENDING', response: null });
    });
  });

  describe('respondToFamilyContactRequest', () => {
    const base = { requestId: 'r1', responseMessage: ' Thanks ', actorId: 'adm', schoolId: 'sc' };
    const request = (over: Record<string, unknown> = {}) => ({
      id: 'r1',
      entityId: 's',
      entityType: 'FAMILY_CONTACT_REQUEST',
      action: 'CREATE',
      changes: { subject: 'Bus', urgent: true },
      ...over,
    });

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: 's', schoolId: 'sc' });
    });

    it('validates input and request', async () => {
      await expect(svc.respondToFamilyContactRequest({ ...base, schoolId: null })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(svc.respondToFamilyContactRequest({ ...base, actorId: '' })).rejects.toThrow('actorId');
      await expect(svc.respondToFamilyContactRequest({ ...base, responseMessage: ' ' })).rejects.toThrow(
        'responseMessage',
      );
      await expect(
        svc.respondToFamilyContactRequest({ ...base, responseMessage: undefined as any }),
      ).rejects.toThrow('responseMessage');
      for (const row of [
        null,
        { entityType: 'OTHER', action: 'CREATE' },
        { entityType: 'FAMILY_CONTACT_REQUEST', action: 'RESPOND' },
      ]) {
        prisma.auditLog.findUnique.mockResolvedValueOnce(row);
        await expect(svc.respondToFamilyContactRequest(base)).rejects.toBeInstanceOf(NotFoundException);
      }
    });

    it("hides requests from other schools or without a student", async () => {
      prisma.auditLog.findUnique.mockResolvedValue(request());
      prisma.user.findUnique.mockResolvedValueOnce({ id: 's', schoolId: 'other' });
      await expect(svc.respondToFamilyContactRequest(base)).rejects.toBeInstanceOf(NotFoundException);
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(svc.respondToFamilyContactRequest(base)).rejects.toBeInstanceOf(NotFoundException);
      prisma.auditLog.findUnique.mockResolvedValue(request({ entityId: null }));
      await expect(svc.respondToFamilyContactRequest(base)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('responds and notifies the family', async () => {
      prisma.auditLog.findUnique.mockResolvedValue(request());
      await expect(svc.respondToFamilyContactRequest(base)).resolves.toEqual({ success: true });
      const logs = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data);
      expect(logs[0]).toMatchObject({ action: 'RESPOND', changes: { responseMessage: 'Thanks', notifyFamily: true } });
      expect(logs[1].changes).toMatchObject({ title: 'Resposta da secretaria: Bus', severity: 'urgent' });
      expect(prisma.message.create.mock.calls[0][0].data).toMatchObject({ toId: 's', subject: '[ESCOLA] Resposta: Bus' });
    });

    it('uses the default title and severity', async () => {
      prisma.auditLog.findUnique.mockResolvedValue(request({ changes: null }));
      await svc.respondToFamilyContactRequest(base);
      expect(prisma.auditLog.create.mock.calls[1][0].data.changes).toMatchObject({
        title: 'Resposta da secretaria: Solicitacao familiar',
        severity: 'normal',
      });
    });

    it('can skip family notification', async () => {
      prisma.auditLog.findUnique.mockResolvedValue(request({ changes: {} }));
      await svc.respondToFamilyContactRequest({ ...base, notifyFamily: false });
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.message.create).not.toHaveBeenCalled();
    });
  });

  describe('createSchoolFamilyNotice', () => {
    const payload = (over: Record<string, unknown> = {}) =>
      ({ enrollmentNumber: 'E1', title: ' T ', body: ' B ', actorId: 'adm', schoolId: 'sc', ...over }) as any;

    it('validates school, student and content', async () => {
      await expect(svc.createSchoolFamilyNotice(payload({ schoolId: undefined }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(svc.createSchoolFamilyNotice(payload())).rejects.toBeInstanceOf(NotFoundException);
      prisma.user.findFirst.mockResolvedValueOnce({ ...student, schoolId: 'other' });
      await expect(svc.createSchoolFamilyNotice(payload())).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.createSchoolFamilyNotice(payload({ title: '' }))).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.createSchoolFamilyNotice(payload({ body: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it.each([
      [undefined, true, false],
      ['IN_APP', true, false],
      ['BOTH', true, true],
      ['SMS', false, true],
    ])('channel %s => message %s, sms %s', async (channel, message, texted) => {
      const r = await svc.createSchoolFamilyNotice(payload({ channel, severity: 'urgent', guardianPhone: channel ? ' 509 ' : undefined }));
      expect(prisma.message.create).toHaveBeenCalledTimes(message ? 1 : 0);
      expect(sms.sendSms).toHaveBeenCalledTimes(texted ? 1 : 0);
      expect(prisma.auditLog.create.mock.calls[0][0].data.changes).toMatchObject({ title: 'T', severity: 'urgent' });
      expect(r).toEqual({ success: true, smsRequested: texted, smsSent: texted ? 1 : 0, smsWithoutRecipient: false });
      if (texted) {
        expect(sms.sendSms.mock.calls[0][0]).toMatchObject({ to: '509', text: 'EduHaiti - T: B' });
      }
    });

    it('texts every linked guardian when no phone is typed, counting only accepted messages', async () => {
      prisma.guardianStudent.findMany.mockResolvedValue([
        { guardian: { phoneNumber: '111' } },
        { guardian: { phoneNumber: ' 111 ' } },
        { guardian: { phoneNumber: '222' } },
        { guardian: { phoneNumber: null } },
      ]);
      sms.sendSms.mockResolvedValueOnce({ delivered: false, queued: true }).mockResolvedValueOnce({ delivered: false, queued: false });
      const r = await svc.createSchoolFamilyNotice(payload({ channel: 'SMS' }));
      expect(sms.sendSms.mock.calls.map((c: any) => c[0].to)).toEqual(['111', '222']);
      expect(r).toMatchObject({ smsSent: 1, smsWithoutRecipient: false });
      expect(prisma.auditLog.create.mock.calls[0][0].data.changes.smsRecipients).toBe(2);
    });

    it('reports when SMS was requested but no guardian phone exists', async () => {
      prisma.guardianStudent.findMany.mockResolvedValue([]);
      const r = await svc.createSchoolFamilyNotice(payload({ channel: 'SMS' }));
      expect(r).toEqual({ success: true, smsRequested: true, smsSent: 0, smsWithoutRecipient: true });
    });

    it('defaults severity', async () => {
      await svc.createSchoolFamilyNotice(payload());
      expect(prisma.auditLog.create.mock.calls[0][0].data.changes).toMatchObject({ severity: 'normal', guardianPhone: null });
    });
  });
});
