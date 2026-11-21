import { ROLES_KEY } from './common/decorators/roles.decorator';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { autoMock } from './test-utils/auto-mock';
import { ClassesController } from './classes/classes.controller';
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
