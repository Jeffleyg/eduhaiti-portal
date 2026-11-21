import {
  BadGatewayException,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { PaymentStatus } from '@prisma/client';
import { createPrismaMock, PrismaMock } from '../test-utils/prisma-mock';
import { autoMock, AutoMock } from '../test-utils/auto-mock';
import { FinanceIntegrationService } from './finance-integration.service';

describe('FinanceIntegrationService', () => {
  let prisma: PrismaMock;
  let moncash: AutoMock;
  let natcash: AutoMock;
  let fx: AutoMock;
  let observability: AutoMock;
  let sms: AutoMock;
  let did: AutoMock;
  let ledger: AutoMock;
  let svc: FinanceIntegrationService;

  const student = { id: 'st', enrollmentNumber: 'E1', email: 'e', name: 'Ana' };
  const approved = (over: Record<string, unknown> = {}) => ({
    approved: true,
    providerName: 'moncash',
    providerTransactionId: 'tx1',
    netAmountHtg: 990,
    feeAmountHtg: 10,
    ...over,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    moncash = autoMock();
    natcash = autoMock();
    fx = autoMock();
    observability = autoMock();
    sms = autoMock();
    did = autoMock();
    ledger = autoMock();
    ledger.append.mockResolvedValue({ hash: 'h' });
    svc = new FinanceIntegrationService(
      prisma as any,
      moncash as any,
      natcash as any,
      fx as any,
      undefined as any, // no idempotency service: decorator calls the method directly
      observability as any,
      sms as any,
      did as any,
      ledger as any,
    );
    prisma.user.findFirst.mockResolvedValue(student);
    prisma.user.findUnique.mockResolvedValue({ schoolId: 'sc' });
    prisma.payment.create.mockImplementation(async (a: any) => ({
      id: 'pay',
      ...a.data,
    }));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.PUNCTUALITY_DISCOUNT_PERCENT;
  });

  describe('resolveSchoolId', () => {
    const resolve = () => (svc as any).resolveSchoolId(prisma, 'st');

    it('prefers the student school, then the latest class', async () => {
      expect(await resolve()).toBe('sc');
      prisma.user.findUnique.mockResolvedValue({ schoolId: null });
      prisma.class.findFirst.mockResolvedValue({
        academicYear: { schoolId: 'from-class' },
      });
      expect(await resolve()).toBe('from-class');
    });

    it('falls back only when a single school exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.class.findFirst.mockResolvedValue(null);
      prisma.school.findMany.mockResolvedValueOnce([{ id: 'only' }]);
      expect(await resolve()).toBe('only');
      prisma.school.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
      await expect(resolve()).rejects.toBeInstanceOf(NotFoundException);
      prisma.class.findFirst.mockResolvedValue({ academicYear: null });
      prisma.school.findMany.mockResolvedValueOnce([]);
      await expect(resolve()).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('processMobileMoneyPayment', () => {
    const dto = {
      provider: 'moncash',
      studentEnrollmentNumber: 'E1',
      accountNumber: '509',
      amountHtg: 1000,
      idempotencyKey: 'k',
    } as any;

    it('validates the student, provider and approval', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(svc.processMobileMoneyPayment(dto)).rejects.toThrow(
        'Student enrollment not found',
      );
      await expect(
        svc.processMobileMoneyPayment({ ...dto, provider: 'paypal' }),
      ).rejects.toThrow('Provider not supported');
      moncash.processCharge.mockResolvedValueOnce(
        approved({ approved: false }),
      );
      await expect(svc.processMobileMoneyPayment(dto)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('credits the payment to the student school and records it', async () => {
      natcash.processCharge.mockResolvedValue(
        approved({ providerName: 'natcash' }),
      );
      const r = await svc.processMobileMoneyPayment({
        ...dto,
        provider: 'natcash',
      });
      expect(r).toEqual({
        paymentId: 'pay',
        provider: 'natcash',
        netAmountHtg: 990,
        feeAmountHtg: 10,
        receiptNumber: 'tx1',
        ledgerHash: 'h',
      });
      expect(prisma.payment.create.mock.calls[0][0].data).toMatchObject({
        schoolId: 'sc',
        status: PaymentStatus.PAID,
      });
      expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe(
        'MOBILE_MONEY_CREDIT',
      );
      expect(observability.logPaymentStage).toHaveBeenCalledWith(
        'CREDIT_COMPLETED',
        expect.objectContaining({ channel: 'mobile-money' }),
        { tx: undefined, persistAudit: true },
      );
    });

    it('uses the transaction client when called through idempotency', async () => {
      const tx = createPrismaMock();
      tx.user.findFirst.mockResolvedValue(student);
      tx.user.findUnique.mockResolvedValue({ schoolId: 'tx-school' });
      tx.payment.create.mockResolvedValue({ id: 'p-tx' });
      moncash.processCharge.mockResolvedValue(approved());
      const withIdem = new FinanceIntegrationService(
        prisma as any,
        moncash as any,
        natcash as any,
        fx as any,
        {
          executeWithIdempotency: async (
            _k: string,
            _o: string,
            fn: (t: unknown) => unknown,
          ) => fn(tx),
        } as any,
        observability as any,
        sms as any,
        did as any,
        ledger as any,
      );
      expect((await withIdem.processMobileMoneyPayment(dto)).paymentId).toBe(
        'p-tx',
      );
      expect(tx.payment.create.mock.calls[0][0].data.schoolId).toBe(
        'tx-school',
      );
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('processGuardianTuitionPayment', () => {
    const dto = (over: Record<string, unknown> = {}) =>
      ({
        provider: 'moncash',
        studentEnrollmentNumber: 'E1',
        accountNumber: '509',
        amountHtg: 1000,
        idempotencyKey: 'k',
        ...over,
      }) as any;

    it('validates student, provider, approval and the tuition charge', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(svc.processGuardianTuitionPayment(dto())).rejects.toThrow(
        'Student enrollment not found',
      );
      await expect(
        svc.processGuardianTuitionPayment(dto({ provider: 'x' })),
      ).rejects.toThrow('Provider not supported');
      moncash.processCharge.mockResolvedValueOnce(
        approved({ approved: false }),
      );
      await expect(
        svc.processGuardianTuitionPayment(dto()),
      ).rejects.toBeInstanceOf(BadGatewayException);

      moncash.processCharge.mockResolvedValue(approved());
      prisma.payment.findFirst.mockResolvedValueOnce(null);
      await expect(
        svc.processGuardianTuitionPayment(dto({ tuitionPaymentId: 't' })),
      ).rejects.toThrow('Tuition charge not found');
      prisma.payment.findFirst.mockResolvedValueOnce({
        id: 't',
        amount: 500,
        status: PaymentStatus.PAID,
      });
      await expect(
        svc.processGuardianTuitionPayment(dto({ tuitionPaymentId: 't' })),
      ).rejects.toThrow('already paid');
    });

    it('settles an existing charge fully or partially', async () => {
      moncash.processCharge.mockResolvedValue(approved());
      prisma.payment.update.mockImplementation(async (a: any) => ({
        id: 't',
        amount: 0,
        dueDate: new Date(),
        ...a.data,
      }));
      prisma.$queryRaw.mockResolvedValue([]);

      prisma.payment.findFirst.mockResolvedValueOnce({
        id: 't',
        amount: 900,
        status: PaymentStatus.OVERDUE,
      });
      const paid = await svc.processGuardianTuitionPayment(
        dto({ tuitionPaymentId: 't' }),
      );
      expect(paid.paymentStatus).toBe(PaymentStatus.PAID);
      expect(prisma.payment.update.mock.calls[0][0].data.description).toMatch(
        /^Overdue tuition payment; provider=moncash/,
      );

      prisma.payment.findFirst.mockResolvedValueOnce({
        id: 't',
        amount: 5000,
        status: PaymentStatus.PENDING,
      });
      const partial = await svc.processGuardianTuitionPayment(
        dto({ tuitionPaymentId: 't' }),
      );
      expect(partial.paymentStatus).toBe(PaymentStatus.PARTIAL);
      expect(prisma.payment.update.mock.calls[1][0].data.description).toMatch(
        /^Tuition payment;/,
      );
    });

    it('creates a direct payment and confirms by SMS with the given phone', async () => {
      moncash.processCharge.mockResolvedValue(approved());
      const r = await svc.processGuardianTuitionPayment(
        dto({ guardianName: 'G', guardianPhone: ' 509 ' }),
      );
      expect(r).toMatchObject({
        paymentId: 'pay',
        paymentStatus: PaymentStatus.PAID,
        grossAmountHtg: 1000,
        ledgerHash: 'h',
      });
      expect(
        prisma.auditLog.create.mock.calls[0][0].data.changes,
      ).toMatchObject({ guardianName: 'G', guardianPhone: ' 509 ' });
      expect(sms.sendSms.mock.calls[0][0]).toMatchObject({
        to: '509',
        operatorHint: 'digicel',
      });
      expect(sms.sendSms.mock.calls[0][0].text).toContain('Estati: PEYE');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('looks up the guardian phone, labels partial payments and tolerates SMS failures', async () => {
      moncash.processCharge.mockResolvedValue(approved());
      prisma.payment.findFirst.mockResolvedValue({
        id: 't',
        amount: 5000,
        status: PaymentStatus.PENDING,
      });
      prisma.payment.update.mockResolvedValue({
        id: 't',
        amount: 5000,
        status: PaymentStatus.PARTIAL,
        dueDate: new Date(),
      });

      prisma.$queryRaw.mockResolvedValueOnce([{ phoneNumber: ' 510 ' }]);
      sms.sendSms.mockRejectedValueOnce(new Error('gateway down'));
      prisma.user.findFirst.mockResolvedValueOnce({ ...student, name: null });
      await svc.processGuardianTuitionPayment(dto({ tuitionPaymentId: 't' }));
      expect(sms.sendSms.mock.calls[0][0].to).toBe('510');
      expect(sms.sendSms.mock.calls[0][0].text).toContain(
        'pou E1. Estati: PASYÈL',
      );

      prisma.$queryRaw.mockResolvedValueOnce([{ phoneNumber: '511' }]);
      sms.sendSms.mockRejectedValueOnce('weird');
      await svc.processGuardianTuitionPayment(dto({ tuitionPaymentId: 't' }));
      const warns = (Logger.prototype.warn as jest.Mock).mock.calls.map(
        (c) => c[0],
      );
      expect(warns).toEqual([
        expect.stringContaining('gateway down'),
        expect.stringContaining('guardian_sms_unknown_error'),
      ]);

      prisma.$queryRaw.mockResolvedValueOnce([{ phoneNumber: null }]);
      await svc.processGuardianTuitionPayment(dto({ tuitionPaymentId: 't' }));
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await svc.processGuardianTuitionPayment(dto({ tuitionPaymentId: 't' }));
      expect(sms.sendSms).toHaveBeenCalledTimes(2);
    });

    it('skips SMS for providers other than MonCash', async () => {
      natcash.processCharge.mockResolvedValue(
        approved({ providerName: 'natcash' }),
      );
      await svc.processGuardianTuitionPayment(
        dto({ provider: 'natcash', guardianPhone: '509' }),
      );
      expect(sms.sendSms).not.toHaveBeenCalled();
    });
  });

  it('truncates SMS texts to 160 chars', () => {
    const cut = (t: string) => (svc as any).to160Chars(t);
    expect(cut('short  text')).toBe('short text');
    expect(cut('word '.repeat(60)).length).toBeLessThanOrEqual(160);
    expect(cut('x'.repeat(200))).toBe('x'.repeat(157) + '...');
  });

  describe('listPendingTuitionByEnrollment', () => {
    it('validates input and student', async () => {
      await expect(
        svc.listPendingTuitionByEnrollment('  '),
      ).rejects.toBeInstanceOf(BadRequestException);
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        svc.listPendingTuitionByEnrollment('E1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sums pending charges', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { amount: 100 },
        { amount: 50.5 },
      ]);
      expect(await svc.listPendingTuitionByEnrollment(' E1 ')).toEqual({
        student: { enrollmentNumber: 'E1', name: 'Ana' },
        charges: [{ amount: 100 }, { amount: 50.5 }],
        totalPendingHtg: 150.5,
      });
    });
  });

  describe('createTuitionCharge', () => {
    const dto = (over: Record<string, unknown> = {}) =>
      ({
        studentEnrollmentNumber: 'E1',
        amountHtg: 1000,
        dueDate: '2026-12-01',
        ...over,
      }) as any;
    const punctual = () => {
      prisma.payment.findMany.mockResolvedValue([
        { dueDate: new Date('2026-02-01'), paidDate: new Date('2026-01-30') },
        { dueDate: new Date('2026-01-01'), paidDate: new Date('2026-01-01') },
      ]);
      prisma.payment.count.mockResolvedValue(0);
    };

    it('validates the student and date, scoped to the admin school', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        svc.createTuitionCharge(dto(), 'adm', 'sc'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.user.findFirst.mock.calls[0][0].where.OR).toEqual([
        { schoolId: 'sc' },
        { classesAttending: { some: { academicYear: { schoolId: 'sc' } } } },
      ]);
      await expect(
        svc.createTuitionCharge(dto({ dueDate: 'bad' }), 'adm'),
      ).rejects.toThrow('Invalid dueDate');
      expect(prisma.user.findFirst.mock.calls[1][0].where.OR).toBeUndefined();
    });

    it('applies scholarship and punctuality discounts', async () => {
      punctual();
      const r = await svc.createTuitionCharge(
        dto({
          scholarshipPercent: 20,
          scholarshipLabel: ' Merit ',
          description: ' Sept ',
        }),
        'adm',
      );
      expect(r.amount).toBe(750);
      const description =
        prisma.payment.create.mock.calls[0][0].data.description;
      expect(description).toBe(
        'Sept; base=1000 HTG; discount=250 HTG; final=750 HTG; scholarship=20%; punctuality=5%; tags=BOLSA:Merit|PONTUALIDADE',
      );
      expect(ledger.append.mock.calls[0][1]).toBe('tuition-charge');
    });

    it('caps discounts and keeps a minimum amount', async () => {
      punctual();
      process.env.PUNCTUALITY_DISCOUNT_PERCENT = '50';
      await svc.createTuitionCharge(dto({ scholarshipPercent: 150 }), 'adm');
      expect(prisma.payment.create.mock.calls[0][0].data.amount).toBe(200);
      await svc.createTuitionCharge(
        dto({ scholarshipPercent: -5, punctualityDiscountPercent: -1 }),
        'adm',
      );
      expect(prisma.payment.create.mock.calls[1][0].data.description).toBe(
        'Monthly tuition charge; base=1000 HTG; discount=0 HTG; final=1000 HTG',
      );
      await svc.createTuitionCharge(
        dto({ amountHtg: 0, scholarshipPercent: 10 }),
        'adm',
      );
      expect(prisma.payment.create.mock.calls[2][0].data.amount).toBe(0.01);
      expect(prisma.payment.create.mock.calls[2][0].data.description).toContain(
        'tags=BOLSA',
      );
    });

    it('skips punctuality when disabled or not eligible', async () => {
      await svc.createTuitionCharge(
        dto({ applyPunctualityDiscount: false }),
        'adm',
      );
      expect(prisma.payment.findMany).not.toHaveBeenCalled();

      prisma.payment.count.mockResolvedValue(1);
      prisma.payment.findMany.mockResolvedValue([]);
      await svc.createTuitionCharge(dto(), 'adm');
      prisma.payment.count.mockResolvedValue(0);
      prisma.payment.findMany.mockResolvedValue([
        { dueDate: new Date(), paidDate: new Date() },
      ]);
      await svc.createTuitionCharge(dto(), 'adm');
      prisma.payment.findMany.mockResolvedValue([
        { dueDate: new Date('2026-01-01'), paidDate: new Date('2026-01-05') },
        { dueDate: new Date('2026-02-01'), paidDate: new Date('2026-01-05') },
      ]);
      await svc.createTuitionCharge(dto(), 'adm');
      prisma.payment.findMany.mockResolvedValue([
        { dueDate: new Date('2026-01-01'), paidDate: null },
        { dueDate: new Date('2026-02-01'), paidDate: new Date('2026-01-05') },
      ]);
      await svc.createTuitionCharge(dto(), 'adm');
      const amounts = prisma.payment.create.mock.calls.map(
        (c: any) => c[0].data.amount,
      );
      expect(amounts).toEqual([1000, 1000, 1000, 1000, 1000]);
    });
  });

  describe('createInstallmentPlan', () => {
    const dto = (over: Record<string, unknown> = {}) =>
      ({
        studentEnrollmentNumber: 'E1',
        firstDueDate: '2026-12-01',
        installments: 3,
        ...over,
      }) as any;

    it('validates input', async () => {
      await expect(
        svc.createInstallmentPlan(dto({ studentEnrollmentNumber: ' ' }), 'adm'),
      ).rejects.toThrow('studentEnrollmentNumber is required');
      await expect(
        svc.createInstallmentPlan(dto({ firstDueDate: 'x' }), 'adm'),
      ).rejects.toThrow('Invalid firstDueDate');
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        svc.createInstallmentPlan(dto(), 'adm', 'sc'),
      ).rejects.toBeInstanceOf(NotFoundException);
      prisma.payment.findMany.mockResolvedValueOnce([]);
      await expect(svc.createInstallmentPlan(dto(), 'adm')).rejects.toThrow(
        'No eligible debt',
      );
      prisma.payment.findMany.mockResolvedValueOnce([
        { id: 'p', amount: 100, description: null },
      ]);
      await expect(
        svc.createInstallmentPlan(dto({ customTotalAmountHtg: 0 }), 'adm'),
      ).rejects.toThrow('greater than zero');
    });

    it('splits the debt, marks sources and records the plan', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: 'p1', amount: 50, description: null },
        { id: 'p2', amount: 50, description: 'Sept' },
      ]);
      prisma.payment.create.mockImplementation(async (a: any) => ({
        id: `i${a.data.amount}`,
        ...a.data,
      }));
      const r = await svc.createInstallmentPlan(
        dto({ sourcePaymentIds: [' p1 ', ' ', 'p2'], description: ' Reneg ' }),
        'adm',
      );
      expect(prisma.payment.findMany.mock.calls[0][0].where.id).toEqual({
        in: ['p1', 'p2'],
      });
      expect(r.sourceTotalHtg).toBe(100);
      expect(r.installments.map((i) => i.amountHtg)).toEqual([
        33.34, 33.33, 33.33,
      ]);
      expect(r.installments[1].dueDate).toEqual(
        new Date(new Date('2026-12-01').getTime() + 30 * 86400000),
      );
      const updates = prisma.payment.update.mock.calls.map(
        (c: any) => c[0].data.description,
      );
      expect(updates[0]).toMatch(
        /^Renegotiated tuition debt; \[RENEGOTIATED\]; plan=PLAN-/,
      );
      expect(updates[1]).toMatch(/^Sept; \[RENEGOTIATED\]/);
      expect(prisma.payment.create.mock.calls[0][0].data.description).toMatch(
        /^Reneg; plan=PLAN-.*; installment=1\/3$/,
      );
      expect(r.ledgerHash).toBe('h');
    });

    it('can keep sources untouched and use custom totals/intervals', async () => {
      prisma.payment.findMany.mockResolvedValue([
        { id: 'p1', amount: 90, description: null },
      ]);
      const r = await svc.createInstallmentPlan(
        dto({
          markSourceAsRenegotiated: false,
          customTotalAmountHtg: 60,
          installments: 2,
          intervalDays: 7,
        }),
        'adm',
      );
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.payment.findMany.mock.calls[0][0].where).not.toHaveProperty(
        'id',
      );
      expect(r.renegotiatedTotalHtg).toBe(60);
      expect(prisma.payment.create.mock.calls[0][0].data.description).toMatch(
        /^Installment plan renegotiation;/,
      );
    });
  });

  it('builds and records the financial audit report', async () => {
    ledger.buildFinancialTransparencyReport.mockResolvedValue({
      generatedAt: 'g',
      totalRecords: 1,
      integrity: { valid: true },
      byCategory: {},
      lastHash: 'L',
    });
    prisma.payment.findMany.mockResolvedValue([
      { id: 'pay-1' },
      { id: 'pay-2' },
    ]);
    const r = await svc.getFinancialAuditReport(
      { startDate: 'a', endDate: 'b', limit: 5 } as any,
      'sc',
    );
    expect(r.lastHash).toBe('L');
    expect(prisma.payment.findMany.mock.calls[0][0]).toEqual({
      where: { schoolId: 'sc' },
      select: { id: true },
    });

    // Only this school's records leave the server.
    const { include } =
      ledger.buildFinancialTransparencyReport.mock.calls[0][0];
    const rec = (transactionId: string, category: string, payload?: any) => ({
      transactionId,
      category,
      payload,
    });
    expect(include(rec('pay-1', 'mobile-money', {}))).toBe(true);
    expect(include(rec('other-school-payment', 'guardian-tuition', {}))).toBe(
      false,
    );
    expect(
      include(
        rec('plan', 'installment-plan', { sourcePaymentIds: ['x', 'pay-2'] }),
      ),
    ).toBe(true);
    expect(
      include(rec('plan', 'installment-plan', { sourcePaymentIds: ['x'] })),
    ).toBe(false);
    expect(include(rec('plan', 'installment-plan', {}))).toBe(false);
    expect(
      include(rec('audit-1', 'finance-audit-report', { schoolId: 'sc' })),
    ).toBe(true);
    expect(
      include(rec('audit-2', 'finance-audit-report', { schoolId: 'other' })),
    ).toBe(false);
    expect(include(rec('did', 'did-key', undefined))).toBe(false);
    expect(ledger.append.mock.calls[0][2]).toMatchObject({ schoolId: 'sc' });
    expect(prisma.auditLog.create.mock.calls[0][0].data.resourceId).toBe('L');
    expect(ledger.append.mock.calls[0][1]).toBe('finance-audit-report');
  });

  describe('admin payments', () => {
    it('lists with defaults and filters', async () => {
      prisma.payment.count.mockResolvedValue(0);
      prisma.payment.findMany.mockResolvedValue([]);
      expect(await svc.listPaymentsForAdmin({} as any)).toEqual({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
        rows: [],
      });
      expect(prisma.payment.findMany.mock.calls[0][0].where).toEqual({
        status: undefined,
      });

      prisma.payment.count.mockResolvedValue(45);
      const r = await svc.listPaymentsForAdmin(
        {
          page: 2,
          pageSize: 10,
          status: 'PAID',
          startDate: '2026-01-01',
          endDate: '2026-02-01',
          studentEnrollmentNumber: ' E1 ',
        } as any,
        'sc',
      );
      expect(r).toMatchObject({ page: 2, totalPages: 5 });
      expect(prisma.payment.findMany.mock.calls[1][0]).toMatchObject({
        skip: 10,
        where: {
          schoolId: 'sc',
          status: 'PAID',
          dueDate: { gte: new Date('2026-01-01'), lte: new Date('2026-02-01') },
          student: { enrollmentNumber: 'E1' },
        },
      });
      await svc.listPaymentsForAdmin({ startDate: '2026-01-01' } as any);
      await svc.listPaymentsForAdmin({ endDate: '2026-02-01' } as any);
      expect(prisma.payment.findMany.mock.calls[2][0].where.dueDate).toEqual({
        gte: new Date('2026-01-01'),
      });
      expect(prisma.payment.findMany.mock.calls[3][0].where.dueDate).toEqual({
        lte: new Date('2026-02-01'),
      });
    });

    it('rejects invalid dates', async () => {
      await expect(
        svc.listPaymentsForAdmin({ startDate: 'x' } as any),
      ).rejects.toThrow('Invalid startDate');
      await expect(
        svc.exportPaymentsCsvForAdmin({ endDate: 'x' } as any, 'sc'),
      ).rejects.toThrow('Invalid endDate');
    });

    it('exports CSV', async () => {
      prisma.payment.findMany.mockResolvedValue([
        {
          id: 'p1',
          student: { name: 'Ana "A"', enrollmentNumber: 'E1' },
          amount: 10,
          status: 'PAID',
          dueDate: new Date('2026-01-01T00:00:00Z'),
          paidDate: new Date('2026-01-02T00:00:00Z'),
          receiptNumber: 'r',
          description: 'd',
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: 'p2',
          student: null,
          amount: 5,
          status: 'PENDING',
          dueDate: new Date('2026-01-01T00:00:00Z'),
          paidDate: null,
          receiptNumber: null,
          description: null,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);
      const csv = await svc.exportPaymentsCsvForAdmin({} as any, 'sc');
      expect(csv.startsWith('\uFEFF')).toBe(true);
      const lines = csv.slice(1).trimEnd().split('\r\n');
      expect(lines[0]).toBe(
        'Reçu;Élève;Matricule;Montant (HTG);Statut;Échéance;Payé le;Description;Créé le;ID paiement',
      );
      expect(lines[1]).toBe(
        'r;"Ana ""A""";E1;10,00;Payé;2026-01-01;2026-01-02;d;2026-01-01;p1',
      );
      expect(lines[2]).toBe(';;;5,00;En attente;2026-01-01;;;2026-01-01;p2');
      expect(prisma.payment.findMany.mock.calls[0][0]).toMatchObject({
        where: { schoolId: 'sc' },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        take: 10000,
      });

      const english = await svc.exportPaymentsCsvForAdmin(
        {} as any,
        'sc',
        'en',
      );
      expect(english.split('\r\n')[2]).toBe(
        ',,,5.00,Pending,2026-01-01,,,2026-01-01,p2',
      );
    });

    it('builds the printable report with totals', async () => {
      const due = (days: number) => new Date(Date.now() + days * 86_400_000);
      prisma.school.findUnique.mockResolvedValue({
        name: 'Lycée',
        address: null,
        city: 'Jacmel',
      });
      prisma.payment.findMany.mockResolvedValue([
        {
          id: 'a',
          student: { name: 'A', enrollmentNumber: 'E1' },
          amount: 100,
          status: 'PAID',
          dueDate: due(-10),
          paidDate: due(-9),
          receiptNumber: 'R1',
          description: null,
          createdAt: due(-20),
        },
        {
          id: 'b',
          student: null,
          amount: 50,
          status: 'PENDING',
          dueDate: due(-1),
          paidDate: null,
          receiptNumber: null,
          description: null,
          createdAt: due(-20),
        },
        {
          id: 'c',
          student: { name: 'C', enrollmentNumber: 'E3' },
          amount: 25,
          status: 'PENDING',
          dueDate: due(5),
          paidDate: null,
          receiptNumber: null,
          description: 'x',
          createdAt: due(-2),
        },
      ]);
      const r = await svc.getPaymentsReport(
        { status: 'PENDING', startDate: '2026-01-01' } as any,
        'sc',
      );
      expect(prisma.school.findUnique).toHaveBeenCalledWith({
        where: { id: 'sc' },
        select: { name: true, address: true, city: true },
      });
      expect(r.school).toEqual({
        name: 'Lycée',
        address: null,
        city: 'Jacmel',
      });
      expect(r.filters).toEqual({
        status: 'PENDING',
        startDate: '2026-01-01',
        endDate: null,
        studentEnrollmentNumber: null,
      });
      expect(r.totals).toEqual({
        count: 3,
        amountHtg: 175,
        paidAmountHtg: 100,
        outstandingAmountHtg: 75,
        overdueCount: 1,
      });
      expect(r.byStatus).toEqual({
        PAID: { count: 1, amountHtg: 100 },
        PENDING: { count: 2, amountHtg: 75 },
      });
      expect(r.truncated).toBe(false);
      expect(r.rows[0]).toMatchObject({
        id: 'a',
        studentName: 'A',
        amountHtg: 100,
        paidDate: expect.any(String),
      });
      expect(r.rows[1]).toMatchObject({
        studentName: null,
        enrollmentNumber: null,
        paidDate: null,
      });

      prisma.payment.findMany.mockResolvedValue([]);
      const empty = await svc.getPaymentsReport({} as any, 'sc');
      expect(empty.totals).toEqual({
        count: 0,
        amountHtg: 0,
        paidAmountHtg: 0,
        outstandingAmountHtg: 0,
        overdueCount: 0,
      });
      expect(empty.filters).toEqual({
        status: null,
        startDate: null,
        endDate: null,
        studentEnrollmentNumber: null,
      });

      prisma.payment.findMany.mockResolvedValue(
        Array.from({ length: 10000 }, (_, i) => ({
          id: String(i),
          student: null,
          amount: 1,
          status: 'PAID',
          dueDate: due(-1),
          paidDate: due(-1),
          receiptNumber: null,
          description: null,
          createdAt: due(-1),
        })),
      );
      expect((await svc.getPaymentsReport({} as any, 'sc')).truncated).toBe(
        true,
      );
    });

    it('summarizes by status', async () => {
      await expect(
        svc.getAdminFinanceSummary({ startDate: 'x' } as any),
      ).rejects.toThrow('Invalid startDate');
      await expect(
        svc.getAdminFinanceSummary({ endDate: 'x' } as any),
      ).rejects.toThrow('Invalid endDate');

      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: null },
        _count: { _all: 0 },
      });
      prisma.payment.groupBy.mockResolvedValue([]);
      expect(await svc.getAdminFinanceSummary({} as any)).toEqual({
        totalPayments: 0,
        totalAmountHtg: 0,
        byStatus: {},
      });

      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: 30 },
        _count: { _all: 3 },
      });
      prisma.payment.groupBy.mockResolvedValue([
        { status: 'PAID', _sum: { amount: 30 }, _count: { _all: 2 } },
        { status: 'PENDING', _sum: { amount: null }, _count: { _all: 1 } },
      ]);
      const r = await svc.getAdminFinanceSummary(
        { startDate: '2026-01-01', endDate: '2026-02-01' } as any,
        'sc',
      );
      expect(r).toEqual({
        totalPayments: 3,
        totalAmountHtg: 30,
        byStatus: {
          PAID: { count: 2, amountHtg: 30 },
          PENDING: { count: 1, amountHtg: 0 },
        },
      });
      expect(prisma.payment.aggregate.mock.calls[1][0].where).toEqual({
        schoolId: 'sc',
        dueDate: { gte: new Date('2026-01-01'), lte: new Date('2026-02-01') },
      });
      await svc.getAdminFinanceSummary({ startDate: '2026-01-01' } as any);
      await svc.getAdminFinanceSummary({ endDate: '2026-02-01' } as any);
    });
  });

  describe('processDiasporaRemittance', () => {
    const dto = {
      transferId: 't1',
      studentEnrollmentNumber: 'E1',
      amount: 100,
      currency: 'USD',
      sourcePlatform: 'remitly',
    } as any;

    it('requires a known student', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(svc.processDiasporaRemittance(dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('converts and credits the remittance', async () => {
      fx.convertToHtg.mockResolvedValue({
        netHtg: 12969,
        fxRateToHtg: 132,
        spreadAmountHtg: 165,
        platformFeeAmountHtg: 66,
      });
      const r = await svc.processDiasporaRemittance(dto);
      expect(r).toEqual({
        paymentId: 'pay',
        transferId: 't1',
        creditedAmountHtg: 12969,
        transparency: {
          sourceAmount: 100,
          sourceCurrency: 'USD',
          fxRateToHtg: 132,
          spreadAmountHtg: 165,
          platformFeeAmountHtg: 66,
        },
        ledgerHash: 'h',
      });
      expect(prisma.payment.create.mock.calls[0][0].data).toMatchObject({
        schoolId: 'sc',
        receiptNumber: 't1',
      });
    });
  });

  it('derives idempotency keys for every idempotent operation', async () => {
    const keys: Array<[string, string]> = [];
    const withIdem = new FinanceIntegrationService(
      prisma as any,
      moncash as any,
      natcash as any,
      fx as any,
      {
        executeWithIdempotency: async (key: string, op: string) => {
          keys.push([key, op]);
          return 'replayed';
        },
      } as any,
      observability as any,
      sms as any,
      did as any,
      ledger as any,
    );
    await withIdem.processMobileMoneyPayment({
      provider: 'moncash',
      idempotencyKey: 'a',
    } as any);
    await withIdem.processGuardianTuitionPayment({
      provider: 'natcash',
      idempotencyKey: 'b',
    } as any);
    await withIdem.processDiasporaRemittance({ transferId: 'tr' } as any);
    expect(keys).toEqual([
      ['mobile-money:moncash:a', 'MOBILE_MONEY_CREDIT'],
      ['guardian-tuition:natcash:b', 'GUARDIAN_TUITION_PAYMENT'],
      ['diaspora:tr', 'DIASPORA_REMITTANCE_CREDIT'],
    ]);
  });

  it('issues and verifies DID trust tokens', async () => {
    did.issueTrustToken.mockResolvedValue({ trustToken: 'tok', expiresAt: 1 });
    did.verifyTrustTokenOffline.mockReturnValue({ deviceId: 'd' });
    expect(await svc.issueDidTrustToken('d', 'E1')).toEqual({
      trustToken: 'tok',
      expiresAt: 1,
      ledgerHash: 'h',
    });
    expect(ledger.append.mock.calls[0][0]).toBe('did-d-E1');
    expect(svc.verifyDidTrustTokenOffline('tok')).toEqual({ deviceId: 'd' });
  });
});
