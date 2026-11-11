import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { createPrismaMock, PrismaMock } from './test-utils/prisma-mock';
import { SeriesService } from './series/series.service';
import { AcademicYearsService } from './academic-years/academic-years.service';
import { AcademicPeriodsService } from './academic-periods/academic-periods.service';

describe('SeriesService', () => {
  let prisma: PrismaMock;
  let svc: SeriesService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new SeriesService(prisma as any);
  });

  it('lists with optional school filter', async () => {
    await svc.listAll('s');
    await svc.listAll();
    expect(prisma.series.findMany.mock.calls.map((c: any) => c[0].where)).toEqual([
      { academicYear: { schoolId: 's' } },
      undefined,
    ]);
  });

  it('uses the active year, then the latest one', async () => {
    prisma.academicYear.findFirst
      .mockResolvedValueOnce({ id: 'active' }) // active year
      .mockResolvedValueOnce({ id: 'active' }); // ownership check
    prisma.series.findFirst.mockResolvedValue(null);
    await svc.create('s', { name: ' 3e ' } as any);
    expect(prisma.series.create.mock.calls[0][0].data).toEqual({
      name: '3e',
      academicYearId: 'active',
    });

    prisma.academicYear.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'latest' })
      .mockResolvedValueOnce({ id: 'latest' });
    await svc.create('s', { name: '4e' } as any);
    expect(prisma.series.create.mock.calls[1][0].data.academicYearId).toBe('latest');
  });

  it('requires an academic year', async () => {
    prisma.academicYear.findFirst.mockResolvedValue(null);
    await expect(svc.create('s', { name: 'x' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.create('', { name: 'x' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an academic year from another school', async () => {
    prisma.academicYear.findFirst.mockResolvedValue(null);
    await expect(
      svc.create('s', { name: 'x', academicYearId: 'foreign' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('skips ownership check without school and rejects duplicates', async () => {
    prisma.series.findFirst.mockResolvedValueOnce({ id: 'dup' });
    await expect(
      svc.create('', { name: 'x', academicYearId: 'y' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.academicYear.findFirst).not.toHaveBeenCalled();
  });

  it('removes only series of the same school', async () => {
    prisma.series.findUnique.mockResolvedValueOnce(null);
    await expect(svc.remove('x')).rejects.toBeInstanceOf(NotFoundException);

    prisma.series.findUnique.mockResolvedValue({ id: 'x', academicYear: { schoolId: 's' } });
    await expect(svc.remove('x', 'other')).rejects.toBeInstanceOf(ForbiddenException);
    await svc.remove('x', 's');
    await svc.remove('x');
    expect(prisma.series.delete).toHaveBeenCalledTimes(2);

    prisma.series.findUnique.mockResolvedValue({ id: 'x', academicYear: null });
    await expect(svc.remove('x', 's')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('AcademicYearsService', () => {
  let prisma: PrismaMock;
  let svc: AcademicYearsService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new AcademicYearsService(prisma as any);
  });

  it('lists by school', async () => {
    await expect(svc.listBySchool('')).rejects.toBeInstanceOf(BadRequestException);
    await svc.listBySchool('s');
    expect(prisma.academicYear.findMany.mock.calls[0][0].where).toEqual({ schoolId: 's' });
  });

  it('validates creation', async () => {
    await expect(svc.create('', { year: '2026-2027' } as any)).rejects.toBeInstanceOf(BadRequestException);
    prisma.academicYear.findFirst.mockResolvedValueOnce({ id: 'dup' });
    await expect(svc.create('s', { year: '2026-2027' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates an inactive year with default dates', async () => {
    prisma.academicYear.findFirst.mockResolvedValue(null);
    await svc.create('s', { year: ' 2026-2027 ' } as any);
    expect(prisma.academicYear.create.mock.calls[0][0].data).toEqual({
      schoolId: 's',
      year: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2027-06-30T23:59:59.999Z'),
      isActive: false,
    });
  });

  it('falls back to current/next year when the label is not numeric', async () => {
    prisma.academicYear.findFirst.mockResolvedValue(null);
    await svc.create('s', { year: 'Ano letivo' } as any);
    const y = new Date().getFullYear();
    const data = prisma.academicYear.create.mock.calls[0][0].data;
    expect(data.startDate).toEqual(new Date(`${y}-09-01T00:00:00.000Z`));
    expect(data.endDate).toEqual(new Date(`${y + 1}-06-30T23:59:59.999Z`));
  });

  it('creates an active year deactivating others, with explicit dates', async () => {
    prisma.academicYear.findFirst.mockResolvedValue(null);
    await svc.create('s', {
      year: '2026-2027',
      startDate: '2026-08-15',
      endDate: '2027-07-01',
      isActive: true,
    } as any);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.academicYear.updateMany).toHaveBeenCalledWith({
      where: { schoolId: 's', isActive: true },
      data: { isActive: false },
    });
    expect(prisma.academicYear.create.mock.calls[0][0].data).toMatchObject({
      startDate: new Date('2026-08-15'),
      endDate: new Date('2027-07-01'),
      isActive: true,
    });
  });

  it('removes only years of the school', async () => {
    prisma.academicYear.findFirst.mockResolvedValueOnce(null);
    await expect(svc.remove('s', 'y')).rejects.toBeInstanceOf(NotFoundException);
    prisma.academicYear.findFirst.mockResolvedValueOnce({ id: 'y' });
    await svc.remove('s', 'y');
    expect(prisma.academicYear.delete).toHaveBeenCalledWith({ where: { id: 'y' } });
  });
});

describe('AcademicPeriodsService', () => {
  let prisma: PrismaMock;
  let svc: AcademicPeriodsService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new AcademicPeriodsService(prisma as any);
  });

  describe('school resolution', () => {
    it('lists by exact and partial matches', async () => {
      prisma.school.findMany.mockResolvedValueOnce([{ id: 's1' }]);
      await svc.listBySchool('s1');
      prisma.school.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 's2' }]);
      await svc.listBySchool('Lyc');
      expect(prisma.academicPeriod.findMany.mock.calls.map((c: any) => c[0].where)).toEqual([
        { schoolId: 's1' },
        { schoolId: 's2' },
      ]);
    });

    it('rejects empty, ambiguous and unknown schools', async () => {
      await expect(svc.listBySchool('  ')).rejects.toBeInstanceOf(BadRequestException);
      prisma.school.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
      await expect(svc.listBySchool('x')).rejects.toThrow('identifier');
      prisma.school.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
      await expect(svc.listBySchool('x')).rejects.toThrow('that name');
      prisma.school.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      await expect(svc.listBySchool('x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = (over: Record<string, unknown> = {}) =>
      ({ schoolId: 's1', name: 'T1', startDate: '2026-09-01', endDate: '2026-12-01', ...over }) as any;

    it('validates dates', async () => {
      await expect(svc.create(dto({ startDate: 'bad' }))).rejects.toThrow('Invalid period dates');
      await expect(svc.create(dto({ endDate: 'bad' }))).rejects.toThrow('Invalid period dates');
      await expect(svc.create(dto({ endDate: '2026-09-01' }))).rejects.toThrow('greater');
    });

    it('rejects overlaps and creates otherwise', async () => {
      prisma.school.findMany.mockResolvedValue([{ id: 's1' }]);
      prisma.academicPeriod.findFirst.mockResolvedValueOnce({ id: 'o' });
      await expect(svc.create(dto())).rejects.toThrow('overlaps');
      prisma.academicPeriod.findFirst.mockResolvedValueOnce(null);
      await svc.create(dto({ description: 'd' }));
      expect(prisma.academicPeriod.findFirst.mock.calls[1][0].where.id).toBeUndefined();
      expect(prisma.academicPeriod.create.mock.calls[0][0].data).toMatchObject({
        schoolId: 's1',
        name: 'T1',
        description: 'd',
      });
    });
  });

  describe('assertPeriodInSchool', () => {
    it('skips without school, checks existence and ownership', async () => {
      await expect(svc.assertPeriodInSchool('p')).resolves.toBeUndefined();
      prisma.academicPeriod.findUnique.mockResolvedValueOnce(null);
      await expect(svc.assertPeriodInSchool('p', 's')).rejects.toBeInstanceOf(NotFoundException);
      prisma.academicPeriod.findUnique.mockResolvedValueOnce({ schoolId: 'x' });
      await expect(svc.assertPeriodInSchool('p', 's')).rejects.toBeInstanceOf(ForbiddenException);
      prisma.academicPeriod.findUnique.mockResolvedValueOnce({ schoolId: 's' });
      await expect(svc.assertPeriodInSchool('p', 's')).resolves.toBeUndefined();
    });
  });

  describe('update', () => {
    const existing = {
      id: 'p',
      schoolId: 's',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-12-01'),
    };

    it('throws when missing or invalid', async () => {
      prisma.academicPeriod.findUnique.mockResolvedValueOnce(null);
      await expect(svc.update('p', {} as any)).rejects.toBeInstanceOf(NotFoundException);
      prisma.academicPeriod.findUnique.mockResolvedValue(existing);
      await expect(svc.update('p', { startDate: 'bad' } as any)).rejects.toThrow('Invalid');
      await expect(svc.update('p', { endDate: 'bad' } as any)).rejects.toThrow('Invalid');
      await expect(svc.update('p', { endDate: '2026-08-01' } as any)).rejects.toThrow('greater');
    });

    it('keeps existing dates or applies new ones excluding itself from overlap', async () => {
      prisma.academicPeriod.findUnique.mockResolvedValue(existing);
      prisma.academicPeriod.findFirst.mockResolvedValue(null);
      await svc.update('p', { name: 'n', isOpen: true } as any);
      await svc.update('p', { startDate: '2026-10-01', endDate: '2027-01-01' } as any);
      expect(prisma.academicPeriod.findFirst.mock.calls[0][0].where.id).toEqual({ not: 'p' });
      expect(prisma.academicPeriod.update.mock.calls[0][0].data).toMatchObject({
        name: 'n',
        startDate: existing.startDate,
        endDate: existing.endDate,
        isOpen: true,
      });
      expect(prisma.academicPeriod.update.mock.calls[1][0].data.startDate).toEqual(
        new Date('2026-10-01'),
      );
    });
  });

  describe('setOpenState', () => {
    it('throws when missing', async () => {
      prisma.academicPeriod.findUnique.mockResolvedValueOnce(null);
      await expect(svc.setOpenState('p', true)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('closes directly and opens exclusively', async () => {
      prisma.academicPeriod.findUnique.mockResolvedValue({ id: 'p', schoolId: 's' });
      await svc.setOpenState('p', false);
      expect(prisma.academicPeriod.update).toHaveBeenLastCalledWith({
        where: { id: 'p' },
        data: { isOpen: false },
      });
      await svc.setOpenState('p', true);
      expect(prisma.academicPeriod.updateMany).toHaveBeenCalledWith({
        where: { schoolId: 's', isOpen: true, id: { not: 'p' } },
        data: { isOpen: false },
      });
      expect(prisma.academicPeriod.update).toHaveBeenLastCalledWith({
        where: { id: 'p' },
        data: { isOpen: true },
      });
    });
  });

  it('removes', async () => {
    await svc.remove('p');
    expect(prisma.academicPeriod.delete).toHaveBeenCalledWith({ where: { id: 'p' } });
  });
});
