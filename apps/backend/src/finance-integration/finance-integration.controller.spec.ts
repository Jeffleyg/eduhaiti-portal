import { describe, expect, it, jest } from '@jest/globals';
import { autoMock } from '../test-utils/auto-mock';
import { FinanceIntegrationController } from './finance-integration.controller';

const make = () => {
  const finance = autoMock();
  const signature = autoMock();
  const observability = autoMock();
  const alerts = autoMock();
  const ctrl = new FinanceIntegrationController(
    finance as any,
    signature as any,
    observability as any,
    alerts as any,
  );
  return { finance, signature, observability, alerts, ctrl };
};

describe('FinanceIntegrationController', () => {
  it('logs and processes mobile money and guardian payments', async () => {
    const { finance, observability, ctrl } = make();
    const dto: any = { provider: 'moncash', idempotencyKey: 'k', studentEnrollmentNumber: 'e' };
    await ctrl.payViaMobileMoney(dto);
    await ctrl.payTuitionAsGuardian(dto);
    expect(observability.logPaymentStage).toHaveBeenCalledTimes(2);
    expect(observability.logPaymentStage.mock.calls[0][1]).toMatchObject({
      channel: 'mobile-money',
    });
    expect(observability.logPaymentStage.mock.calls[1][1]).toMatchObject({
      channel: 'guardian-tuition',
    });
    expect(finance.processMobileMoneyPayment).toHaveBeenCalledWith(dto);
    expect(finance.processGuardianTuitionPayment).toHaveBeenCalledWith(dto);
  });

  it('delegates simple routes', async () => {
    const { finance, ctrl } = make();
    const req = { user: { sub: 'a' } };
    await ctrl.getPendingTuition('e');
    await ctrl.issueDidToken({ deviceId: 'd', studentEnrollmentNumber: 'e' } as any);
    await ctrl.verifyDidToken({ trustToken: 't' });
    const adminReq = { user: { sub: 'a', schoolId: 's1' } };
    await ctrl.createTuitionCharge({ x: 1 } as any, adminReq);
    await ctrl.createInstallmentPlan({ y: 1 } as any, req);
    await ctrl.listPayments({ p: 1 } as any, adminReq);
    await ctrl.exportPaymentsCsv({ p: 2 } as any, {});
    await ctrl.getSummary({ p: 3 } as any, adminReq);
    await ctrl.getAuditReport({ p: 4 } as any);
    expect(finance.listPendingTuitionByEnrollment).toHaveBeenCalledWith('e');
    expect(finance.issueDidTrustToken).toHaveBeenCalledWith('d', 'e');
    expect(finance.verifyDidTrustTokenOffline).toHaveBeenCalledWith('t');
    expect(finance.createTuitionCharge).toHaveBeenCalledWith({ x: 1 }, 'a', 's1');
    expect(finance.createInstallmentPlan).toHaveBeenCalledWith({ y: 1 }, 'a', undefined);
    expect(finance.listPaymentsForAdmin).toHaveBeenCalledWith({ p: 1 }, 's1');
    expect(finance.exportPaymentsCsvForAdmin).toHaveBeenCalledWith({ p: 2 }, undefined);
    expect(finance.getAdminFinanceSummary).toHaveBeenCalledWith({ p: 3 }, 's1');
    expect(finance.getFinancialAuditReport).toHaveBeenCalledWith({ p: 4 });
  });

  describe('diaspora webhook', () => {
    const dto: any = { transferId: 't1', sourcePlatform: 'remitly' };

    it('rejects an invalid signature', async () => {
      const { signature, alerts, finance, ctrl } = make();
      signature.verifyDiasporaSignature.mockReturnValue(false);
      await expect(ctrl.handleDiasporaWebhook(dto, 'sig', 'ts')).resolves.toEqual({
        accepted: false,
        reason: 'Invalid signature',
      });
      expect(alerts.recordAttempt).toHaveBeenCalledWith(false, 'invalid_signature_or_ts');
      expect(finance.processDiasporaRemittance).not.toHaveBeenCalled();
    });

    it('accepts a valid signature', async () => {
      const { signature, alerts, finance, ctrl } = make();
      signature.verifyDiasporaSignature.mockReturnValue(true);
      finance.processDiasporaRemittance.mockResolvedValue({ ok: 1 });
      await expect(ctrl.handleDiasporaWebhook(dto, 'sig', 'ts')).resolves.toEqual({
        accepted: true,
        result: { ok: 1 },
      });
      expect(alerts.recordAttempt).toHaveBeenCalledWith(true);
    });

    it('records processing errors and rethrows', async () => {
      const { signature, alerts, finance, observability, ctrl } = make();
      signature.verifyDiasporaSignature.mockReturnValue(true);
      finance.processDiasporaRemittance.mockRejectedValueOnce(new Error('boom'));
      await expect(ctrl.handleDiasporaWebhook(dto)).rejects.toThrow('boom');
      expect(alerts.recordAttempt).toHaveBeenCalledWith(false, 'processing_error');
      const last = observability.logPaymentStage.mock.calls.at(-1)!;
      expect(last[0]).toBe('IDEMPOTENCY_FAILED');
      expect(last[1]).toMatchObject({ error: 'boom' });

      finance.processDiasporaRemittance.mockRejectedValueOnce('weird');
      await expect(ctrl.handleDiasporaWebhook(dto)).rejects.toBe('weird');
      expect(observability.logPaymentStage.mock.calls.at(-1)![1]).toMatchObject({
        error: 'Unknown webhook error',
      });
    });
  });
});

void jest;
