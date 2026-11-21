import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createPrismaMock } from '../test-utils/prisma-mock';
import { autoMock } from '../test-utils/auto-mock';
import {
  PRIVATE_ASSIGNMENT_DIR,
  decodeUploadName,
  displayName,
  ensurePrivateDir,
  removeStoredFile,
  resolveStoredFile,
  safeOriginalName,
  storedFileName,
  storedPath,
} from './assignment-files';
import { AssignmentsService } from './assignments.service';
import {
  AssignmentsController,
  acceptAnyFile,
  assignmentFilename,
  sendStoredFile,
  submissionFilename,
} from './assignments.controller';

/** Every test runs with process.cwd() pointing at a throw-away folder. */
let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'assignments-'));
  jest.spyOn(process, 'cwd').mockReturnValue(root);
  ensurePrivateDir();
});
afterEach(() => {
  jest.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

const writeFile = (relative: string) => {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, 'x');
  return absolute;
};

const teacher = { sub: 't1', role: Role.TEACHER };
const otherTeacher = { sub: 't2', role: Role.TEACHER };
const student = { sub: 's1', role: Role.STUDENT };
const classmate = { sub: 's2', role: Role.STUDENT };

describe('assignment files', () => {
  it('creates the private folder outside the public uploads', () => {
    expect(fs.existsSync(path.join(root, PRIVATE_ASSIGNMENT_DIR))).toBe(true);
    expect(PRIVATE_ASSIGNMENT_DIR.startsWith('uploads')).toBe(false);
  });

  it('cleans file names and keeps accents', () => {
    expect(safeOriginalName('../../etc/passwd')).toBe('passwd');
    expect(safeOriginalName('C:\\docs\\Devoir élève.pdf')).toBe(
      'Devoir élève.pdf',
    );
    expect(safeOriginalName('a<b>|c.pdf')).toBe('a_b_c.pdf');
    expect(safeOriginalName('')).toBe('file');
    expect(safeOriginalName(undefined)).toBe('file');
  });

  it('decodes names multer delivered as latin1', () => {
    const latin1 = Buffer.from('élève.pdf', 'utf8').toString('latin1');
    expect(decodeUploadName(latin1)).toBe('élève.pdf');
    expect(decodeUploadName('plain.pdf')).toBe('plain.pdf');
    expect(decodeUploadName('déjà€.pdf')).toBe('déjà€.pdf');
    expect(decodeUploadName('caf\u00e9.pdf')).toBe('caf\u00e9.pdf');
  });

  it('builds stored names and shows them without the prefix', () => {
    const name = storedFileName('submission', 'rapport.pdf');
    expect(name).toMatch(/^submission-\d+-\d+-rapport\.pdf$/);
    expect(storedPath(name)).toBe(`${PRIVATE_ASSIGNMENT_DIR}/${name}`);
    expect(displayName(storedPath(name))).toBe('rapport.pdf');
    expect(displayName('uploads/123-456-legacy.pdf')).toBe('legacy.pdf');
    expect(displayName(null)).toBeNull();
  });

  it('resolves only existing files inside the allowed folders', () => {
    const privateFile = writeFile(`${PRIVATE_ASSIGNMENT_DIR}/a.pdf`);
    const legacyFile = writeFile('uploads/b.pdf');
    writeFile('secret.txt');
    expect(resolveStoredFile(`${PRIVATE_ASSIGNMENT_DIR}/a.pdf`)).toBe(
      privateFile,
    );
    expect(resolveStoredFile('uploads/b.pdf')).toBe(legacyFile);
    expect(
      resolveStoredFile(`${PRIVATE_ASSIGNMENT_DIR}/../../secret.txt`),
    ).toBeNull();
    expect(resolveStoredFile('secret.txt')).toBeNull();
    expect(
      resolveStoredFile(`${PRIVATE_ASSIGNMENT_DIR}/missing.pdf`),
    ).toBeNull();
    expect(resolveStoredFile(undefined)).toBeNull();
  });

  it('removes files best-effort', () => {
    const file = writeFile(`${PRIVATE_ASSIGNMENT_DIR}/old.pdf`);
    removeStoredFile(`${PRIVATE_ASSIGNMENT_DIR}/old.pdf`);
    expect(fs.existsSync(file)).toBe(false);
    expect(() =>
      removeStoredFile(`${PRIVATE_ASSIGNMENT_DIR}/old.pdf`),
    ).not.toThrow();
    // a folder cannot be unlinked: the error is swallowed
    fs.mkdirSync(path.join(root, PRIVATE_ASSIGNMENT_DIR, 'dir.pdf'));
    expect(() =>
      removeStoredFile(`${PRIVATE_ASSIGNMENT_DIR}/dir.pdf`),
    ).not.toThrow();
  });
});

describe('AssignmentsService', () => {
  const make = () => {
    const prisma = createPrismaMock();
    return { prisma, svc: new AssignmentsService(prisma as any) };
  };

  const rows = () => [
    {
      id: 'a1',
      createdById: 't1',
      filePath: `${PRIVATE_ASSIGNMENT_DIR}/task-1-2-enonce.pdf`,
      submissions: [
        {
          id: 'sub1',
          studentId: 's1',
          filePath: `${PRIVATE_ASSIGNMENT_DIR}/submission-1-2-mine.pdf`,
        },
        {
          id: 'sub2',
          studentId: 's2',
          filePath: `${PRIVATE_ASSIGNMENT_DIR}/submission-1-2-theirs.pdf`,
        },
      ],
    },
  ];

  describe('findByClass', () => {
    it('gives a student only their own hand-in', async () => {
      const { prisma, svc } = make();
      prisma.assignment.findMany.mockResolvedValue(rows());
      const [row] = await svc.findByClass('c', student);
      expect(row.submissions.map((s) => s.id)).toEqual(['sub1']);
      expect(row.fileName).toBe('enonce.pdf');
      expect(row.submissions[0].fileName).toBe('mine.pdf');
      expect(row).not.toHaveProperty('submissionCount');
      expect(prisma.assignment.findMany.mock.calls[0][0].where).toEqual({
        classId: 'c',
      });
    });

    it('gives every hand-in to the teacher who created the assignment', async () => {
      const { prisma, svc } = make();
      prisma.assignment.findMany.mockResolvedValue(rows());
      const [row] = await svc.findByClass('c', teacher);
      expect(row.submissions.map((s) => s.id)).toEqual(['sub1', 'sub2']);
      expect((row as any).submissionCount).toBe(2);
    });

    it('hides hand-ins from anyone else', async () => {
      const { prisma, svc } = make();
      prisma.assignment.findMany.mockResolvedValue(rows());
      expect((await svc.findByClass('c', otherTeacher))[0].submissions).toEqual(
        [],
      );
      prisma.assignment.findMany.mockResolvedValue(rows());
      expect((await svc.findByClass('c'))[0].submissions).toEqual([]);
    });
  });

  it('lists the assignments of the student classes only', async () => {
    const { prisma, svc } = make();
    prisma.class.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    prisma.assignment.findMany.mockResolvedValue([
      { id: 'a', filePath: null, submissions: [] },
    ]);
    const result = await svc.findForStudent('s1');
    expect(result).toEqual([
      { id: 'a', filePath: null, submissions: [], fileName: null },
    ]);
    const query = prisma.assignment.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ classId: { in: ['c1', 'c2'] } });
    expect(query.include.submissions.where).toEqual({ studentId: 's1' });
  });

  it('finds the teacher document', async () => {
    const { prisma, svc } = make();
    prisma.assignment.findUnique.mockResolvedValueOnce(null);
    await expect(svc.findAssignmentFile('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prisma.assignment.findUnique.mockResolvedValueOnce({
      id: 'a',
      classId: 'c',
      filePath: null,
    });
    await expect(svc.findAssignmentFile('a')).rejects.toThrow(
      'no attached document',
    );
    prisma.assignment.findUnique.mockResolvedValueOnce({
      id: 'a',
      classId: 'c',
      filePath: 'f',
    });
    await expect(svc.findAssignmentFile('a')).resolves.toEqual({
      id: 'a',
      classId: 'c',
      filePath: 'f',
    });
  });

  it('only lets the creator receive the hand-ins', async () => {
    const { prisma, svc } = make();
    prisma.assignment.findUnique.mockResolvedValueOnce(null);
    await expect(svc.assertIsCreator('x', teacher)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prisma.assignment.findUnique.mockResolvedValue({ createdById: 't1' });
    await expect(svc.assertIsCreator('a', otherTeacher)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.assertIsCreator('a', undefined)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(svc.listSubmissions('a', otherTeacher)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.assignmentSubmission.findMany).not.toHaveBeenCalled();

    prisma.assignmentSubmission.findMany.mockResolvedValue([
      {
        id: 'sub1',
        filePath: `${PRIVATE_ASSIGNMENT_DIR}/submission-1-2-mine.pdf`,
      },
    ]);
    await expect(svc.listSubmissions('a', teacher)).resolves.toEqual([
      {
        id: 'sub1',
        filePath: `${PRIVATE_ASSIGNMENT_DIR}/submission-1-2-mine.pdf`,
        fileName: 'mine.pdf',
      },
    ]);
    expect(prisma.assignmentSubmission.findMany.mock.calls[0][0].where).toEqual(
      { assignmentId: 'a' },
    );
  });

  it('lets only the student and the creator read a hand-in', async () => {
    const { prisma, svc } = make();
    const submission = {
      id: 'sub1',
      assignmentId: 'a',
      studentId: 's1',
      filePath: 'f',
      assignment: { createdById: 't1' },
    };
    prisma.assignmentSubmission.findUnique.mockResolvedValueOnce(null);
    await expect(
      svc.findSubmissionFile('a', 'x', student),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.assignmentSubmission.findUnique.mockResolvedValue(submission);
    await expect(
      svc.findSubmissionFile('other', 'sub1', student),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.findSubmissionFile('a', 'sub1', student)).resolves.toBe(
      submission,
    );
    await expect(svc.findSubmissionFile('a', 'sub1', teacher)).resolves.toBe(
      submission,
    );
    await expect(
      svc.findSubmissionFile('a', 'sub1', classmate),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.findSubmissionFile('a', 'sub1', otherTeacher),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.findSubmissionFile('a', 'sub1', undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('submitAssignment', () => {
    const open = {
      id: 'a',
      dueDate: new Date(Date.now() + 60_000),
      class: { students: [{ id: 's1' }] },
    };

    it('only accepts students enrolled in the class', async () => {
      const { prisma, svc } = make();
      prisma.assignment.findFirst.mockResolvedValueOnce(null);
      await expect(svc.submitAssignment('ghost', 's1', 'f')).rejects.toThrow(
        'Assignment not found',
      );
      prisma.assignment.findFirst.mockResolvedValueOnce({
        id: 'a',
        class: { students: [] },
      });
      await expect(svc.submitAssignment('a', 'outsider', 'f')).rejects.toThrow(
        'not enrolled',
      );
      expect(
        prisma.assignment.findFirst.mock.calls[1][0].select.class.select
          .students.where,
      ).toEqual({ id: 'outsider' });
      expect(prisma.assignmentSubmission.upsert).not.toHaveBeenCalled();
    });

    it('marks hand-ins as submitted or late', async () => {
      const { prisma, svc } = make();
      prisma.assignment.findFirst
        .mockResolvedValueOnce(open)
        .mockResolvedValueOnce({
          ...open,
          dueDate: new Date(Date.now() - 60_000),
        });
      prisma.assignmentSubmission.upsert.mockResolvedValue({
        id: 'sub',
        filePath: 'storage/assignments/submission-1-2-x.pdf',
      });
      const saved = await svc.submitAssignment('a', 's1', 'f1');
      await svc.submitAssignment('a', 's1', 'f2');
      expect(saved.fileName).toBe('x.pdf');
      const calls = prisma.assignmentSubmission.upsert.mock.calls.map(
        (c: any) => c[0],
      );
      expect(calls[0].where).toEqual({
        assignmentId_studentId: { assignmentId: 'a', studentId: 's1' },
      });
      expect(calls[0].create.status).toBe('SUBMITTED');
      expect(calls[1].update).toMatchObject({ filePath: 'f2', status: 'LATE' });
    });

    it('replaces (edits) the previous document and deletes it', async () => {
      const { prisma, svc } = make();
      const old = writeFile(`${PRIVATE_ASSIGNMENT_DIR}/old.pdf`);
      prisma.assignment.findFirst.mockResolvedValue(open);
      prisma.assignmentSubmission.findUnique.mockResolvedValueOnce({
        filePath: `${PRIVATE_ASSIGNMENT_DIR}/old.pdf`,
        grade: null,
      });
      prisma.assignmentSubmission.upsert.mockResolvedValue({
        id: 'sub',
        filePath: 'new.pdf',
      });
      await svc.submitAssignment(
        'a',
        's1',
        `${PRIVATE_ASSIGNMENT_DIR}/new.pdf`,
      );
      expect(fs.existsSync(old)).toBe(false);

      // sending the very same path keeps the file
      const same = writeFile(`${PRIVATE_ASSIGNMENT_DIR}/same.pdf`);
      prisma.assignmentSubmission.findUnique.mockResolvedValueOnce({
        filePath: `${PRIVATE_ASSIGNMENT_DIR}/same.pdf`,
        grade: null,
      });
      await svc.submitAssignment(
        'a',
        's1',
        `${PRIVATE_ASSIGNMENT_DIR}/same.pdf`,
      );
      expect(fs.existsSync(same)).toBe(true);
    });

    it('refuses changes once the hand-in is graded', async () => {
      const { prisma, svc } = make();
      prisma.assignment.findFirst.mockResolvedValue(open);
      prisma.assignmentSubmission.findUnique.mockResolvedValue({
        filePath: 'f',
        grade: 0,
      });
      await expect(
        svc.submitAssignment('a', 's1', 'f2'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.assignmentSubmission.upsert).not.toHaveBeenCalled();
    });
  });

  it('creates, reads, updates and grades', async () => {
    const { prisma, svc } = make();
    const due = new Date('2026-12-01');
    prisma.assignment.create.mockResolvedValue({
      id: 'a',
      filePath: 'f',
      submissions: [],
    });
    await expect(
      svc.create('c', 't', 'd', due, 'f', 'u'),
    ).resolves.toMatchObject({ fileName: 'f' });
    await svc.findById('a');
    await svc.update('a', 't', undefined, due);
    await svc.gradeSubmission('sub', 9, 'ok');

    expect(prisma.assignment.create.mock.calls[0][0].data).toEqual({
      classId: 'c',
      title: 't',
      description: 'd',
      dueDate: due,
      filePath: 'f',
      createdById: 'u',
    });
    expect(prisma.assignment.findUnique.mock.calls[0][0].where).toEqual({
      id: 'a',
    });
    expect(prisma.assignment.update.mock.calls[0][0]).toEqual({
      where: { id: 'a' },
      data: { title: 't', description: undefined, dueDate: due },
    });
    expect(prisma.assignmentSubmission.update.mock.calls[0][0]).toEqual({
      where: { id: 'sub' },
      data: { grade: 9, feedback: 'ok' },
    });
  });

  it('deletes the assignment together with its documents', async () => {
    const { prisma, svc } = make();
    const task = writeFile(`${PRIVATE_ASSIGNMENT_DIR}/task.pdf`);
    const handIn = writeFile(`${PRIVATE_ASSIGNMENT_DIR}/hand-in.pdf`);
    prisma.assignment.findUnique.mockResolvedValueOnce({
      filePath: `${PRIVATE_ASSIGNMENT_DIR}/task.pdf`,
      submissions: [{ filePath: `${PRIVATE_ASSIGNMENT_DIR}/hand-in.pdf` }],
    });
    prisma.assignment.delete.mockResolvedValue({ id: 'a' });
    await expect(svc.delete('a')).resolves.toEqual({ id: 'a' });
    expect(prisma.assignment.delete).toHaveBeenCalledWith({
      where: { id: 'a' },
    });
    expect(fs.existsSync(task)).toBe(false);
    expect(fs.existsSync(handIn)).toBe(false);

    prisma.assignment.findUnique.mockResolvedValueOnce(null);
    await expect(svc.delete('a')).resolves.toEqual({ id: 'a' });
  });
});

describe('AssignmentsController', () => {
  const make = () => {
    const svc = autoMock();
    const access = autoMock();
    return {
      svc,
      access,
      ctrl: new AssignmentsController(svc as any, access as any),
    };
  };
  const res = () => ({ setHeader: jest.fn(), download: jest.fn() }) as any;
  const req = { user: teacher };

  it('upload helpers', () => {
    const cb = jest.fn();
    assignmentFilename({}, { originalname: 'a.pdf' }, cb);
    submissionFilename({}, { originalname: 'b.pdf' }, cb);
    acceptAnyFile({}, undefined, cb);
    expect(cb.mock.calls[0][1]).toMatch(/^task-\d+-\d+-a\.pdf$/);
    expect(cb.mock.calls[1][1]).toMatch(/^submission-\d+-\d+-b\.pdf$/);
    expect(cb.mock.calls[2]).toEqual([null, true]);
  });

  it('streams stored files as private downloads', () => {
    const absolute = writeFile(`${PRIVATE_ASSIGNMENT_DIR}/task-1-2-enonce.pdf`);
    const response = res();
    sendStoredFile(response, `${PRIVATE_ASSIGNMENT_DIR}/task-1-2-enonce.pdf`);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store',
    );
    expect(response.download).toHaveBeenCalledWith(absolute, 'enonce.pdf');
    expect(() =>
      sendStoredFile(res(), `${PRIVATE_ASSIGNMENT_DIR}/gone.pdf`),
    ).toThrow(NotFoundException);
    expect(() => sendStoredFile(res(), '../../etc/passwd')).toThrow(
      NotFoundException,
    );
  });

  it('lists assignments with the caller so hand-ins stay private', async () => {
    const { svc, access, ctrl } = make();
    await ctrl.getByClass(req, 'c');
    await ctrl.getMyAssignments({ user: student });
    expect(access.assertCanViewClass).toHaveBeenCalledWith('c', teacher);
    expect(svc.findByClass).toHaveBeenCalledWith('c', teacher);
    expect(svc.findForStudent).toHaveBeenCalledWith('s1');
  });

  it('serves the teacher document only to the class', async () => {
    const { svc, access, ctrl } = make();
    writeFile(`${PRIVATE_ASSIGNMENT_DIR}/task.pdf`);
    svc.findAssignmentFile.mockResolvedValue({
      classId: 'c',
      filePath: `${PRIVATE_ASSIGNMENT_DIR}/task.pdf`,
    });
    const response = res();
    await ctrl.downloadAssignmentFile({ user: student }, 'a', response);
    expect(access.assertCanViewClass).toHaveBeenCalledWith('c', student);
    expect(response.download).toHaveBeenCalled();

    access.assertCanViewClass.mockRejectedValueOnce(new ForbiddenException());
    const blocked = res();
    await expect(
      ctrl.downloadAssignmentFile({ user: classmate }, 'a', blocked),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(blocked.download).not.toHaveBeenCalled();
  });

  it('lists and serves hand-ins through the service rules', async () => {
    const { svc, ctrl } = make();
    writeFile(`${PRIVATE_ASSIGNMENT_DIR}/hand-in.pdf`);
    await ctrl.listSubmissions(req, 'a');
    expect(svc.listSubmissions).toHaveBeenCalledWith('a', teacher);
    expect(Reflect.getMetadata('roles', ctrl.listSubmissions)).toEqual([
      Role.TEACHER,
      Role.ADMIN,
    ]);

    svc.findSubmissionFile.mockResolvedValue({
      filePath: `${PRIVATE_ASSIGNMENT_DIR}/hand-in.pdf`,
    });
    const response = res();
    await ctrl.downloadSubmissionFile(req, 'a', 'sub', response);
    expect(svc.findSubmissionFile).toHaveBeenCalledWith('a', 'sub', teacher);
    expect(response.download).toHaveBeenCalled();
  });

  it('creates assignments with an optional private document', async () => {
    const { svc, ctrl } = make();
    await ctrl.createAssignment(
      'c',
      { filename: 'task-1-2-f.pdf' },
      { title: 't', description: 'd', dueDate: '2026-12-01' },
      req,
    );
    await ctrl.createAssignment(
      'c',
      undefined,
      { title: 't', dueDate: '2026-12-01' },
      req,
    );
    expect(svc.create.mock.calls).toEqual([
      [
        'c',
        't',
        'd',
        new Date('2026-12-01'),
        `${PRIVATE_ASSIGNMENT_DIR}/task-1-2-f.pdf`,
        't1',
      ],
      ['c', 't', undefined, new Date('2026-12-01'), undefined, 't1'],
    ]);
  });

  it('drops the uploaded document when creation is refused', async () => {
    const { access, ctrl } = make();
    const upload = writeFile(`${PRIVATE_ASSIGNMENT_DIR}/task-1-2-f.pdf`);
    access.assertCanManageClass.mockRejectedValueOnce(new ForbiddenException());
    await expect(
      ctrl.createAssignment(
        'c',
        { filename: 'task-1-2-f.pdf' },
        { title: 't', dueDate: '2026-12-01' },
        req,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fs.existsSync(upload)).toBe(false);
    await expect(
      ctrl.createAssignment(
        'c',
        undefined,
        { title: 't', dueDate: 'bad' },
        req,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('submits, and drops the upload when the hand-in is refused', async () => {
    const { svc, ctrl } = make();
    await expect(
      ctrl.submitAssignment('a', undefined, { user: student }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await ctrl.submitAssignment('a', { filename: 'x.pdf' }, { user: student });
    expect(svc.submitAssignment).toHaveBeenCalledWith(
      'a',
      's1',
      `${PRIVATE_ASSIGNMENT_DIR}/x.pdf`,
    );
    expect(Reflect.getMetadata('roles', ctrl.submitAssignment)).toEqual([
      Role.STUDENT,
    ]);

    const upload = writeFile(`${PRIVATE_ASSIGNMENT_DIR}/y.pdf`);
    svc.submitAssignment.mockRejectedValueOnce(
      new BadRequestException('graded'),
    );
    await expect(
      ctrl.submitAssignment('a', { filename: 'y.pdf' }, { user: student }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fs.existsSync(upload)).toBe(false);
  });

  it('grades only as the creator, and deletes', async () => {
    const { svc, access, ctrl } = make();
    await ctrl.gradeSubmission(req, 'a', 'sub', { grade: 9, feedback: 'ok' });
    expect(access.assertCanManageSubmission).toHaveBeenCalledWith(
      'a',
      'sub',
      teacher,
    );
    expect(svc.assertIsCreator).toHaveBeenCalledWith('a', teacher);
    expect(svc.gradeSubmission).toHaveBeenCalledWith('sub', 9, 'ok');

    svc.assertIsCreator.mockRejectedValueOnce(new ForbiddenException());
    svc.gradeSubmission.mockClear();
    await expect(
      ctrl.gradeSubmission({ user: otherTeacher }, 'a', 'sub', { grade: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(svc.gradeSubmission).not.toHaveBeenCalled();

    await ctrl.deleteAssignment(req, 'a');
    expect(access.assertCanManageAssignment).toHaveBeenCalledWith('a', teacher);
    expect(svc.delete).toHaveBeenCalledWith('a');
  });
});
