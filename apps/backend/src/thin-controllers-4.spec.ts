import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import * as fs from 'fs';
import { Role } from '@prisma/client';
import { autoMock } from './test-utils/auto-mock';
import { createPrismaMock } from './test-utils/prisma-mock';
import { FamilyAccessController } from './family-access/family-access.controller';
import { AttendanceController } from './attendance/attendance.controller';
import { AuthController, profilePhotoFilename } from './auth/auth.controller';
import { AnnouncementsController } from './announcements/announcements.controller';
import { ContentDeliveryController } from './content-delivery/content-delivery.controller';
import { GradesController } from './grades/grades.controller';
import {
  ResourcesController,
  resourceFilename,
} from './resources/resources.controller';

describe('upload directory bootstrap', () => {
  it('creates missing upload directories on module load', () => {
    const mkdir = jest.fn();
    jest.isolateModules(() => {
      jest.doMock('fs', () => ({
        ...(jest.requireActual('fs') as typeof fs),
        existsSync: () => false,
        mkdirSync: mkdir,
      }));
      require('./auth/auth.controller');
      require('./resources/resources.controller');
    });
    jest.dontMock('fs');
    const dirs = mkdir.mock.calls.map((c) => String(c[0]));
    expect(dirs).toContain('uploads');
    expect(dirs.some((d) => d.endsWith('profile-photos'))).toBe(true);
  });
});

describe('upload filename helpers', () => {
  it('profilePhotoFilename keeps extension or defaults to .jpg', () => {
    const cb = jest.fn();
    profilePhotoFilename({}, { originalname: 'Me.PNG' }, cb);
    profilePhotoFilename({}, { originalname: 'noext' }, cb);
    expect(cb.mock.calls[0][1]).toMatch(/^\d+-\d+\.png$/);
    expect(cb.mock.calls[1][1]).toMatch(/^\d+-\d+\.jpg$/);
  });

  it('resourceFilename keeps the original name', () => {
    const cb = jest.fn();
    resourceFilename({}, { originalname: 'a.pdf' }, cb);
    expect(cb.mock.calls[0][1]).toMatch(/^\d+-\d+-a\.pdf$/);
  });
});

describe('FamilyAccessController', () => {
  it('runs the OTP login and uses the family session for family routes', async () => {
    const svc = autoMock();
    const auth = autoMock();
    const ctrl = new FamilyAccessController(svc as any, auth as any);
    const family = { studentId: 'st', guardianId: 'g', guardianName: 'Jean', guardianPhone: '+50937123456' };

    await ctrl.requestAccessCode({ enrollmentNumber: 'E1', phone: '37123456' });
    await ctrl.verifyAccessCode({ enrollmentNumber: 'E1', phone: '37123456', code: '123456' });
    await ctrl.getFamilyOverview({ family });
    await ctrl.createFamilyContactRequest({ family }, { subject: 's', body: 'b', urgent: true });

    expect(auth.requestCode).toHaveBeenCalledWith('E1', '37123456');
    expect(auth.verifyCode).toHaveBeenCalledWith('E1', '37123456', '123456');
    expect(svc.getFamilyOverview).toHaveBeenCalledWith('st');
    expect(svc.createFamilyContactRequest).toHaveBeenCalledWith({
      studentId: 'st',
      guardianName: 'Jean',
      guardianPhone: '+50937123456',
      subject: 's',
      body: 'b',
      urgent: true,
    });
  });

  it('delegates admin routes with the caller school', async () => {
    const svc = autoMock();
    const ctrl = new FamilyAccessController(svc as any, autoMock() as any);
    const notice = { enrollmentNumber: 'e', title: 't', body: 'b' };

    await ctrl.listFamilyContactRequests({ user: { schoolId: 's' } });
    await ctrl.listFamilyContactRequests({});
    await ctrl.respondFamilyContactRequest('r', { user: { sub: 'u', schoolId: 's' } }, {
      responseMessage: 'ok',
      notifyFamily: true,
    });
    await ctrl.respondFamilyContactRequest('r', {}, { responseMessage: 'ok' });
    await ctrl.createSchoolFamilyNotice({ user: { sub: 'u', schoolId: 's' } }, notice);
    await ctrl.createSchoolFamilyNotice({}, notice);

    expect(svc.listFamilyContactRequests.mock.calls).toEqual([['s'], [undefined]]);
    expect(svc.respondToFamilyContactRequest.mock.calls).toEqual([
      [{ requestId: 'r', responseMessage: 'ok', notifyFamily: true, actorId: 'u', schoolId: 's' }],
      [{ requestId: 'r', responseMessage: 'ok', notifyFamily: undefined, actorId: '', schoolId: undefined }],
    ]);
    expect(svc.createSchoolFamilyNotice.mock.calls).toEqual([
      [{ ...notice, actorId: 'u', schoolId: 's' }],
      [{ ...notice, actorId: '', schoolId: undefined }],
    ]);
  });
});

describe('AttendanceController', () => {
  it('handles every route', async () => {
    const svc = autoMock();
    const access = autoMock();
    const ctrl = new AttendanceController(svc as any, access as any);
    const payload: any = { studentId: 's', classId: 'c', date: new Date(), status: 'PRESENT' };
    const teacher = { sub: 't', role: Role.TEACHER };

    await ctrl.markAttendance({ user: { sub: 'a', role: Role.ADMIN } }, payload);
    await ctrl.markAttendance({}, payload);
    await ctrl.deleteAttendance('id');
    await ctrl.getMyAttendance({ user: { sub: 's' } }, '2026-01-01', '2026-01-31');
    await ctrl.getMyAttendance({});
    await ctrl.getMyStats({ user: { sub: 's' } }, 'c');
    await ctrl.getMyStats({}, 'c');
    await ctrl.getClassAttendance({ user: teacher }, 'c', '2026-01-02');
    await ctrl.getClassAttendance({ user: teacher }, 'c');
    await ctrl.getClassReport({ user: teacher }, 'c');

    expect(svc.markAttendance.mock.calls).toEqual([
      [payload, { id: 'a', role: Role.ADMIN }],
      [payload, { id: '', role: Role.TEACHER }],
    ]);
    expect(svc.delete).toHaveBeenCalledWith('id');
    expect(svc.findByStudent.mock.calls[1]).toEqual(['', undefined, undefined]);
    expect(svc.getStudentAttendanceStats.mock.calls).toEqual([
      ['s', 'c'],
      ['', 'c'],
    ]);
    expect(svc.findByClass.mock.calls).toEqual([
      ['c', new Date('2026-01-02')],
      ['c', undefined],
    ]);
    expect(access.assertCanManageClass).toHaveBeenCalledTimes(3);
    expect(svc.getClassAttendanceReport).toHaveBeenCalledWith('c');
  });
});

describe('AuthController', () => {
  it('delegates auth routes with defaults', async () => {
    const svc = autoMock();
    const ctrl = new AuthController(svc as any);
    const req = { user: { sub: 'u', email: 'e' } };

    await ctrl.login({ email: 'e', password: 'p' } as any);
    await ctrl.getTestCredentials();
    await ctrl.logout(req);
    await ctrl.logout({});
    await ctrl.changePassword(req, { currentPassword: 'a', newPassword: 'b' } as any);
    await ctrl.changePassword({}, { currentPassword: 'a', newPassword: 'b' } as any);
    await ctrl.getProfile(req);
    await ctrl.getProfile({});
    await ctrl.updateProfile(req, { name: 'n' } as any);
    await ctrl.updateProfile({}, { name: 'n' } as any);

    expect(svc.login).toHaveBeenCalledWith('e', 'p');
    expect(svc.getTestCredentials).toHaveBeenCalled();
    expect(svc.logout.mock.calls).toEqual([
      ['u', 'e'],
      ['', undefined],
    ]);
    expect(svc.changePassword.mock.calls).toEqual([
      ['u', 'a', 'b'],
      ['', 'a', 'b'],
    ]);
    expect(svc.getProfile.mock.calls).toEqual([['u'], ['']]);
    expect(svc.updateProfile.mock.calls).toEqual([
      ['u', { name: 'n' }],
      ['', { name: 'n' }],
    ]);
  });

  it('uploads a profile photo', async () => {
    const svc = autoMock();
    const ctrl = new AuthController(svc as any);
    await expect(ctrl.uploadProfilePhoto({}, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await ctrl.uploadProfilePhoto({ user: { sub: 'u' } }, { filename: 'f.jpg' });
    await ctrl.uploadProfilePhoto({}, { filename: 'g.jpg' });
    expect(svc.updateProfile.mock.calls).toEqual([
      ['u', { profilePhoto: '/uploads/profile-photos/f.jpg' }],
      ['', { profilePhoto: '/uploads/profile-photos/g.jpg' }],
    ]);
    expect(svc.getProfile.mock.calls).toEqual([['u'], ['']]);
  });
});

describe('AnnouncementsController', () => {
  it('creates and lists scoped to the user school', async () => {
    const svc = autoMock();
    const ctrl = new AnnouncementsController(svc as any);
    const payload: any = { title: 't', content: 'c', type: 'GENERAL', schoolId: 'p' };

    await ctrl.create({ user: { sub: 'u', schoolId: 's' } }, payload);
    await ctrl.create({}, payload);
    await ctrl.findAll({ user: { schoolId: 's' } }, 'p', 'GENERAL' as any);
    await ctrl.findAll({}, 'p');
    await ctrl.getLatest({ user: { schoolId: 's' } }, 'p', '3');
    await ctrl.getLatest({}, 'p');

    expect(svc.create.mock.calls).toEqual([
      [{ ...payload, schoolId: 's', createdById: 'u' }],
      [{ ...payload, schoolId: 'p', createdById: '' }],
    ]);
    expect(svc.findAll.mock.calls).toEqual([
      ['s', 'GENERAL'],
      ['p', undefined],
    ]);
    expect(svc.getLatest.mock.calls).toEqual([
      ['s', 3],
      ['p', 10],
    ]);
  });

  it('enforces same-school access on id routes', async () => {
    const svc = autoMock();
    svc.findById.mockResolvedValue({ id: 'a', schoolId: 's' });
    const ctrl = new AnnouncementsController(svc as any);
    const own = { user: { schoolId: 's' } };
    const other = { user: { schoolId: 'x' } };

    await expect(ctrl.findById(own, 'a')).resolves.toEqual({ id: 'a', schoolId: 's' });
    await ctrl.findById({}, 'a');
    await ctrl.update(own, 'a', { title: 'n' });
    await ctrl.delete(own, 'a');
    expect(svc.update).toHaveBeenCalledWith('a', { title: 'n' });
    expect(svc.delete).toHaveBeenCalledWith('a');

    await expect(ctrl.findById(other, 'a')).rejects.toBeInstanceOf(NotFoundException);
    await expect(ctrl.update(other, 'a', {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(ctrl.delete(other, 'a')).rejects.toBeInstanceOf(NotFoundException);

    svc.findById.mockResolvedValue(null);
    await expect(ctrl.findById(own, 'a')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ContentDeliveryController', () => {
  const make = () => {
    const manifest = autoMock();
    const audio = autoMock();
    const prisma = createPrismaMock();
    const access = autoMock();
    const ctrl = new ContentDeliveryController(
      manifest as any,
      audio as any,
      prisma as any,
      access as any,
    );
    return { manifest, audio, prisma, access, ctrl };
  };
  const teacher = { user: { sub: 't', role: Role.TEACHER, schoolId: 'sc' } };

  it('builds the manifest for one class after an access check', async () => {
    const { manifest, access, ctrl } = make();
    await ctrl.getManifest(teacher as any, { since: 'x', classId: 'c' } as any);
    expect(access.assertCanViewClass).toHaveBeenCalledWith('c', teacher.user);
    expect(manifest.buildDeltaManifest).toHaveBeenCalledWith({ since: 'x', classIds: ['c'] });
  });

  it("limits the full manifest to the caller's classes", async () => {
    const { manifest, prisma, ctrl } = make();
    prisma.class.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);

    await ctrl.getManifest({ user: { sub: 's', role: Role.STUDENT } } as any, {} as any);
    await ctrl.getManifest(teacher as any, {} as any);
    await ctrl.getManifest({ user: { sub: 'a', role: Role.ADMIN, schoolId: 'sc' } } as any, {} as any);
    expect(prisma.class.findMany.mock.calls.map((c: any) => c[0].where)).toEqual([
      { students: { some: { id: 's' } } },
      { teacherId: 't' },
      { academicYear: { schoolId: 'sc' } },
    ]);
    expect(manifest.buildDeltaManifest).toHaveBeenLastCalledWith({ since: undefined, classIds: ['c1', 'c2'] });

    await ctrl.getManifest({ user: { sub: 'o', role: Role.OWNER } } as any, {} as any);
    expect(manifest.buildDeltaManifest).toHaveBeenLastCalledWith({ since: undefined, classIds: undefined });

    await expect(
      ctrl.getManifest({ user: { sub: 'a', role: Role.ADMIN } } as any, {} as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.getManifest({} as any, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolves the target student for audio summaries', async () => {
    const { manifest, prisma, ctrl } = make();
    await ctrl.getLessonAudioSummary({ user: { sub: 'st', role: Role.STUDENT } } as any, 'other');
    await ctrl.getLessonAudioSummary({ user: { role: Role.STUDENT } } as any);

    prisma.class.findFirst.mockResolvedValueOnce({ id: 'c' });
    await ctrl.getLessonAudioSummary(teacher as any, 'st2');
    expect(prisma.class.findFirst.mock.calls[0][0].where).toEqual({ teacherId: 't', students: { some: { id: 'st2' } } });

    prisma.user.findFirst.mockResolvedValueOnce({ id: 'st3' });
    await ctrl.getLessonAudioSummary({ user: { sub: 'a', role: Role.ADMIN, schoolId: 'sc' } } as any, 'st3');
    expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ id: 'st3', schoolId: 'sc' });

    await ctrl.getLessonAudioSummary({ user: { sub: 'o', role: Role.OWNER } } as any, 'st4');
    expect(manifest.buildLessonAudioSummary.mock.calls).toEqual([['st'], [''], ['st2'], ['st3'], ['st4']]);
  });

  it('refuses audio summaries of students outside the caller reach', async () => {
    const { manifest, prisma, ctrl } = make();
    await expect(ctrl.getLessonAudioSummary(teacher as any)).rejects.toBeInstanceOf(BadRequestException);
    prisma.class.findFirst.mockResolvedValueOnce(null);
    await expect(ctrl.getLessonAudioSummary(teacher as any, 'x')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      ctrl.getLessonAudioSummary({ user: { sub: 'a', role: Role.ADMIN } } as any, 'x'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manifest.buildLessonAudioSummary).not.toHaveBeenCalled();
  });

  it('converts a video resource to audio', async () => {
    const { audio, prisma, access, ctrl } = make();
    const req: any = { user: { sub: 'u' } };

    access.assertCanManageResource.mockRejectedValueOnce(new ForbiddenException());
    await expect(ctrl.convertToAudio({ resourceId: 'r' } as any, req)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.resource.findUnique).not.toHaveBeenCalled();

    prisma.resource.findUnique.mockResolvedValue(null);
    await expect(
      ctrl.convertToAudio({ resourceId: 'r' } as any, req),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.resource.findUnique.mockResolvedValue({ fileType: 'pdf' });
    await expect(
      ctrl.convertToAudio({ resourceId: 'r' } as any, req),
    ).rejects.toBeInstanceOf(BadRequestException);

    const source = {
      id: 'r',
      classId: 'c',
      title: 'Lesson',
      description: null,
      filePath: 'uploads/v.mp4',
      fileType: 'MP4',
    };
    prisma.resource.findUnique.mockResolvedValue(source);
    audio.transcodeVideoToLowBitrateMp3.mockResolvedValue({
      outputPath: 'uploads/v.mp3',
      bitrate: '32k',
      contentHash: 'h',
      sizeBytes: 10,
    });
    prisma.resource.create.mockResolvedValue({ id: 'a1' });

    const result = await ctrl.convertToAudio(
      { resourceId: 'r', targetBitrate: '32k' } as any,
      req,
    );
    expect(result).toEqual({
      resource: { id: 'a1' },
      audioMeta: { bitrate: '32k', contentHash: 'h', sizeBytes: 10 },
    });
    expect(prisma.resource.create.mock.calls[0][0].data).toMatchObject({
      title: 'Lesson (Audio)',
      description: 'Low-bandwidth audio version',
      fileType: 'mp3',
      uploadedById: 'u',
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();

    prisma.resource.findUnique.mockResolvedValue({ ...source, description: 'd' });
    await ctrl.convertToAudio({ resourceId: 'r' } as any, req);
    expect(prisma.resource.create.mock.calls[1][0].data.description).toBe('d');
  });
});

describe('GradesController', () => {
  it('handles every route with access checks', async () => {
    const svc = autoMock();
    const access = autoMock();
    const ctrl = new GradesController(svc as any, access as any);
    const t = { user: { sub: 't', role: Role.TEACHER } };
    const payload: any = { studentId: 's', classId: 'c', disciplineId: 'd', score: 8 };

    await ctrl.createGrade(t, payload);
    await ctrl.createGrade({}, payload);
    await ctrl.updateGrade(t, 'g', { score: 9 });
    await ctrl.updateGrade(t, 'g', undefined as any);
    await ctrl.deleteGrade(t, 'g');
    await ctrl.publishGrades(t, 'c', 'd');
    await ctrl.getMyGrades({ user: { sub: 's' } }, 'y');
    await ctrl.getMyGrades({});
    await ctrl.getStudentReport({ user: { sub: 's' } }, 'y');
    await ctrl.getStudentReport({}, 'y');
    await ctrl.getClassGrades(t, 'c', 'd');
    await ctrl.getClassAverage(t, 'c', 'd');

    expect(svc.create.mock.calls).toEqual([
      [payload, { id: 't', role: Role.TEACHER }],
      [payload, { id: '', role: Role.TEACHER }],
    ]);
    expect(access.assertCanManageGrade).toHaveBeenCalledTimes(3);
    expect(access.assertCanManageGrade).toHaveBeenCalledWith('g', t.user);
    expect(svc.update.mock.calls).toEqual([
      ['g', { score: 9, status: undefined }],
      ['g', { score: undefined, status: undefined }],
    ]);
    expect(svc.delete).toHaveBeenCalledWith('g');
    expect(svc.publishGrades).toHaveBeenCalledWith('c', 'd');
    expect(svc.findByStudent.mock.calls).toEqual([
      ['s', 'y'],
      ['', undefined],
    ]);
    expect(svc.getStudentReport.mock.calls).toEqual([
      ['s', 'y'],
      ['', 'y'],
    ]);
    expect(svc.findByClass).toHaveBeenCalledWith('c', 'd');
    expect(svc.calculateClassAverage).toHaveBeenCalledWith('c', 'd');
    // create x2, publish, class grades, class average
    expect(access.assertCanManageClass).toHaveBeenCalledTimes(5);
    expect(access.assertCanManageClass).toHaveBeenCalledWith('c', t.user);
  });
});

describe('ResourcesController', () => {
  const make = () => {
    const svc = autoMock();
    const optimizer = autoMock();
    const access = autoMock();
    const ctrl = new ResourcesController(svc as any, optimizer as any, access as any);
    return { svc, optimizer, access, ctrl };
  };

  it('reads resources with access checks', async () => {
    const { svc, access, ctrl } = make();
    const req = { user: { sub: 'u', role: Role.STUDENT, schoolId: 's' } };
    await ctrl.getByClass(req, 'c');
    await ctrl.getLibraryBySeries(req, 'se');
    await ctrl.getLibraryBySchool(req, 's');
    await ctrl.getLibraryBySchool({ user: { role: Role.OWNER, schoolId: 's' } }, 'x');
    await ctrl.getLibraryBySchool({}, 'x');
    await expect(ctrl.getLibraryBySchool(req, 'x')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(access.assertCanViewClass).toHaveBeenCalledWith('c', req.user);
    expect(access.assertSeriesInSchool).toHaveBeenCalledWith('se', req.user);
    expect(svc.findByClass).toHaveBeenCalledWith('c');
    expect(svc.findLibraryBySeries).toHaveBeenCalledWith('se');
    expect(svc.findLibraryBySchool).toHaveBeenCalledTimes(3);
  });

  it('uploads with optimization and falls back to the file extension', async () => {
    const { svc, optimizer, access, ctrl } = make();
    const req = { user: { sub: 't', role: Role.TEACHER } };
    svc.create.mockResolvedValue({ id: 'r1' });

    await expect(
      ctrl.uploadResource('c', undefined, { title: 't' }, req),
    ).rejects.toBeInstanceOf(BadRequestException);

    optimizer.optimizeUploadedAsset.mockResolvedValue({
      optimizedPath: 'uploads/o.pdf',
      fileType: 'pdf',
      contentHash: 'h',
      sizeBytes: 5,
    });
    const out = await ctrl.uploadResource(
      'c',
      { filename: 'f.pdf', originalname: 'F.PDF' },
      { title: 't', description: 'd' },
      req,
    );
    expect(out).toEqual({ id: 'r1', optimization: { contentHash: 'h', sizeBytes: 5 } });
    expect(access.assertCanManageClass).toHaveBeenCalledWith('c', req.user);
    expect(optimizer.optimizeUploadedAsset).toHaveBeenCalledWith('uploads/f.pdf');
    expect(svc.create).toHaveBeenLastCalledWith('c', 't', 'd', 'uploads/o.pdf', 'pdf', 't');

    optimizer.optimizeUploadedAsset.mockResolvedValue({
      optimizedPath: 'uploads/o2',
      fileType: '',
      contentHash: 'h',
      sizeBytes: 5,
    });
    await ctrl.uploadResource('c', { filename: 'g', originalname: 'G.DOCX' }, { title: 't' }, req);
    expect(svc.create).toHaveBeenLastCalledWith('c', 't', undefined, 'uploads/o2', 'docx', 't');
  });

  it('deletes after checking access', async () => {
    const { svc, access, ctrl } = make();
    await ctrl.deleteResource({ user: { sub: 't' } }, 'r');
    expect(access.assertCanManageResource).toHaveBeenCalledWith('r', { sub: 't' });
    expect(svc.delete).toHaveBeenCalledWith('r');
  });
});
