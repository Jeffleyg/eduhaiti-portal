import { describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { autoMock } from './test-utils/auto-mock';
import { DisciplinesController } from './disciplines/disciplines.controller';
import { MessagesController } from './messages/messages.controller';
import { ForumsController } from './forums/forums.controller';
import { AcademicRequestsController } from './academic-requests/academic-requests.controller';

describe('DisciplinesController', () => {
  it('checks school access before every write/read by id', async () => {
    const svc = autoMock();
    const access = autoMock();
    const ctrl = new DisciplinesController(svc as any, access as any);
    const req = { user: { sub: 'a', role: Role.ADMIN, schoolId: 's1' } };

    await ctrl.create(req, { seriesId: 'se1' } as any);
    await ctrl.findBySeries(req, 'se1');
    await ctrl.findBySeries({}, 'se1');
    await ctrl.findById(req, 'd1');
    await ctrl.update(req, 'd1', { name: 'n' } as any);
    await ctrl.delete(req, 'd1');

    expect(access.assertSeriesInSchool).toHaveBeenCalledWith('se1', req.user);
    expect(access.assertDisciplineInSchool).toHaveBeenCalledTimes(3);
    expect(svc.create).toHaveBeenCalledWith({ seriesId: 'se1' });
    expect(svc.findBySeries.mock.calls).toEqual([
      ['se1', 's1'],
      ['se1', undefined],
    ]);
    expect(svc.findById).toHaveBeenCalledWith('d1');
    expect(svc.update).toHaveBeenCalledWith('d1', { name: 'n' });
    expect(svc.delete).toHaveBeenCalledWith('d1');
  });
});

describe('MessagesController', () => {
  it('uses the current user (or defaults)', async () => {
    const svc = autoMock();
    const ctrl = new MessagesController(svc as any);
    const req = { user: { sub: 'u', role: 'TEACHER', schoolId: 's1' } };

    await ctrl.getInbox(req);
    await ctrl.getInbox({});
    await ctrl.getSent(req);
    await ctrl.getSent({});
    await ctrl.getRecipients(req);
    await ctrl.getRecipients({});
    await ctrl.sendMessage({ toId: 't', subject: 's', body: 'b' }, req);
    await ctrl.sendMessage(undefined, {});

    expect(svc.findReceivedBy.mock.calls).toEqual([['u'], ['']]);
    expect(svc.findSentBy.mock.calls).toEqual([['u'], ['']]);
    expect(svc.listRecipients.mock.calls).toEqual([
      ['u', 'TEACHER', 's1'],
      ['', Role.STUDENT, undefined],
    ]);
    expect(svc.send.mock.calls).toEqual([
      ['u', 't', 's', 'b', { role: 'TEACHER', schoolId: 's1' }],
      ['', undefined, undefined, undefined, { role: undefined, schoolId: undefined }],
    ]);
  });
});

describe('ForumsController', () => {
  it('builds the actor for every route', async () => {
    const svc = autoMock();
    const ctrl = new ForumsController(svc as any);
    const req = { user: { sub: 'u', role: Role.TEACHER, schoolId: 's' } };
    const actor = { id: 'u', role: Role.TEACHER, schoolId: 's' };
    const anon = { id: '', role: Role.STUDENT, schoolId: undefined };

    await ctrl.listThreads('c', req);
    await ctrl.listThreads('c', {});
    await ctrl.createThread('c', { title: 't', body: 'b' }, req);
    await ctrl.createThread('c', { title: 't', body: 'b' }, {});
    await ctrl.listPosts('th', req);
    await ctrl.listPosts('th', {});
    await ctrl.createPost('th', { body: 'b' }, req);
    await ctrl.createPost('th', { body: 'b' }, {});

    expect(svc.listThreads.mock.calls).toEqual([
      ['c', actor],
      ['c', anon],
    ]);
    expect(svc.createThread.mock.calls[1]).toEqual(['c', { title: 't', body: 'b' }, anon]);
    expect(svc.listPosts.mock.calls[0]).toEqual(['th', actor]);
    expect(svc.createPost.mock.calls[1]).toEqual(['th', { body: 'b' }, anon]);
  });
});

describe('AcademicRequestsController', () => {
  it('delegates with the reviewer context', async () => {
    const svc = autoMock();
    const ctrl = new AcademicRequestsController(svc as any);
    const req = { user: { sub: 'u', role: Role.ADMIN, schoolId: 's' } };
    const reviewer = { id: 'u', role: Role.ADMIN, schoolId: 's' };

    await ctrl.create(req, { subject: 'x' } as any);
    await ctrl.listMine(req);
    await ctrl.listForReview(req, { status: 'PENDING' } as any);
    await ctrl.review(req, { status: 'APPROVED' } as any, 'r1');

    expect(svc.create).toHaveBeenCalledWith('u', { subject: 'x' });
    expect(svc.listMine).toHaveBeenCalledWith('u');
    expect(svc.listForReview).toHaveBeenCalledWith(reviewer, { status: 'PENDING' });
    expect(svc.reviewRequest).toHaveBeenCalledWith('r1', reviewer, {
      status: 'APPROVED',
    });
  });
});

