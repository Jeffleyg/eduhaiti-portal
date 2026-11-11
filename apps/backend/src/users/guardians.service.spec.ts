import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from '@jest/globals';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { GuardiansService, normalizePhone } from './guardians.service';

describe('normalizePhone', () => {
  it('keeps digits and a leading plus', () => {
    expect(normalizePhone(' +509 3712-3456 ')).toBe('+50937123456');
    expect(normalizePhone('(37) 12.34.56')).toBe('37123456');
  });
});

describe('GuardiansService.fromStudentForm', () => {
  it('creates one guardian per phone with sensible names', () => {
    expect(GuardiansService.fromStudentForm({})).toEqual([]);
    expect(
      GuardiansService.fromStudentForm({ fatherName: ' Jean ', fatherPhone: '1', motherPhone: '2', lastName: 'Lima' }),
    ).toEqual([
      { fullName: 'Jean', phoneNumber: '1', relationship: 'FATHER' },
      { fullName: 'Mãe Lima', phoneNumber: '2', relationship: 'MOTHER' },
    ]);
    expect(GuardiansService.fromStudentForm({ fatherPhone: '1', motherName: 'Rose', motherPhone: ' ' })).toEqual([
      { fullName: 'Pai', phoneNumber: '1', relationship: 'FATHER' },
    ]);
  });
});

describe('GuardiansService', () => {
  let prisma: PrismaMock;
  let svc: GuardiansService;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new GuardiansService(prisma as any);
    prisma.guardianStudent.findMany.mockResolvedValue([{ guardian: { id: 'g1' } }]);
  });

  it('validates phones and names', async () => {
    await expect(
      svc.replaceForStudent('s', [{ fullName: 'A', phoneNumber: '123', relationship: 'FATHER' }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.replaceForStudent('s', [{ fullName: 'A', phoneNumber: '1'.repeat(16), relationship: 'FATHER' }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.replaceForStudent('s', [{ fullName: ' ', phoneNumber: '37123456', relationship: 'FATHER' }]),
    ).rejects.toThrow('Guardian name is required');
    expect(prisma.guardian.create).not.toHaveBeenCalled();
  });

  it('creates new guardians, reuses known ones and unlinks the rest', async () => {
    prisma.guardian.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sibling-guardian' });
    prisma.guardian.create.mockResolvedValue({ id: 'new-guardian' });
    prisma.guardian.update.mockResolvedValue({ id: 'sibling-guardian' });

    const r = await svc.replaceForStudent('s', [
      { fullName: ' Jean ', phoneNumber: '+509 3712 3456', relationship: 'FATHER', documentId: ' ID1 ' },
      { fullName: 'Rose', phoneNumber: '38000000', relationship: 'MOTHER' },
    ]);

    expect(prisma.guardian.findFirst.mock.calls.map((c: any) => c[0].where)).toEqual([
      { phoneNumber: '+50937123456', documentId: 'ID1' },
      { phoneNumber: '38000000', documentId: null },
    ]);
    expect(prisma.guardian.create.mock.calls[0][0].data).toEqual({
      fullName: 'Jean',
      phoneNumber: '+50937123456',
      documentId: 'ID1',
      relationship: 'FATHER',
    });
    expect(prisma.guardian.update.mock.calls[0][0]).toEqual({
      where: { id: 'sibling-guardian' },
      data: { fullName: 'Rose', relationship: 'MOTHER' },
    });
    expect(prisma.guardianStudent.upsert.mock.calls.map((c: any) => c[0].create)).toEqual([
      { guardianId: 'new-guardian', studentId: 's' },
      { guardianId: 'sibling-guardian', studentId: 's' },
    ]);
    expect(prisma.guardianStudent.deleteMany).toHaveBeenCalledWith({
      where: { studentId: 's', guardianId: { notIn: ['new-guardian', 'sibling-guardian'] } },
    });
    expect(r).toEqual([{ id: 'g1' }]);
  });

  it('removes every link when the list is empty, using the given transaction', async () => {
    const tx = createPrismaMock();
    tx.guardianStudent.findMany.mockResolvedValue([]);
    await svc.replaceForStudent('s', [], tx as any);
    expect(tx.guardianStudent.deleteMany).toHaveBeenCalledWith({
      where: { studentId: 's', guardianId: { notIn: [] } },
    });
    expect(prisma.guardianStudent.deleteMany).not.toHaveBeenCalled();
  });

  it('only finds students of the given school', async () => {
    await expect(svc.assertStudentInSchool('s', null)).rejects.toBeInstanceOf(NotFoundException);
    prisma.user.findFirst.mockResolvedValueOnce(null);
    await expect(svc.assertStudentInSchool('s', 'sc')).rejects.toBeInstanceOf(NotFoundException);
    prisma.user.findFirst.mockResolvedValueOnce({ id: 's' });
    await expect(svc.assertStudentInSchool('s', 'sc')).resolves.toBeUndefined();
    expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ id: 's', role: 'STUDENT', schoolId: 'sc' });
  });
});
