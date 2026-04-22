import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Idempotent } from './decorators/idempotent.decorator';
import { AdminFinanceSummaryQueryDto } from './dto/admin-finance-summary-query.dto';
import { AdminPaymentsQueryDto } from './dto/admin-payments-query.dto';
import { CreateTuitionChargeDto } from './dto/create-tuition-charge.dto';
import { DiasporaRemittanceDto } from './dto/diaspora-remittance.dto';
import { GuardianTuitionPaymentDto } from './dto/guardian-tuition-payment.dto';
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
    operation: 'GUARDIAN_TUITION_PAYMENT',
    keyFromArgs: (...args: unknown[]) => {
      const dto = args[0] as GuardianTuitionPaymentDto;
      return `guardian-tuition:${dto.provider}:${dto.idempotencyKey}`;
    },
  })
  async processGuardianTuitionPayment(
    dto: GuardianTuitionPaymentDto,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;

    const student = await db.user.findFirst({
      where: {
        enrollmentNumber: dto.studentEnrollmentNumber,
        role: Role.STUDENT,
      },
      select: { id: true, enrollmentNumber: true, name: true },
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
      narration: `Tuition payment for ${dto.studentEnrollmentNumber}`,
    });

    if (!charge.approved) {
      throw new BadGatewayException(
        `${charge.providerName} charge was not approved`,
      );
    }

    const paidAt = new Date();

    let payment:
      | {
          id: string;
          amount: number;
          status: PaymentStatus;
          dueDate: Date;
        }
      | null = null;

    if (dto.tuitionPaymentId) {
      const existing = await db.payment.findFirst({
        where: {
          id: dto.tuitionPaymentId,
          studentId: student.id,
          schoolId,
        },
        select: {
          id: true,
          amount: true,
          status: true,
          dueDate: true,
        },
      });

      if (!existing) {
        throw new NotFoundException('Tuition charge not found for this student');
      }

      if (existing.status === PaymentStatus.PAID) {
        throw new BadRequestException('Tuition charge is already paid');
      }

      const nextStatus =
        charge.netAmountHtg >= existing.amount
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIAL;

      payment = await db.payment.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          paidDate: paidAt,
          receiptNumber: charge.providerTransactionId,
          description: [
            existing.status === PaymentStatus.OVERDUE
              ? 'Overdue tuition payment'
              : 'Tuition payment',
            `provider=${charge.providerName}`,
            `fee=${charge.feeAmountHtg} HTG`,
          ].join('; '),
        },
        select: {
          id: true,
          amount: true,
          status: true,
          dueDate: true,
        },
      });
    } else {
      payment = await db.payment.create({
        data: {
          schoolId,
          studentId: student.id,
          amount: charge.netAmountHtg,
          dueDate: paidAt,
          paidDate: paidAt,
          status: PaymentStatus.PAID,
          description: `Guardian payment ${charge.providerName}; fee=${charge.feeAmountHtg} HTG`,
          receiptNumber: charge.providerTransactionId,
        },
        select: {
          id: true,
          amount: true,
          status: true,
          dueDate: true,
        },
      });
    }

    await db.auditLog.create({
      data: {
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: 'GUARDIAN_TUITION_PAYMENT',
        changes: JSON.stringify({
          provider: charge.providerName,
          grossAmountHtg: dto.amountHtg,
          feeAmountHtg: charge.feeAmountHtg,
          netAmountHtg: charge.netAmountHtg,
          providerTransactionId: charge.providerTransactionId,
          guardianName: dto.guardianName ?? null,
          guardianPhone: dto.guardianPhone ?? null,
          tuitionPaymentId: dto.tuitionPaymentId ?? null,
          resultingStatus: payment.status,
        }),
      },
    });

    const ledgerRecord = await this.ledger.append(payment.id, 'guardian-tuition', {
      provider: charge.providerName,
      studentEnrollmentNumber: dto.studentEnrollmentNumber,
      studentName: student.name,
      grossAmountHtg: dto.amountHtg,
      feeAmountHtg: charge.feeAmountHtg,
      netAmountHtg: charge.netAmountHtg,
      receiptNumber: charge.providerTransactionId,
      tuitionPaymentId: dto.tuitionPaymentId ?? null,
      guardianName: dto.guardianName ?? null,
      guardianPhone: dto.guardianPhone ?? null,
      resultingStatus: payment.status,
    });

    await this.observability.logPaymentStage(
      'CREDIT_COMPLETED',
      {
        channel: 'guardian-tuition',
        paymentId: payment.id,
        provider: charge.providerName,
        idempotencyKey: dto.idempotencyKey,
      },
      { tx, persistAudit: true },
    );

    return {
      paymentId: payment.id,
      provider: charge.providerName,
      paymentStatus: payment.status,
      grossAmountHtg: dto.amountHtg,
      netAmountHtg: charge.netAmountHtg,
      feeAmountHtg: charge.feeAmountHtg,
      receiptNumber: charge.providerTransactionId,
      ledgerHash: ledgerRecord.hash,
    };
  }

  async listPendingTuitionByEnrollment(studentEnrollmentNumber: string) {
    const enrollment = studentEnrollmentNumber.trim();
    if (!enrollment) {
      throw new BadRequestException('studentEnrollmentNumber is required');
    }

    const student = await this.prisma.user.findFirst({
      where: {
        enrollmentNumber: enrollment,
        role: Role.STUDENT,
      },
      select: {
        id: true,
        enrollmentNumber: true,
        name: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student enrollment not found');
    }

    const pending = await this.prisma.payment.findMany({
      where: {
        studentId: student.id,
        status: {
          in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE, PaymentStatus.PARTIAL],
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        amount: true,
        status: true,
        dueDate: true,
        description: true,
      },
    });

    return {
      student: {
        enrollmentNumber: student.enrollmentNumber,
        name: student.name,
      },
      charges: pending,
      totalPendingHtg: pending.reduce((sum, item) => sum + item.amount, 0),
    };
  }

  async createTuitionCharge(dto: CreateTuitionChargeDto, adminUserId: string) {
    const student = await this.prisma.user.findFirst({
      where: {
        enrollmentNumber: dto.studentEnrollmentNumber,
        role: Role.STUDENT,
      },
      select: {
        id: true,
        enrollmentNumber: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student enrollment not found');
    }

    const dueDate = new Date(dto.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException('Invalid dueDate');
    }

    const schoolId = await this.resolveSchoolId(this.prisma);
    const payment = await this.prisma.payment.create({
      data: {
        schoolId,
        studentId: student.id,
        amount: dto.amountHtg,
        dueDate,
        status: PaymentStatus.PENDING,
        description: dto.description?.trim() || 'Monthly tuition charge',
      },
      select: {
        id: true,
        amount: true,
        dueDate: true,
        status: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: 'TUITION_CHARGE_CREATED',
        userId: adminUserId,
        changes: JSON.stringify({
          studentEnrollmentNumber: student.enrollmentNumber,
          amountHtg: dto.amountHtg,
          dueDate,
          description: dto.description ?? null,
        }),
      },
    });

    return payment;
  }

  async listPaymentsForAdmin(filters: AdminPaymentsQueryDto) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const enrollment = filters.studentEnrollmentNumber?.trim();

    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;

    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid startDate');
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid endDate');
    }

    const where: Prisma.PaymentWhereInput = {
      status: filters.status,
      ...(startDate || endDate
        ? {
            dueDate: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
      ...(enrollment
        ? {
            student: {
              enrollmentNumber: enrollment,
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          amount: true,
          status: true,
          dueDate: true,
          paidDate: true,
          description: true,
          receiptNumber: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              name: true,
              enrollmentNumber: true,
            },
          },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      rows,
    };
  }

  async getAdminFinanceSummary(filters: AdminFinanceSummaryQueryDto) {
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;

    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid startDate');
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid endDate');
    }

    const where: Prisma.PaymentWhereInput = {
      ...(startDate || endDate
        ? {
            dueDate: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };

    const [totals, grouped] = await Promise.all([
      this.prisma.payment.aggregate({
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    const byStatus = grouped.reduce<Record<string, { count: number; amountHtg: number }>>(
      (acc, item) => {
        acc[item.status] = {
          count: item._count._all,
          amountHtg: Number(item._sum.amount ?? 0),
        };
        return acc;
      },
      {},
    );

    return {
      totalPayments: totals._count._all,
      totalAmountHtg: Number(totals._sum.amount ?? 0),
      byStatus,
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
