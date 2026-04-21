import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Idempotent } from './decorators/idempotent.decorator';
import { DiasporaRemittanceDto } from './dto/diaspora-remittance.dto';
import { MobileMoneyPaymentDto } from './dto/mobile-money-payment.dto';
import { MobileMoneyProvider } from './interfaces/mobile-money.interface';
import { MonCashProvider } from './providers/moncash.provider';
import { NatCashProvider } from './providers/natcash.provider';
import { DidAuthService } from './services/did-auth.service';
import { ExchangeRateService } from './services/exchange-rate.service';
import { FinanceObservabilityService } from './services/finance-observability.service';
import { IdempotencyService } from './services/idempotency.service';
import { ImmutableLedgerService } from './services/immutable-ledger.service';

@Injectable()
export class FinanceIntegrationService {
  private readonly providers: Record<string, MobileMoneyProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly monCashProvider: MonCashProvider,
    private readonly natCashProvider: NatCashProvider,
    private readonly exchangeRateService: ExchangeRateService,
    readonly idempotencyService: IdempotencyService,
    private readonly observability: FinanceObservabilityService,
    private readonly didAuth: DidAuthService,
    private readonly ledger: ImmutableLedgerService,
  ) {
    this.providers = {
      moncash: this.monCashProvider,
      natcash: this.natCashProvider,
    };
  }

  @Idempotent({
    operation: 'MOBILE_MONEY_CREDIT',
    keyFromArgs: (...args: unknown[]) => {
      const dto = args[0] as MobileMoneyPaymentDto;
      return `mobile-money:${dto.provider}:${dto.idempotencyKey}`;
    },
  })
  async processMobileMoneyPayment(
    dto: MobileMoneyPaymentDto,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;

    const student = await db.user.findFirst({
      where: { enrollmentNumber: dto.studentEnrollmentNumber },
      select: { id: true, enrollmentNumber: true, email: true },
    });

    if (!student) {
      throw new NotFoundException('Student enrollment not found');
    }

    const provider = this.providers[dto.provider];
    if (!provider) {
      throw new NotFoundException('Provider not supported');
    }

    const schoolId = await this.resolveSchoolId(db);
    const externalReference = crypto.randomUUID();

    const charge = await provider.processCharge({
      externalReference,
      accountNumber: dto.accountNumber,
      amountHtg: dto.amountHtg,
      narration: `School credit for ${dto.studentEnrollmentNumber}`,
    });

    if (!charge.approved) {
      throw new BadGatewayException(
        `${charge.providerName} charge was not approved`,
      );
    }

    const payment = await db.payment.create({
      data: {
        schoolId,
        studentId: student.id,
        amount: charge.netAmountHtg,
        dueDate: new Date(),
        paidDate: new Date(),
        status: PaymentStatus.PAID,
        description: `Mobile money ${charge.providerName}; fee=${charge.feeAmountHtg} HTG`,
        receiptNumber: charge.providerTransactionId,
      },
    });

    await db.auditLog.create({
      data: {
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: 'MOBILE_MONEY_CREDIT',
        changes: JSON.stringify({
          provider: charge.providerName,
          grossAmountHtg: dto.amountHtg,
          feeAmountHtg: charge.feeAmountHtg,
          netAmountHtg: charge.netAmountHtg,
          providerTransactionId: charge.providerTransactionId,
        }),
      },
    });

    const ledgerRecord = await this.ledger.append(payment.id, 'mobile-money', {
      provider: charge.providerName,
      studentEnrollmentNumber: dto.studentEnrollmentNumber,
      grossAmountHtg: dto.amountHtg,
      feeAmountHtg: charge.feeAmountHtg,
      netAmountHtg: charge.netAmountHtg,
      receiptNumber: charge.providerTransactionId,
    });

    await this.observability.logPaymentStage(
      'CREDIT_COMPLETED',
      {
        channel: 'mobile-money',
        paymentId: payment.id,
        provider: charge.providerName,
        idempotencyKey: dto.idempotencyKey,
      },
      { tx, persistAudit: true },
    );

    return {
      paymentId: payment.id,
      provider: charge.providerName,
      netAmountHtg: charge.netAmountHtg,
      feeAmountHtg: charge.feeAmountHtg,
      receiptNumber: charge.providerTransactionId,
      ledgerHash: ledgerRecord.hash,
    };
  }

  @Idempotent({
    operation: 'DIASPORA_REMITTANCE_CREDIT',
    keyFromArgs: (...args: unknown[]) => {
      const dto = args[0] as DiasporaRemittanceDto;
      return `diaspora:${dto.transferId}`;
    },
  })
  async processDiasporaRemittance(
    dto: DiasporaRemittanceDto,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;

    const student = await db.user.findFirst({
      where: { enrollmentNumber: dto.studentEnrollmentNumber },
      select: { id: true, enrollmentNumber: true },
    });

    if (!student) {
      throw new NotFoundException('Student enrollment not found');
    }

    const schoolId = await this.resolveSchoolId(db);
    const fx = await this.exchangeRateService.convertToHtg(
      dto.amount,
      dto.currency,
    );

    const payment = await db.payment.create({
      data: {
        schoolId,
        studentId: student.id,
        amount: fx.netHtg,
        dueDate: new Date(),
        paidDate: new Date(),
        status: PaymentStatus.PAID,
        description: `Diaspora ${dto.sourcePlatform}; rate=${fx.fxRateToHtg}; spread=${fx.spreadAmountHtg}; fee=${fx.platformFeeAmountHtg}`,
        receiptNumber: dto.transferId,
      },
    });

    await db.auditLog.create({
      data: {
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: 'DIASPORA_REMITTANCE_CREDIT',
        changes: JSON.stringify({
          sourcePlatform: dto.sourcePlatform,
          transferId: dto.transferId,
          sourceAmount: dto.amount,
          sourceCurrency: dto.currency,
          fx,
          studentEnrollmentNumber: dto.studentEnrollmentNumber,
        }),
      },
    });

    const ledgerRecord = await this.ledger.append(
      payment.id,
      'diaspora-remittance',
      {
        sourcePlatform: dto.sourcePlatform,
        transferId: dto.transferId,
        sourceAmount: dto.amount,
        sourceCurrency: dto.currency,
        fx,
        studentEnrollmentNumber: dto.studentEnrollmentNumber,
      },
    );

    await this.observability.logPaymentStage(
      'CREDIT_COMPLETED',
      {
        channel: 'diaspora-webhook',
        paymentId: payment.id,
        transferId: dto.transferId,
      },
      { tx, persistAudit: true },
    );

    return {
      paymentId: payment.id,
      transferId: dto.transferId,
      creditedAmountHtg: fx.netHtg,
      transparency: {
        sourceAmount: dto.amount,
        sourceCurrency: dto.currency,
        fxRateToHtg: fx.fxRateToHtg,
        spreadAmountHtg: fx.spreadAmountHtg,
        platformFeeAmountHtg: fx.platformFeeAmountHtg,
      },
      ledgerHash: ledgerRecord.hash,
    };
  }

  async issueDidTrustToken(deviceId: string, studentEnrollmentNumber: string) {
    const token = await this.didAuth.issueTrustToken(
      deviceId,
      studentEnrollmentNumber,
    );

    const ledgerRecord = await this.ledger.append(
      `did-${deviceId}-${studentEnrollmentNumber}`,
      'did-key',
      {
        deviceId,
        studentEnrollmentNumber,
        expiresAt: token.expiresAt,
      },
    );

    return {
      ...token,
      ledgerHash: ledgerRecord.hash,
    };
  }

  verifyDidTrustTokenOffline(token: string) {
    return this.didAuth.verifyTrustTokenOffline(token);
  }

  private async resolveSchoolId(
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<string> {
    const school = await db.school.findFirst({ select: { id: true } });
    if (!school) {
      throw new NotFoundException('School record not found');
    }

    return school.id;
  }
}
