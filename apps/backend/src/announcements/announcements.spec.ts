import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { autoMock } from '../test-utils/auto-mock';
import {
  activeAnnouncementWhere,
  AnnouncementsService,
} from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

const AUTHOR = { createdBy: { select: { id: true, name: true } } };
const future = (days: number) => new Date(Date.now() + days * 86_400_000);

describe('activeAnnouncementWhere', () => {
  it('keeps published, not-yet-expired announcements', () => {
    const now = new Date('2026-11-21T10:00:00Z');
    expect(activeAnnouncementWhere(now)).toEqual({
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    });
    expect(activeAnnouncementWhere().publishedAt).toEqual({
      lte: expect.any(Date),
    });
  });
});

describe('Announcement DTOs', () => {
  const errorsOf = async (cls: any, body: object) =>
    (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it('trims, requires and bounds the fields', async () => {
    const dto = plainToInstance(CreateAnnouncementDto, {
      title: '  Rentrée  ',
      content: ' Lundi ',
      type: 'GENERAL',
    });
    expect(dto.title).toBe('Rentrée');
    expect(await validate(dto)).toHaveLength(0);
    expect(
      await errorsOf(CreateAnnouncementDto, {
        title: '   ',
        content: 'x'.repeat(5001),
        type: 'URGENT',
        expiresAt: 'tomorrow',
      }),
    ).toEqual(['title', 'content', 'type', 'expiresAt']);
    expect(
      await errorsOf(CreateAnnouncementDto, {
        title: 1,
        content: 2,
        type: 'EVENT',
      }),
    ).toEqual(['title', 'content']);
  });

  it('accepts partial updates and a null expiry', async () => {
    expect(await errorsOf(UpdateAnnouncementDto, {})).toEqual([]);
    expect(await errorsOf(UpdateAnnouncementDto, { expiresAt: null })).toEqual(
      [],
    );
    expect(
      await errorsOf(UpdateAnnouncementDto, { title: '', publishedAt: 'x' }),
    ).toEqual(['title', 'publishedAt']);
  });
});

describe('AnnouncementsService', () => {
  let prisma: PrismaMock;
  let svc: AnnouncementsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new AnnouncementsService(prisma as any);
  });

  it('lists active announcements for readers, with a bounded limit', async () => {
    await svc.listActive('s');
    await svc.listActive('s', { type: 'EMERGENCY', limit: 500 });
    await svc.listActive('s', { limit: 0 });
    const [first, second, third] = prisma.announcement.findMany.mock.calls.map(
      (c: any) => c[0],
    );
    expect(first).toMatchObject({
      where: { schoolId: 's', publishedAt: { lte: expect.any(Date) } },
      include: AUTHOR,
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });
    expect(first.where.type).toBeUndefined();
    expect(second).toMatchObject({ where: { type: 'EMERGENCY' }, take: 50 });
    expect(third.take).toBe(1);
  });

  it('lists everything for the school admin', async () => {
    await svc.listAll('s');
    await svc.listAll('s', 'EVENT');
    expect(
      prisma.announcement.findMany.mock.calls.map((c: any) => c[0].where),
    ).toEqual([{ schoolId: 's' }, { schoolId: 's', type: 'EVENT' }]);
  });

  it('finds one inside the school, hiding inactive ones from readers', async () => {
    prisma.announcement.findFirst.mockResolvedValueOnce({ id: 'a' });
    await expect(svc.findOne('a', 's', true)).resolves.toEqual({ id: 'a' });
    expect(prisma.announcement.findFirst.mock.calls[0][0].where).toEqual({
      id: 'a',
      schoolId: 's',
    });

    prisma.announcement.findFirst.mockResolvedValueOnce(null);
    await expect(svc.findOne('a', 's', false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.announcement.findFirst.mock.calls[1][0].where).toMatchObject({
      id: 'a',
      schoolId: 's',
      publishedAt: { lte: expect.any(Date) },
    });
  });

  it('creates now or scheduled, and rejects an expiry before publication', async () => {
    await svc.create('s', 'u', { title: 't', content: 'c', type: 'GENERAL' });
    const created = prisma.announcement.create.mock.calls[0][0];
    expect(created.data).toMatchObject({
      schoolId: 's',
      createdById: 'u',
      title: 't',
      expiresAt: null,
      publishedAt: expect.any(Date),
    });
    expect(created.include).toEqual(AUTHOR);

    const publishedAt = future(2).toISOString();
    const expiresAt = future(5).toISOString();
    await svc.create('s', 'u', {
      title: 't',
      content: 'c',
      type: 'EVENT',
      publishedAt,
      expiresAt,
    });
    expect(prisma.announcement.create.mock.calls[1][0].data).toMatchObject({
      publishedAt: new Date(publishedAt),
      expiresAt: new Date(expiresAt),
    });

    await expect(
      svc.create('s', 'u', {
        title: 't',
        content: 'c',
        type: 'EVENT',
        expiresAt: future(-1).toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates within the school, keeping, changing or clearing dates', async () => {
    const existing = { id: 'a', publishedAt: future(-3), expiresAt: future(3) };
    prisma.announcement.findFirst.mockResolvedValue(existing);

    await svc.update('a', 's', { title: 'n' });
    expect(prisma.announcement.update.mock.calls[0][0]).toEqual({
      where: { id: 'a' },
      data: {
        title: 'n',
        content: undefined,
        type: undefined,
        publishedAt: existing.publishedAt,
        expiresAt: existing.expiresAt,
      },
      include: AUTHOR,
    });

    await svc.update('a', 's', { expiresAt: null });
    expect(
      prisma.announcement.update.mock.calls[1][0].data.expiresAt,
    ).toBeNull();

    const later = future(10).toISOString();
    await svc.update('a', 's', {
      publishedAt: future(1).toISOString(),
      expiresAt: later,
    });
    expect(prisma.announcement.update.mock.calls[2][0].data.expiresAt).toEqual(
      new Date(later),
    );

    await expect(
      svc.update('a', 's', { publishedAt: future(20).toISOString() }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.announcement.findFirst.mockResolvedValue(null);
    await expect(svc.update('x', 's', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes only inside the school', async () => {
    prisma.announcement.findFirst.mockResolvedValueOnce({ id: 'a' });
    await expect(svc.remove('a', 's')).resolves.toEqual({ success: true });
    expect(prisma.announcement.delete).toHaveBeenCalledWith({
      where: { id: 'a' },
    });

    prisma.announcement.findFirst.mockResolvedValueOnce(null);
    await expect(svc.remove('a', 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.announcement.delete).toHaveBeenCalledTimes(1);
  });
});

describe('AnnouncementsController', () => {
  const admin = { user: { sub: 'u', role: Role.ADMIN, schoolId: 's' } };
  const student = { user: { sub: 'x', role: Role.STUDENT, schoolId: 's' } };
  const owner = { user: { sub: 'o', role: Role.OWNER, schoolId: null } };

  it('scopes every route to the token school', async () => {
    const svc = autoMock();
    const ctrl = new AnnouncementsController(svc as any);

    await ctrl.list(student, 'EMERGENCY', 'all', 'other');
    await ctrl.list(admin, 'bogus', 'all');
    await ctrl.list(admin);
    await ctrl.latest(student, '3');
    await ctrl.latest(student, 'abc');
    await ctrl.latest(student);
    await ctrl.findOne(student, 'a');
    await ctrl.findOne(admin, 'a');
    await ctrl.create(admin, { title: 't' } as any);
    await ctrl.create({ user: { role: Role.ADMIN, schoolId: 's' } }, {
      title: 't',
    } as any);
    await ctrl.update(admin, 'a', { title: 'n' });
    await ctrl.remove(admin, 'a');

    // A student asking for "all" still only gets active ones, of their own school.
    expect(svc.listActive.mock.calls).toEqual([
      ['s', { type: 'EMERGENCY' }],
      ['s', { type: undefined }],
      ['s', { limit: 3 }],
      ['s', { limit: 5 }],
      ['s', { limit: 5 }],
    ]);
    expect(svc.listAll.mock.calls).toEqual([['s', undefined]]);
    expect(svc.findOne.mock.calls).toEqual([
      ['a', 's', false],
      ['a', 's', true],
    ]);
    expect(svc.create.mock.calls).toEqual([
      ['s', 'u', { title: 't' }],
      ['s', '', { title: 't' }],
    ]);
    expect(svc.update).toHaveBeenCalledWith('a', 's', { title: 'n' });
    expect(svc.remove).toHaveBeenCalledWith('a', 's');
  });

  it('lets only the owner pick a school, and refuses users without one', async () => {
    const svc = autoMock();
    const ctrl = new AnnouncementsController(svc as any);
    await ctrl.list(owner, undefined, undefined, 'p');
    expect(svc.listActive).toHaveBeenCalledWith('p', { type: undefined });

    expect(() => ctrl.list(owner)).toThrow(ForbiddenException);
    expect(() =>
      ctrl.latest({ user: { role: Role.STUDENT } }, '2', 'p'),
    ).toThrow(ForbiddenException);
    expect(() => ctrl.create({}, {} as any)).toThrow(ForbiddenException);
  });
});
