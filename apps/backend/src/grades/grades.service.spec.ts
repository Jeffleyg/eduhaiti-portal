import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { Role } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { GradesService } from './grades.service';

describe('GradesService', () => {
  let prisma: PrismaMock;
  let svc: GradesService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new GradesService(prisma as any);
  });

  describe('create', () => {
    const cls = { id: 'c', teacherId: 't', seriesId: 'se', academicYearId: 'y' };
    const payload = (over: Record<string, unknown> = {}) =>
      ({ studentId: 's', classId: 'c', disciplineId: 'd', score: 15, ...over }) as any;
    const ready = () => {
      prisma.class.findUnique.mockResolvedValue(cls);
      prisma.class.findFirst.mockResolvedValue({ id: 'c' });
      prisma.discipline.findUnique.mockResolvedValue({ id: 'd', seriesId: 'se' });
      prisma.grade.findFirst.mockResolvedValue(null);
    };

    it('validates class, teacher, enrollment and discipline', async () => {
      prisma.class.findUnique.mockResolvedValueOnce(null);
      await expect(svc.create(payload())).rejects.toBeInstanceOf(NotFoundException);

      prisma.class.findUnique.mockResolvedValue(cls);
      await expect(svc.create(payload(), { id: 'other', role: Role.TEACHER })).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      prisma.class.findFirst.mockResolvedValueOnce(null);
      await expect(svc.create(payload())).rejects.toThrow('not enrolled');

      prisma.class.findFirst.mockResolvedValue({ id: 'c' });
      prisma.discipline.findUnique.mockResolvedValueOnce(null);
      await expect(svc.create(payload())).rejects.toThrow('Discipline');
      prisma.discipline.findUnique.mockResolvedValueOnce({ id: 'd', seriesId: 'other' });
      await expect(svc.create(payload())).rejects.toThrow('Discipline');
    });

    it.each([
      [{ score: NaN }, 'Invalid numeric'],
      [{ maxScore: Infinity }, 'Invalid numeric'],
      [{ weight: NaN }, 'Invalid numeric'],
      [{ maxScore: 0 }, 'maxScore must be greater'],
      [{ score: -1 }, 'between 0 and maxScore'],
      [{ score: 21 }, 'between 0 and maxScore'],
      [{ weight: 0 }, 'weight must be greater'],
      [{ academicYearId: 'other' }, 'Academic year does not match'],
    ])('rejects %j', async (over, message) => {
      ready();
      await expect(svc.create(payload(over))).rejects.toThrow(message as string);
    });

    it('creates a draft with defaults', async () => {
      ready();
      await svc.create(payload(), { id: 't', role: Role.TEACHER });
      expect(prisma.grade.create.mock.calls[0][0].data).toEqual({
        studentId: 's',
        classId: 'c',
        disciplineId: 'd',
        academicYearId: 'y',
        score: 15,
        maxScore: 20,
        weight: 1,
        status: 'DRAFT',
      });
    });

    it('updates an existing grade instead of duplicating', async () => {
      ready();
      prisma.grade.findFirst.mockResolvedValue({ id: 'g' });
      await svc.create(payload({ academicYearId: 'y', maxScore: 10, weight: 2, score: 5 }));
      expect(prisma.grade.update.mock.calls[0][0]).toMatchObject({
        where: { id: 'g' },
        data: { score: 5, maxScore: 10, weight: 2, status: 'DRAFT' },
      });
      expect(prisma.grade.create).not.toHaveBeenCalled();
    });
  });

  it('updates and deletes or throws when missing', async () => {
    prisma.grade.findUnique.mockResolvedValue(null);
    await expect(svc.update('g', {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.delete('g')).rejects.toBeInstanceOf(NotFoundException);
    prisma.grade.findUnique.mockResolvedValue({ id: 'g' });
    await svc.update('g', { score: 3 });
    await expect(svc.delete('g')).resolves.toEqual({ message: 'Grade deleted successfully' });
    expect(prisma.grade.update.mock.calls[0][0].data).toEqual({ score: 3 });
  });

  it('publishes drafts', async () => {
    await svc.publishGrades('c', 'd');
    expect(prisma.grade.updateMany).toHaveBeenCalledWith({
      where: { classId: 'c', disciplineId: 'd', status: 'DRAFT' },
      data: { status: 'PUBLISHED' },
    });
  });

  it('queries by student and class with optional filters', async () => {
    await svc.findByStudent('s', 'y');
    await svc.findByStudent('s');
    await svc.findByClass('c', 'd');
    await svc.findByClass('c');
    expect(prisma.grade.findMany.mock.calls.map((c: any) => c[0].where)).toEqual([
      { studentId: 's', status: 'PUBLISHED', academicYearId: 'y' },
      { studentId: 's', status: 'PUBLISHED' },
      { classId: 'c', disciplineId: 'd' },
      { classId: 'c' },
    ]);
  });

  it('calculates weighted class averages', async () => {
    prisma.grade.findMany.mockResolvedValueOnce([]);
    expect(await svc.calculateClassAverage('c', 'd')).toEqual({ average: 0, count: 0 });
    prisma.grade.findMany.mockResolvedValueOnce([
      { score: 10, maxScore: 20, weight: 1 },
      { score: 10, maxScore: 10, weight: 3 },
    ]);
    expect(await svc.calculateClassAverage('c', 'd')).toEqual({ average: 17.5, count: 2 });
  });

  it('builds a student report grouped by discipline', async () => {
    prisma.grade.findMany.mockResolvedValueOnce([
      { score: 10, maxScore: 20, discipline: { name: 'Math' } },
      { score: 15, maxScore: 20, discipline: { name: 'Math' } },
      { score: 8, maxScore: 10, discipline: { name: 'Bio' } },
    ]);
    const r = await svc.getStudentReport('s', 'y');
    expect(r.summary).toEqual({
      Math: [
        { score: 10, maxScore: 20, percentage: 50 },
        { score: 15, maxScore: 20, percentage: 75 },
      ],
      Bio: [{ score: 8, maxScore: 10, percentage: 80 }],
    });
  });

  it('lists the academic years with published grades', async () => {
    prisma.grade.findMany.mockResolvedValueOnce([{ academicYear: { id: 'y1' } }, { academicYear: { id: 'y2' } }]);
    expect(await svc.listAcademicYearsForStudent('s')).toEqual([{ id: 'y1' }, { id: 'y2' }]);
  });

  it('computes the student evolution', async () => {
    prisma.grade.findMany.mockResolvedValueOnce([]);
    expect(await svc.getStudentEvolution('s')).toEqual({
      studentId: 's',
      academicYearId: null,
      overallAverage: 0,
      timeline: [],
      byDiscipline: [],
    });

    prisma.grade.findMany.mockResolvedValueOnce([
      { score: 10, maxScore: 20, createdAt: new Date('2026-02-10'), discipline: { id: 'm', name: 'Math' } },
      { score: 20, maxScore: 20, createdAt: new Date('2026-01-10'), discipline: { id: 'm', name: 'Math' } },
      { score: 5, maxScore: 0, createdAt: new Date('2026-01-20'), discipline: { id: 'b', name: 'Bio' } },
    ]);
    const r = await svc.getStudentEvolution('s', 'y');
    expect(prisma.grade.findMany.mock.calls[1][0].where).toMatchObject({ academicYearId: 'y' });
    expect(r.academicYearId).toBe('y');
    expect(r.timeline).toEqual([
      { period: '2026-01', average: 10, samples: 2 },
      { period: '2026-02', average: 10, samples: 1 },
    ]);
    expect(r.byDiscipline).toEqual([
      { disciplineId: 'm', disciplineName: 'Math', average: 15, samples: 2 },
      { disciplineId: 'b', disciplineName: 'Bio', average: 0, samples: 1 },
    ]);
    expect(r.overallAverage).toBe(10);
  });

  describe('issueTranscript', () => {
    it('refuses a year without published grades', async () => {
      prisma.grade.findMany.mockResolvedValueOnce([]);
      await expect(svc.issueTranscript('st', 'y')).rejects.toThrow('No published grades');
      expect(prisma.scorecard.upsert).not.toHaveBeenCalled();
    });

    it('stores the /20 average and pass status against the school pass mark', async () => {
      prisma.grade.findMany.mockResolvedValueOnce([
        { score: 14, maxScore: 20, class: { seriesId: 'se' } },
        { score: 60, maxScore: 100, class: { seriesId: 'se' } }, // 12/20
        { score: 5, maxScore: 0, class: { seriesId: 'se' } }, // invalid max counts as 0
      ]);
      prisma.academicYear.findUnique.mockResolvedValueOnce({ schoolId: 'sc' });
      prisma.academicSetting.findUnique.mockResolvedValueOnce({ passAverage: 9 });
      prisma.scorecard.upsert.mockResolvedValueOnce({ id: 'card' });

      await expect(svc.issueTranscript('st', 'y')).resolves.toEqual({
        scorecardId: 'card',
        averageScore: 8.67,
        passStatus: false,
      });
      const args = prisma.scorecard.upsert.mock.calls[0][0];
      expect(args.where).toEqual({
        studentId_academicYearId_semester: { studentId: 'st', academicYearId: 'y', semester: 0 },
      });
      expect(args.create).toMatchObject({ studentId: 'st', academicYearId: 'y', semester: 0, seriesId: 'se', averageScore: 8.67 });
      expect(args.update.generatedAt).toBeInstanceOf(Date);
      expect(prisma.grade.findMany.mock.calls[0][0].where).toEqual({ studentId: 'st', academicYearId: 'y', status: 'PUBLISHED' });
    });

    it('uses the default pass mark of 10 without a year or settings', async () => {
      prisma.grade.findMany.mockResolvedValue([{ score: 10, maxScore: 20, class: { seriesId: 'se' } }]);
      prisma.scorecard.upsert.mockResolvedValue({ id: 'card' });
      prisma.academicYear.findUnique.mockResolvedValueOnce(null);
      expect((await svc.issueTranscript('st', 'y')).passStatus).toBe(true);
      expect(prisma.academicSetting.findUnique).not.toHaveBeenCalled();
      prisma.academicYear.findUnique.mockResolvedValueOnce({ schoolId: 'sc' });
      prisma.academicSetting.findUnique.mockResolvedValueOnce(null);
      expect((await svc.issueTranscript('st', 'y')).passStatus).toBe(true);
    });
  });
});
