import { describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { createPrismaMock } from './test-utils/prisma-mock';
import { AssignmentsService } from './assignments/assignments.service';
import { UssdMenuService } from './hybrid-gateway/services/ussd-menu.service';
import { OperatorAdapterRegistryService } from './hybrid-gateway/services/operator-adapter-registry.service';
import { DigicelAdapter } from './hybrid-gateway/adapters/digicel.adapter';
import { NatcomAdapter } from './hybrid-gateway/adapters/natcom.adapter';
import { FinanceObservabilityService } from './finance-integration/services/finance-observability.service';

describe('AssignmentsService', () => {
  it('only accepts submissions from students enrolled in the class', async () => {
    const prisma = createPrismaMock();
    const svc = new AssignmentsService(prisma as any);
    prisma.assignment.findFirst.mockResolvedValueOnce(null);
    await expect(svc.submitAssignment('ghost', 's', 'f')).rejects.toThrow('Assignment not found');
    prisma.assignment.findFirst.mockResolvedValueOnce({ id: 'a', class: { students: [] } });
    await expect(svc.submitAssignment('a', 'outsider', 'f')).rejects.toThrow('not enrolled');
    expect(prisma.assignment.findFirst.mock.calls[1][0].select.class.select.students.where).toEqual({ id: 'outsider' });
    expect(prisma.assignmentSubmission.upsert).not.toHaveBeenCalled();
  });

  it('marks submissions as submitted or late against the due date', async () => {
    const prisma = createPrismaMock();
    const svc = new AssignmentsService(prisma as any);
    prisma.assignment.findFirst
      .mockResolvedValueOnce({ id: 'a', dueDate: new Date(Date.now() + 60_000), class: { students: [{ id: 's' }] } })
      .mockResolvedValueOnce({ id: 'a', dueDate: new Date(Date.now() - 60_000), class: { students: [{ id: 's' }] } });
    await svc.submitAssignment('a', 's', 'f1');
    await svc.submitAssignment('a', 's', 'f2');
    const calls = prisma.assignmentSubmission.upsert.mock.calls.map((c: any) => c[0]);
    expect(calls[0].create.status).toBe('SUBMITTED');
    expect(calls[1].update).toMatchObject({ filePath: 'f2', status: 'LATE' });
  });

  it('runs every prisma operation', async () => {
    const prisma = createPrismaMock();
    const svc = new AssignmentsService(prisma as any);
    const due = new Date('2026-12-01');
    prisma.class.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    prisma.assignment.findFirst.mockResolvedValue({ id: 'a', dueDate: new Date('2999-01-01'), class: { students: [{ id: 's' }] } });

    await svc.create('c', 't', 'd', due, 'f', 'u');
    await svc.findByClass('c');
    await svc.findById('a');
    await svc.findForStudent('s');
    await svc.submitAssignment('a', 's', 'f');
    await svc.update('a', 't', undefined, due);
    await svc.gradeSubmission('sub', 9, 'ok');
    await svc.delete('a');

    expect(prisma.assignment.create.mock.calls[0][0].data).toEqual({
      classId: 'c',
      title: 't',
      description: 'd',
      dueDate: due,
      filePath: 'f',
      createdById: 'u',
    });
    expect(prisma.assignment.findMany.mock.calls[1][0].where).toEqual({
      classId: { in: ['c1', 'c2'] },
    });
    expect(prisma.assignmentSubmission.upsert.mock.calls[0][0].where).toEqual({
      assignmentId_studentId: { assignmentId: 'a', studentId: 's' },
    });
    expect(prisma.assignment.update.mock.calls[0][0]).toEqual({
      where: { id: 'a' },
      data: { title: 't', description: undefined, dueDate: due },
    });
    expect(prisma.assignmentSubmission.update.mock.calls[0][0]).toEqual({
      where: { id: 'sub' },
      data: { grade: 9, feedback: 'ok' },
    });
    expect(prisma.assignment.delete).toHaveBeenCalledWith({ where: { id: 'a' } });
    expect(prisma.assignment.findUnique.mock.calls[0][0].where).toEqual({ id: 'a' });
  });
});

describe('UssdMenuService', () => {
  const svc = new UssdMenuService();
  it.each([
    ['', false, 'Meni EduHaiti'],
    ['  ', false, 'Meni EduHaiti'],
    ['1', false, 'Tape: 1*'],
    ['1*S1', true, 'S1'],
    ['2', true, 'Kalandriye'],
    ['3', true, 'AVI'],
    ['4', false, 'Tape: 4*'],
    ['4*S1', true, 'S1'],
    ['9', true, 'Opsyon pa valid'],
  ])('handles %j', (input, end, text) => {
    const r = svc.handle(input);
    expect(r.endSession).toBe(end);
    expect(r.text).toContain(text);
  });
});

describe('OperatorAdapterRegistryService', () => {
  const registry = new OperatorAdapterRegistryService(new DigicelAdapter(), new NatcomAdapter());

  it('resolves known operators', () => {
    expect(registry.resolve('digicel')).toBeInstanceOf(DigicelAdapter);
    expect(registry.resolve('natcom')).toBeInstanceOf(NatcomAdapter);
  });

  it('falls back to a generic adapter', () => {
    const a = registry.resolve('other');
    expect(a.canHandle()).toBe(true);
    expect(a.normalizeSms({ phone: 5, body: 'b', sessionId: 's', requestId: 'r' })).toEqual({
      channel: 'sms',
      operator: 'unknown',
      senderPhone: '5',
      text: 'b',
      sessionId: 's',
      requestId: 'r',
    });
    expect(a.normalizeSms({ msisdn: 'm', text: 't' })).toMatchObject({
      sessionId: undefined,
      requestId: undefined,
    });
    expect(a.normalizeSms({ from: 'f', message: {} })).toMatchObject({
      senderPhone: 'f',
      text: '',
    });
    const withSession = a.normalizeUssd({ session: 's', from: 'f', input: '1', requestId: 'r' });
    expect(withSession).toMatchObject({ sessionId: 's', text: '1', requestId: 'r' });
    const generated = a.normalizeUssd({ msisdn: 'm', text: 't' });
    expect(generated.sessionId).toEqual(expect.any(String));
    expect(generated.sessionId.length).toBeGreaterThan(0);
    expect(a.normalizeUssd({ sessionId: 'x', phone: 'p' }).sessionId).toBe('x');
    expect(a.formatSmsResponse('x')).toEqual({ message: 'x' });
    expect(a.formatUssdResponse('y', true)).toEqual({ response: 'y', action: 'end' });
    expect(a.formatUssdResponse('y', false)).toEqual({ response: 'y', action: 'continue' });
  });
});

describe('FinanceObservabilityService', () => {
  const quiet = () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  };

  it('logs at each level without persisting by default', async () => {
    quiet();
    const prisma = createPrismaMock();
    const svc = new FinanceObservabilityService(prisma as any);
    await svc.logPaymentStage('REQUEST_RECEIVED', {});
    await svc.logPaymentStage('SIGNATURE_REJECTED', {}, { level: 'warn' });
    await svc.logPaymentStage('IDEMPOTENCY_FAILED', {}, { level: 'error' });
    expect(Logger.prototype.log).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it('persists audit with the best available entity id', async () => {
    quiet();
    const prisma = createPrismaMock();
    const tx = createPrismaMock();
    const svc = new FinanceObservabilityService(prisma as any);
    await svc.logPaymentStage('REQUEST_RECEIVED', { idempotencyKey: 'k' }, { persistAudit: true });
    await svc.logPaymentStage('REQUEST_RECEIVED', { transferId: 't' }, { persistAudit: true });
    await svc.logPaymentStage('REQUEST_RECEIVED', { paymentId: 'p' }, { persistAudit: true, tx: tx as any });
    await svc.logPaymentStage('REQUEST_RECEIVED', { idempotencyKey: 5 }, { persistAudit: true });
    const ids = prisma.auditLog.create.mock.calls.map((c: any) => c[0].data.resourceId);
    expect(ids[0]).toBe('k');
    expect(ids[1]).toBe('t');
    expect(ids[2]).toEqual(expect.any(String));
    expect(tx.auditLog.create.mock.calls[0][0].data.resourceId).toBe('p');
    jest.restoreAllMocks();
  });

  it('swallows audit persistence errors', async () => {
    quiet();
    const prisma = createPrismaMock();
    prisma.auditLog.create.mockRejectedValue(new Error('db down'));
    const svc = new FinanceObservabilityService(prisma as any);
    await expect(
      svc.logPaymentStage('CREDIT_COMPLETED', {}, { persistAudit: true }),
    ).resolves.toBeUndefined();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      expect.stringContaining('AUDIT_PERSIST_FAILED'),
    );
    jest.restoreAllMocks();
  });
});
