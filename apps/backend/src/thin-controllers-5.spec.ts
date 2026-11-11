import { ROLES_KEY } from './common/decorators/roles.decorator';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import type * as fsType from 'fs';
import { Role } from '@prisma/client';
import { autoMock } from './test-utils/auto-mock';
import { ClassesController } from './classes/classes.controller';
import {
  AssignmentsController,
  acceptAnyFile,
  assignmentFilename,
  submissionFilename,
} from './assignments/assignments.controller';
import { SeriesController } from './series/series.controller';
import { AcademicYearsController } from './academic-years/academic-years.controller';
import { AcademicPeriodsController } from './academic-periods/academic-periods.controller';

describe('ClassesController', () => {
  it('scopes admin routes to the school', async () => {
    const svc = autoMock();
    const access = autoMock();
    const ctrl = new ClassesController(svc as any, access as any);
    const req = { user: { schoolId: 's' } };
    const payload: any = { name: 'n', academicYearId: 'y', seriesId: 'se' };

    await ctrl.createClass(req, payload);
    await ctrl.updateClass(req, 'c', { name: 'm' });
    await ctrl.deleteClass(req, 'c');
    await ctrl.enrollStudent(req, 'c', { studentId: 'st' });
    await ctrl.removeStudent(req, 'c', 'st');
    await ctrl.getAllClasses(req, 'y', 'se');
    await ctrl.getAcademicYears({});
    await ctrl.getSeries(req, 'y');

    expect(svc.create).toHaveBeenCalledWith(payload, 's');
    expect(svc.update).toHaveBeenCalledWith('c', { name: 'm' }, 's');
    expect(svc.delete).toHaveBeenCalledWith('c', 's');
    expect(svc.enrollStudent).toHaveBeenCalledWith('c', 'st', 's');
    expect(svc.removeStudent).toHaveBeenCalledWith('c', 'st', 's');
    expect(svc.findAll).toHaveBeenCalledWith('y', 'se', 's');
    expect(svc.listAcademicYears).toHaveBeenCalledWith(undefined);
    expect(svc.listSeries).toHaveBeenCalledWith('y', 's');
  });

  it('routes my-classes by role', async () => {
    const svc = autoMock();
    const ctrl = new ClassesController(svc as any, autoMock() as any);
    await ctrl.getMyClasses({ user: { sub: 't', role: 'TEACHER' } });
    await ctrl.getMyClasses({ user: { role: 'TEACHER' } });
    await ctrl.getMyClasses({ user: { sub: 's', role: 'STUDENT', schoolId: 'x' } });
    await ctrl.getMyClasses({ user: { role: 'STUDENT' } });
    await expect(ctrl.getMyClasses({})).resolves.toEqual([]);
    expect(svc.findByTeacher.mock.calls).toEqual([['t'], ['']]);
    expect(svc.findByStudent.mock.calls).toEqual([
      ['s', 'x'],
      ['', undefined],
    ]);
  });

  it('checks access before reading a class', async () => {
    const svc = autoMock();
    const access = autoMock();
    const ctrl = new ClassesController(svc as any, access as any);
    const user = { sub: 't', role: Role.TEACHER, schoolId: 's' };
    await ctrl.getClass({ user }, 'c');
    expect(access.assertCanManageClass).toHaveBeenCalledWith('c', user);
    expect(svc.findById).toHaveBeenCalledWith('c', 's');
  });
});

describe('AssignmentsController', () => {
  it('creates the upload dir on load when missing', () => {
    const mkdir = jest.fn();
    jest.isolateModules(() => {
      jest.doMock('fs', () => ({
        ...(jest.requireActual('fs') as typeof fsType),
        existsSync: () => false,
        mkdirSync: mkdir,
      }));
      require('./assignments/assignments.controller');
    });
    jest.dontMock('fs');
    expect(mkdir.mock.calls.map((c) => c[0])).toContain('uploads');
  });

  it('upload helpers', () => {
    const cb = jest.fn();
    assignmentFilename({}, { originalname: 'a.pdf' }, cb);
    submissionFilename({}, { originalname: 'b.pdf' }, cb);
    acceptAnyFile({}, undefined, cb);
    expect(cb.mock.calls[0][1]).toMatch(/^\d+-\d+-a\.pdf$/);
    expect(cb.mock.calls[1][1]).toMatch(/^submission-\d+-\d+-b\.pdf$/);
    expect(cb.mock.calls[2]).toEqual([null, true]);
  });

  const make = () => {
    const svc = autoMock();
    const access = autoMock();
    return { svc, access, ctrl: new AssignmentsController(svc as any, access as any) };
  };
  const req = { user: { sub: 't', role: Role.TEACHER } };

  it('lists assignments', async () => {
    const { svc, access, ctrl } = make();
    await ctrl.getByClass(req, 'c');
    await ctrl.getMyAssignments({ user: { sub: 's' } });
    expect(access.assertCanViewClass).toHaveBeenCalledWith('c', req.user);
    expect(svc.findByClass).toHaveBeenCalledWith('c');
    expect(svc.findForStudent).toHaveBeenCalledWith('s');
  });

  it('creates assignments with optional file and validates the date', async () => {
    const { svc, ctrl } = make();
    await ctrl.createAssignment(
      'c',
      { filename: 'f.pdf' },
      { title: 't', description: 'd', dueDate: '2026-12-01' },
      req,
    );
    await ctrl.createAssignment('c', undefined, { title: 't', dueDate: '2026-12-01' }, req);
    await expect(
      ctrl.createAssignment('c', undefined, { title: 't', dueDate: 'bad' }, req),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(svc.create.mock.calls).toEqual([
      ['c', 't', 'd', new Date('2026-12-01'), 'uploads/f.pdf', 't'],
      ['c', 't', undefined, new Date('2026-12-01'), undefined, 't'],
    ]);
  });

  it('submits, grades and deletes', async () => {
    const { svc, access, ctrl } = make();
    await expect(
      ctrl.submitAssignment('a', undefined, { user: { sub: 's' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await ctrl.submitAssignment('a', { filename: 'x.pdf' }, { user: { sub: 's' } });
    await ctrl.gradeSubmission(req, 'a', 'sub', { grade: 9, feedback: 'ok' });
    await ctrl.deleteAssignment(req, 'a');
    expect(svc.submitAssignment).toHaveBeenCalledWith('a', 's', 'uploads/x.pdf');
    expect(Reflect.getMetadata(ROLES_KEY, ctrl.submitAssignment)).toEqual([Role.STUDENT]);
    expect(access.assertCanManageSubmission).toHaveBeenCalledWith('a', 'sub', req.user);
    expect(svc.gradeSubmission).toHaveBeenCalledWith('sub', 9, 'ok');
    expect(access.assertCanManageAssignment).toHaveBeenCalledWith('a', req.user);
    expect(svc.delete).toHaveBeenCalledWith('a');
  });
});

describe('SeriesController', () => {
  it('scopes series to the admin school', async () => {
    const svc = autoMock();
    const ctrl = new SeriesController(svc as any);
    const req = { user: { schoolId: 's' } };
    await ctrl.list(req);
    await ctrl.create(req, { name: 'n' } as any);
    await ctrl.remove(req, 'se');
    await ctrl.list({});
    expect(svc.listAll.mock.calls).toEqual([['s'], [undefined]]);
    expect(svc.create).toHaveBeenCalledWith('s', { name: 'n' });
    expect(svc.remove).toHaveBeenCalledWith('se', 's');
  });
});

describe('AcademicYearsController', () => {
  it('scopes academic years to the admin school', async () => {
    const svc = autoMock();
    const ctrl = new AcademicYearsController(svc as any);
    const req = { user: { schoolId: 's' } };
    await ctrl.list(req);
    await ctrl.create(req, { year: '2026-2027' } as any);
    await ctrl.remove(req, 'y');
    await ctrl.list({});
    expect(svc.listBySchool.mock.calls).toEqual([['s'], [undefined]]);
    expect(svc.create).toHaveBeenCalledWith('s', { year: '2026-2027' });
    expect(svc.remove).toHaveBeenCalledWith('s', 'y');
  });
});

describe('AcademicPeriodsController', () => {
  it('forces the admin school on list and create', async () => {
    const svc = autoMock();
    const ctrl = new AcademicPeriodsController(svc as any);
    await ctrl.listBySchool({ user: { schoolId: 's' } }, 'other');
    await ctrl.listBySchool({}, 'q');
    const body: any = { schoolId: 'other' };
    await ctrl.create({ user: { schoolId: 's' } }, body);
    const body2: any = { schoolId: 'q' };
    await ctrl.create({}, body2);
    expect(svc.listBySchool.mock.calls).toEqual([['s'], ['q']]);
    expect(svc.create.mock.calls).toEqual([[{ schoolId: 's' }], [{ schoolId: 'q' }]]);
  });

  it('checks the period school before mutations', async () => {
    const svc = autoMock();
    const ctrl = new AcademicPeriodsController(svc as any);
    const req = { user: { schoolId: 's' } };
    await ctrl.update(req, 'p', { name: 'n' } as any);
    await ctrl.open(req, 'p');
    await ctrl.close({}, 'p');
    await ctrl.remove(req, 'p');
    expect(svc.assertPeriodInSchool.mock.calls).toEqual([
      ['p', 's'],
      ['p', 's'],
      ['p', undefined],
      ['p', 's'],
    ]);
    expect(svc.update).toHaveBeenCalledWith('p', { name: 'n' });
    expect(svc.setOpenState.mock.calls).toEqual([
      ['p', true],
      ['p', false],
    ]);
    expect(svc.remove).toHaveBeenCalledWith('p');
  });
});
