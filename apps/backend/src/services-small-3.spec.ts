import { BadRequestException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from './test-utils/prisma-mock';

const sendMail = jest.fn<(...a: any[]) => Promise<unknown>>();
const createTransport = jest.fn((..._a: any[]) => ({ sendMail }));
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: (...a: any[]) => createTransport(...a) },
}));

const fsMock = {
  mkdir: jest.fn<(...a: any[]) => Promise<unknown>>(),
  readFile: jest.fn<(...a: any[]) => Promise<unknown>>(),
  appendFile: jest.fn<(...a: any[]) => Promise<unknown>>(),
};
jest.mock('node:fs/promises', () => ({
  mkdir: (...a: any[]) => fsMock.mkdir(...a),
  readFile: (...a: any[]) => fsMock.readFile(...a),
  appendFile: (...a: any[]) => fsMock.appendFile(...a),
}));

import { EmailService } from './common/services/email.service';
import { AcademicSettingsService } from './academic-settings/academic-settings.service';
import { AuditLogService } from './sync/services/audit-log.service';
import { DisciplinesService } from './disciplines/disciplines.service';
import { AnnouncementsService } from './announcements/announcements.service';
import { MessagesService } from './messages/messages.service';

beforeEach(() => {
  for (const m of ['log', 'warn', 'error', 'debug'] as const) {
    jest.spyOn(Logger.prototype, m).mockImplementation(() => undefined);
  }
});
afterEach(() => {
  jest.restoreAllMocks();
  sendMail.mockReset();
  createTransport.mockClear();
});

const config = (env: Record<string, string | undefined>) => ({ get: (k: string) => env[k] }) as any;

describe('EmailService', () => {
  it('stays disabled without SMTP config', async () => {
    const svc = new EmailService(config({}));
    expect(createTransport).not.toHaveBeenCalled();
    await expect(svc.sendTempPasswordEmail('a@b.c', 'pw', new Date())).resolves.toBe(false);
  });

  it('uses defaults for port, secure and from address', () => {
    new EmailService(config({ SMTP_HOST: 'h', SMTP_USER: 'u@x', SMTP_PASS: 'p' }));
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'h', port: 587, secure: false, auth: { user: 'u@x', pass: 'p' } }),
    );
  });

  it('sends mail and reports success', async () => {
    sendMail.mockResolvedValue({});
    const svc = new EmailService(
      config({
        SMTP_HOST: 'h',
        SMTP_PORT: '465',
        SMTP_SECURE: 'TRUE',
        SMTP_USER: 'u',
        SMTP_PASS: 'p',
        MAIL_FROM: 'School <s@x>',
      }),
    );
    expect(createTransport.mock.calls[0][0]).toMatchObject({ port: 465, secure: true });
    await expect(svc.sendTempPasswordEmail('a@b.c', 'pw', new Date())).resolves.toBe(true);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ from: 'School <s@x>', to: 'a@b.c' });
    expect((sendMail.mock.calls[0][0] as any).text).toContain('pw');
  });

  it('returns false when sending fails', async () => {
    sendMail.mockRejectedValue(new Error('auth'));
    const svc = new EmailService(config({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' }));
    await expect(svc.sendTempPasswordEmail('a@b.c', 'pw', new Date())).resolves.toBe(false);
  });

  it('never writes the temporary password to the logs', async () => {
    const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
    );
    try {
      await new EmailService(config({})).sendTempPasswordEmail('a@b.c', 'S3cretPw', new Date());
      sendMail.mockRejectedValue(new Error('auth'));
      await new EmailService(config({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p' })).sendTempPasswordEmail(
        'a@b.c',
        'S3cretPw',
        new Date(),
      );
      const logged = spies.flatMap((spy) => spy.mock.calls.flat()).join(' ');
      expect(logged).toContain('a@b.c');
      expect(logged).not.toContain('S3cretPw');
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });

  it('builds a generic from address without user', () => {
    // host missing => disabled, but from address is still computed
    const svc: any = new EmailService(config({}));
    expect(svc.fromAddress).toBe('"EduHaiti" <noreply@eduhaiti.ht>');
    const svc2: any = new EmailService(config({ SMTP_USER: 'u@x' }));
    expect(svc2.fromAddress).toBe('"EduHaiti" <u@x>');
  });
});

describe('AcademicSettingsService', () => {
  let prisma: PrismaMock;
  let svc: AcademicSettingsService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new AcademicSettingsService(prisma as any);
  });

  it('resolves the school by exact or partial match', async () => {
    prisma.school.findMany.mockResolvedValueOnce([{ id: 's1' }]);
    prisma.academicSetting.findUnique.mockResolvedValueOnce({ schoolId: 's1', passAverage: 12 });
    await expect(svc.getBySchool(' s1 ')).resolves.toEqual({ schoolId: 's1', passAverage: 12 });

    prisma.school.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 's2' }]);
    prisma.academicSetting.findUnique.mockResolvedValueOnce(null);
    await expect(svc.getBySchool('Lycée')).resolves.toMatchObject({
      schoolId: 's2',
      passAverage: 10,
      createdAt: null,
    });
  });

  it('rejects empty, ambiguous and unknown schools', async () => {
    await expect(svc.getBySchool('  ')).rejects.toThrow('School identifier is required');
    prisma.school.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
    await expect(svc.getBySchool('x')).rejects.toThrow('Multiple schools match that identifier');
    prisma.school.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
    await expect(svc.getBySchool('x')).rejects.toThrow('Multiple schools match that name');
    prisma.school.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(svc.getBySchool('x')).rejects.toThrow('School x not found');
  });

  it('upserts with defaults on create', async () => {
    prisma.school.findMany.mockResolvedValue([{ id: 's1' }]);
    await svc.upsertBySchool('s1', {} as any);
    await svc.upsertBySchool('s1', {
      passAverage: 12,
      maxAbsencesPerCourse: 3,
      assignmentLateDaysLimit: 1,
      gradeReviewWindowDays: 4,
    } as any);
    expect(prisma.academicSetting.upsert.mock.calls[0][0].create).toEqual({
      schoolId: 's1',
      passAverage: 10,
      maxAbsencesPerCourse: 5,
      assignmentLateDaysLimit: 2,
      gradeReviewWindowDays: 7,
    });
    expect(prisma.academicSetting.upsert.mock.calls[1][0].create).toMatchObject({
      passAverage: 12,
      maxAbsencesPerCourse: 3,
    });
  });
});

describe('AuditLogService', () => {
  beforeEach(() => {
    fsMock.mkdir.mockReset().mockResolvedValue(undefined);
    fsMock.readFile.mockReset();
    fsMock.appendFile.mockReset().mockResolvedValue(undefined);
  });

  it('hydrates processed ids from the existing log', async () => {
    fsMock.readFile.mockResolvedValue(
      [
        JSON.stringify({ actionId: 'a1', status: 'applied' }),
        '',
        JSON.stringify({ actionId: 'a2', status: 'ignored' }),
        JSON.stringify({ actionId: 'a3', status: 'conflict' }),
        JSON.stringify({ actionId: 'a4', status: 'failed' }),
        JSON.stringify({ status: 'applied' }),
      ].join('\n'),
    );
    const svc = new AuditLogService();
    await svc.onModuleInit();
    expect(svc.isProcessed('a1')).toBe(true);
    expect(svc.isProcessed('a2')).toBe(true);
    expect(svc.isProcessed('a3')).toBe(true);
    expect(svc.isProcessed('a4')).toBe(false);
  });

  it('tolerates a missing log and warns on other errors', async () => {
    fsMock.readFile.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'ENOENT' }));
    await new AuditLogService().onModuleInit();
    expect(Logger.prototype.warn).not.toHaveBeenCalled();
    fsMock.readFile.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'EACCES' }));
    await new AuditLogService().onModuleInit();
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });

  it('writes entries and tracks final statuses only', async () => {
    const svc = new AuditLogService();
    const base = { deviceId: 'd', entityType: 'e', entityId: 'i', timestamp: 't' };
    await svc.write({ ...base, actionId: 'x1', status: 'applied' });
    await svc.write({ ...base, actionId: 'x2', status: 'ignored' });
    await svc.write({ ...base, actionId: 'x3', status: 'conflict' });
    await svc.write({ ...base, actionId: 'x4', status: 'failed' });
    expect(fsMock.appendFile).toHaveBeenCalledTimes(4);
    expect(['x1', 'x2', 'x3', 'x4'].map((id) => svc.isProcessed(id))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
});

describe('DisciplinesService', () => {
  let prisma: PrismaMock;
  let svc: DisciplinesService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new DisciplinesService(prisma as any);
  });

  it('creates disciplines with validation', async () => {
    prisma.series.findUnique.mockResolvedValueOnce(null);
    await expect(svc.create({ seriesId: 's', name: 'n' } as any)).rejects.toBeInstanceOf(NotFoundException);
    prisma.series.findUnique.mockResolvedValue({ id: 's' });
    prisma.discipline.findFirst.mockResolvedValueOnce({ id: 'd' });
    await expect(svc.create({ seriesId: 's', name: 'n' } as any)).rejects.toBeInstanceOf(BadRequestException);
    prisma.discipline.findFirst.mockResolvedValue(null);
    await svc.create({ seriesId: 's', name: 'n', code: 'C' } as any);
    await svc.create({ seriesId: 's', name: 'n', credits: 3 } as any);
    expect(prisma.discipline.create.mock.calls.map((c: any) => c[0].data.credits)).toEqual([0, 3]);
  });

  it('filters by series and school', async () => {
    await svc.findBySeries('s', 'sc');
    await svc.findBySeries();
    expect(prisma.discipline.findMany.mock.calls[0][0].where).toEqual({
      seriesId: 's',
      series: { academicYear: { schoolId: 'sc' } },
    });
    expect(prisma.discipline.findMany.mock.calls[1][0].where).toEqual({});
  });

  it('finds, updates and deletes or throws when missing', async () => {
    prisma.discipline.findUnique.mockResolvedValue(null);
    await expect(svc.findById('d')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.update('d', {} as any)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.delete('d')).rejects.toBeInstanceOf(NotFoundException);

    const existing = { id: 'd', name: 'Old', code: 'O', credits: 2 };
    prisma.discipline.findUnique.mockResolvedValue(existing);
    await expect(svc.findById('d')).resolves.toBe(existing);
    await svc.update('d', {} as any);
    await svc.update('d', { name: 'New', code: 'N', credits: 4 } as any);
    await svc.delete('d');
    expect(prisma.discipline.update.mock.calls.map((c: any) => c[0].data)).toEqual([
      { name: 'Old', code: 'O', credits: 2 },
      { name: 'New', code: 'N', credits: 4 },
    ]);
    expect(prisma.discipline.delete).toHaveBeenCalledWith({ where: { id: 'd' } });
  });
});

describe('AnnouncementsService', () => {
  let prisma: PrismaMock;
  let svc: AnnouncementsService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new AnnouncementsService(prisma as any);
  });

  it('creates and lists', async () => {
    const payload: any = { title: 't', content: 'c', type: 'GENERAL', createdById: 'u', schoolId: 's' };
    await svc.create(payload);
    await svc.findAll('s');
    await svc.findAll('s', 'URGENT' as any);
    await svc.getLatest('s');
    await svc.getLatest('s', 3);
    expect(prisma.announcement.create.mock.calls[0][0].data).toBe(payload);
    expect(prisma.announcement.findMany.mock.calls.map((c: any) => c[0].where)).toEqual([
      { schoolId: 's' },
      { schoolId: 's', type: 'URGENT' },
      { schoolId: 's' },
      { schoolId: 's' },
    ]);
    expect(prisma.announcement.findMany.mock.calls[2][0].take).toBe(10);
    expect(prisma.announcement.findMany.mock.calls[3][0].take).toBe(3);
  });

  it('updates, deletes and finds or throws', async () => {
    prisma.announcement.findUnique.mockResolvedValue(null);
    await expect(svc.update('a', {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.delete('a')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.findById('a')).rejects.toBeInstanceOf(NotFoundException);

    prisma.announcement.findUnique.mockResolvedValue({ id: 'a' });
    await svc.update('a', { title: 'n' });
    await expect(svc.delete('a')).resolves.toEqual({ message: 'Announcement deleted' });
    await expect(svc.findById('a')).resolves.toEqual({ id: 'a' });
    expect(prisma.announcement.update.mock.calls[0][0]).toEqual({
      where: { id: 'a' },
      data: { title: 'n' },
    });
  });
});

describe('MessagesService', () => {
  let prisma: PrismaMock;
  let svc: MessagesService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new MessagesService(prisma as any);
  });

  it('lists recipients by role', async () => {
    await expect(svc.listRecipients('', Role.ADMIN)).resolves.toEqual([]);
    await svc.listRecipients('t', Role.TEACHER, 's');
    await svc.listRecipients('st', Role.STUDENT);
    await svc.listRecipients('a', Role.ADMIN, 's');
    await svc.listRecipients('a', Role.ADMIN);
    const where = prisma.user.findMany.mock.calls.map((c: any) => c[0].where);
    expect(where[0].OR[1]).toEqual({ role: Role.ADMIN, schoolId: 's' });
    expect(where[1].OR[1]).toEqual({ role: Role.ADMIN });
    expect(where[2]).toEqual({ id: { not: 'a' }, isActive: true, schoolId: 's' });
    expect(where[3]).toEqual({ id: { not: 'a' }, isActive: true });
  });

  it('reads inbox and sent', async () => {
    await svc.findReceivedBy('u');
    await svc.findSentBy('u');
    expect(prisma.message.findMany.mock.calls.map((c: any) => c[0].where)).toEqual([
      { toId: 'u' },
      { fromId: 'u' },
    ]);
  });

  it('validates and authorizes before sending', async () => {
    await expect(svc.send('', 't', 's', 'b')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.send('u', '', 's', 'b')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.send('u', 't', 's', '  ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.send('u', 't', 's', undefined as any)).rejects.toBeInstanceOf(BadRequestException);

    prisma.user.findMany.mockResolvedValueOnce([{ id: 'other' }]);
    await expect(
      svc.send('u', 't', 's', 'b', { role: Role.TEACHER, schoolId: 's' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findMany.mockResolvedValueOnce([{ id: 't' }]);
    await svc.send('u', 't', 's', 'b', { role: Role.TEACHER });
    await svc.send('o', 't', 's', 'b', { role: Role.OWNER });
    await svc.send('x', 't', 's', 'b');
    expect(prisma.message.create).toHaveBeenCalledTimes(3);
    expect(prisma.message.create.mock.calls[0][0].data).toEqual({
      fromId: 'u',
      toId: 't',
      subject: 's',
      body: 'b',
    });
  });
});
