import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma, Role } from '@prisma/client';
import { HybridOutboundSmsService } from '../hybrid-gateway/services/hybrid-outbound-sms.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildAuditData } from '../common/audit-compat';
import { Idempotent } from './decorators/idempotent.decorator';
import { AdminLedgerReportQueryDto } from './dto/admin-ledger-report-query.dto';
import { AdminFinanceSummaryQueryDto } from './dto/admin-finance-summary-query.dto';
import { AdminPaymentsQueryDto } from './dto/admin-payments-query.dto';
import { CreateInstallmentPlanDto } from './dto/create-installment-plan.dto';
import { CreateTuitionChargeDto } from './dto/create-tuition-charge.dto';
import { DiasporaRemittanceDto } from './dto/diaspora-remittance.dto';
import { GuardianTuitionPaymentDto } from './dto/guardian-tuition-payment.dto';
import { MobileMoneyPaymentDto } from './dto/mobile-money-payment.dto';
import { MobileMoneyProvider } from './interfaces/mobile-money.interface';
import { PixPaymentDto } from './dto/pix-payment.dto';
import { MonCashProvider } from './providers/moncash.provider';
import { NatCashProvider } from './providers/natcash.provider';
import { DidAuthService } from './services/did-auth.service';
import { ExchangeRateService } from './services/exchange-rate.service';
import { FinanceObservabilityService } from './services/finance-observability.service';
import { IdempotencyService } from './services/idempotency.service';
import { ImmutableLedgerService } from './services/immutable-ledger.service';
import { PixAccountService } from './services/pix-account.service';

@Injectable()
export class FinanceIntegrationService {
  private readonly logger = new Logger(FinanceIntegrationService.name);
  private readonly providers: Record<string, MobileMoneyProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly monCashProvider: MonCashProvider,
    private readonly natCashProvider: NatCashProvider,
    private readonly exchangeRateService: ExchangeRateService,
    readonly idempotencyService: IdempotencyService,
    private readonly observability: FinanceObservabilityService,
    private readonly hybridOutboundSms: HybridOutboundSmsService,
    private readonly didAuth: DidAuthService,
    private readonly ledger: ImmutableLedgerService,
    private readonly pixAccountService: PixAccountService,
  ) {
    this.providers = {
      moncash: this.monCashProvider,
      natcash: this.natCashProvider,
    };
  }

  async processPixPayment(dto: PixPaymentDto, tx?: Prisma.TransactionClient) {
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

    const schoolId = await this.resolveSchoolId(db);

    // Get primary PIX account for the school
    const pixAccount = await db.pixAccount.findFirst({
      where: {
        schoolId,
        isPrimary: true,
        isActive: true,
      },
    });

    if (!pixAccount) {
      throw new NotFoundException(
        'PIX account not configured for this school',
      );
    }

    // Create receipt/invoice for PIX payment
    const receiptNumber = `PIX-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)
      .toUpperCase()}`;

    // Validate and update payment
    let payment: {
      id: string;
      amount: number;
      status: PaymentStatus;
      dueDate: Date;
    } | null = null;

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
        throw new NotFoundException(
          'Tuition charge not found for this student',
        );
      }

      if (existing.status === PaymentStatus.PAID) {
        throw new BadRequestException('Tuition charge is already paid');
      }

      const nextStatus =
        dto.amountHtg >= existing.amount
          ? PaymentStatus.PAID
          : PaymentStatus.PARTIAL;

      payment = await db.payment.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          paidDate: new Date(),
          receiptNumber,
          description: [
            existing.status === PaymentStatus.OVERDUE
              ? 'Overdue tuition payment (PIX)'
              : 'Tuition payment (PIX)',
            `pixKey=${pixAccount.keyType}`,
          ].join('; '),
        },
        select: {
          id: true,
          amount: true,
          status: true,
          dueDate: true,
        },
      });
    }

    // Log the PIX payment
    await this.observability.logPaymentStage(
      'CREDIT_COMPLETED',
      {
        channel: 'pix',
        studentEnrollmentNumber: student.enrollmentNumber,
        amountHtg: dto.amountHtg,
        pixKeyType: pixAccount.keyType,
        receiptNumber,
        paymentId: payment?.id,
      },
      { persistAudit: true },
    );

    return {
      success: true,
      receiptNumber,
      amount: dto.amountHtg,
      pixKey: pixAccount.key,
      pixKeyType: pixAccount.keyType,
      accountHolder: pixAccount.accountHolderName,
      studentName: student.name,
      studentEnrollment: student.enrollmentNumber,
      message: 'PIX payment processed. Transfer the amount to the provided PIX key.',
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
      data: buildAuditData({
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: 'MOBILE_MONEY_CREDIT',
        changes: {
          provider: charge.providerName,
          grossAmountHtg: dto.amountHtg,
          feeAmountHtg: charge.feeAmountHtg,
          netAmountHtg: charge.netAmountHtg,
          providerTransactionId: charge.providerTransactionId,
        },
      }),
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

    let payment: {
      id: string;
      amount: number;
      status: PaymentStatus;
      dueDate: Date;
    } | null = null;

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
        throw new NotFoundException(
          'Tuition charge not found for this student',
        );
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
      data: buildAuditData({
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: 'GUARDIAN_TUITION_PAYMENT',
        changes: {
          provider: charge.providerName,
          grossAmountHtg: dto.amountHtg,
          feeAmountHtg: charge.feeAmountHtg,
          netAmountHtg: charge.netAmountHtg,
          providerTransactionId: charge.providerTransactionId,
          guardianName: dto.guardianName ?? null,
          guardianPhone: dto.guardianPhone ?? null,
          tuitionPaymentId: dto.tuitionPaymentId ?? null,
          resultingStatus: payment.status,
        },
      }),
    });

    const ledgerRecord = await this.ledger.append(
      payment.id,
      'guardian-tuition',
      {
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
      },
    );

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

    await this.notifyGuardianOfflineConfirmation({
      provider: charge.providerName,
      studentId: student.id,
      studentEnrollmentNumber: dto.studentEnrollmentNumber,
      studentName: student.name,
      guardianPhone: dto.guardianPhone,
      paymentId: payment.id,
      paymentStatus: payment.status,
      netAmountHtg: charge.netAmountHtg,
      receiptNumber: charge.providerTransactionId,
    });

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

  private async notifyGuardianOfflineConfirmation(params: {
    provider: string;
    studentId: string;
    studentEnrollmentNumber: string;
    studentName: string | null;
    guardianPhone?: string;
    paymentId: string;
    paymentStatus: PaymentStatus;
    netAmountHtg: number;
    receiptNumber: string;
  }): Promise<void> {
    if (params.provider !== 'moncash') {
      return;
    }

    let phone = params.guardianPhone?.trim() ?? '';

    if (!phone) {
      const links = await this.prisma.$queryRaw<
        Array<{ phoneNumber: string | null; createdAt: Date }>
      >`
        SELECT g."phoneNumber", gs."createdAt"
        FROM "GuardianStudent" gs
        INNER JOIN "Guardian" g ON g."id" = gs."guardianId"
        WHERE gs."studentId" = ${params.studentId}
        ORDER BY gs."createdAt" DESC
        LIMIT 1
      `;

      phone = links[0]?.phoneNumber?.trim() ?? '';
    }

    if (!phone) {
      return;
    }

    const statusLabel =
      params.paymentStatus === PaymentStatus.PAID ? 'PAGO' : 'PARCIAL';
    const text = this.to160Chars(
      `EduHaiti: MonCash confirmou o pagamento de ${params.netAmountHtg.toFixed(2)} HTG para ${params.studentName ?? params.studentEnrollmentNumber}. Status: ${statusLabel}. Recibo: ${params.receiptNumber}.`,
    );

    try {
      await this.hybridOutboundSms.sendSms({
        to: phone,
        text,
        operatorHint: 'digicel',
        context: {
          type: 'MONCASH_PAYMENT_CONFIRMED',
          paymentId: params.paymentId,
          studentId: params.studentId,
          studentEnrollmentNumber: params.studentEnrollmentNumber,
          receiptNumber: params.receiptNumber,
        },
      });
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'guardian_sms_unknown_error';
      this.logger.warn(
        `Failed to send payment confirmation SMS for payment ${params.paymentId}: ${reason}`,
      );
    }
  }

  private to160Chars(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 160) {
      return normalized;
    }

    const limit = 157;
    const shortText = normalized.slice(0, limit);
    const cut = shortText.lastIndexOf(' ');
    const safe = cut > 110 ? shortText.slice(0, cut) : shortText;
    return `${safe.trimEnd()}...`;
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
          in: [
            PaymentStatus.PENDING,
            PaymentStatus.OVERDUE,
            PaymentStatus.PARTIAL,
          ],
        },
        OR: [
          { description: null },
          {
            description: {
              not: {
                contains: '[RENEGOTIATED]',
              },
            },
          },
        ],
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

  async getPrimaryPixAccountForEnrollment(studentEnrollmentNumber: string) {
    const enrollment = studentEnrollmentNumber.trim();
    if (!enrollment) {
      throw new BadRequestException('studentEnrollmentNumber is required');
    }

    const student = await this.prisma.user.findFirst({
      where: { enrollmentNumber: enrollment, role: Role.STUDENT },
      select: {
        id: true,
        schoolId: true,
        classesAttending: { select: { academicYear: { select: { schoolId: true } } }, take: 1 },
      },
    });

    if (!student) {
      throw new NotFoundException('Student enrollment not found');
    }

    const schoolId = student.schoolId ?? student.classesAttending?.[0]?.academicYear?.schoolId;

    if (!schoolId) {
      throw new NotFoundException('School not found for this student');
    }

    return this.pixAccountService.getPrimaryPixAccount(schoolId);
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

    const discount = await this.calculateAutomaticDiscounts({
      studentId: student.id,
      baseAmountHtg: dto.amountHtg,
      scholarshipPercent: dto.scholarshipPercent,
      scholarshipLabel: dto.scholarshipLabel,
      punctualityDiscountPercent: dto.punctualityDiscountPercent,
      applyPunctualityDiscount: dto.applyPunctualityDiscount,
    });

    const schoolId = await this.resolveSchoolId(this.prisma);
    const finalAmount = this.roundCurrency(
      Math.max(0.01, dto.amountHtg - discount.totalDiscountHtg),
    );

    const descriptionParts = [
      dto.description?.trim() || 'Monthly tuition charge',
      `base=${this.roundCurrency(dto.amountHtg)} HTG`,
      `discount=${discount.totalDiscountHtg} HTG`,
      `final=${finalAmount} HTG`,
      ...(discount.scholarshipPercent > 0
        ? [`scholarship=${discount.scholarshipPercent}%`]
        : []),
      ...(discount.punctualityPercent > 0
        ? [`punctuality=${discount.punctualityPercent}%`]
        : []),
      ...(discount.discountTags.length > 0
        ? [`tags=${discount.discountTags.join('|')}`]
        : []),
    ];

    const payment = await this.prisma.payment.create({
      data: {
        schoolId,
        studentId: student.id,
        amount: finalAmount,
        dueDate,
        status: PaymentStatus.PENDING,
        description: descriptionParts.join('; '),
      },
      select: {
        id: true,
        amount: true,
        dueDate: true,
        status: true,
      },
    });

    await this.prisma.auditLog.create({
      data: buildAuditData({
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: 'TUITION_CHARGE_CREATED',
        userId: adminUserId,
        changes: {
          studentEnrollmentNumber: student.enrollmentNumber,
          amountHtg: finalAmount,
          baseAmountHtg: dto.amountHtg,
          discount,
          dueDate,
          description: dto.description ?? null,
        },
      }),
    });

    await this.ledger.append(payment.id, 'tuition-charge', {
      studentEnrollmentNumber: student.enrollmentNumber,
      baseAmountHtg: dto.amountHtg,
      finalAmountHtg: finalAmount,
      dueDate: dueDate.toISOString(),
      discount,
      createdBy: adminUserId,
    });

    return payment;
  }

  async createInstallmentPlan(
    dto: CreateInstallmentPlanDto,
    adminUserId: string,
  ) {
    const enrollment = dto.studentEnrollmentNumber.trim();
    if (!enrollment) {
      throw new BadRequestException('studentEnrollmentNumber is required');
    }

    const firstDueDate = new Date(dto.firstDueDate);
    if (Number.isNaN(firstDueDate.getTime())) {
      throw new BadRequestException('Invalid firstDueDate');
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

    const schoolId = await this.resolveSchoolId(this.prisma);
    const sourcePaymentIds =
      dto.sourcePaymentIds
        ?.map((item) => item.trim())
        .filter((item) => item.length > 0) ?? [];

    const sourcePayments = await this.prisma.payment.findMany({
      where: {
        studentId: student.id,
        schoolId,
        ...(sourcePaymentIds.length > 0 ? { id: { in: sourcePaymentIds } } : {}),
        status: {
          in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE, PaymentStatus.PARTIAL],
        },
        OR: [
          { description: null },
          {
            description: {
              not: {
                contains: '[RENEGOTIATED]',
              },
            },
          },
        ],
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        amount: true,
        dueDate: true,
        description: true,
      },
    });

    if (sourcePayments.length === 0) {
      throw new BadRequestException('No eligible debt records found for renegotiation');
    }

    const originalTotal = this.roundCurrency(
      sourcePayments.reduce((sum, payment) => sum + payment.amount, 0),
    );
    const totalAmount = this.roundCurrency(
      dto.customTotalAmountHtg ?? originalTotal,
    );

    if (totalAmount <= 0) {
      throw new BadRequestException('Installment total must be greater than zero');
    }

    const planId = `PLAN-${new Date().toISOString().slice(0, 10)}-${crypto
      .randomUUID()
      .slice(0, 8)}`;
    const intervalDays = dto.intervalDays ?? 30;
    const amounts = this.splitInstallments(totalAmount, dto.installments);

    const createdInstallments = await this.prisma.$transaction(async (tx) => {
      if (dto.markSourceAsRenegotiated !== false) {
        for (const source of sourcePayments) {
          const updatedDescription = [
            source.description ?? 'Renegotiated tuition debt',
            `[RENEGOTIATED]`,
            `plan=${planId}`,
          ].join('; ');

          await tx.payment.update({
            where: { id: source.id },
            data: {
              status: PaymentStatus.OVERDUE,
              description: updatedDescription,
            },
          });
        }
      }

      const records: Array<{ id: string; amount: number; dueDate: Date }> = [];
      for (let index = 0; index < amounts.length; index += 1) {
        const installmentDueDate = this.buildInstallmentDueDate(
          firstDueDate,
          intervalDays,
          index,
        );

        const created = await tx.payment.create({
          data: {
            schoolId,
            studentId: student.id,
            amount: amounts[index],
            dueDate: installmentDueDate,
            status: PaymentStatus.PENDING,
            description: [
              dto.description?.trim() || 'Installment plan renegotiation',
              `plan=${planId}`,
              `installment=${index + 1}/${amounts.length}`,
            ].join('; '),
          },
          select: {
            id: true,
            amount: true,
            dueDate: true,
          },
        });

        records.push(created);
      }

      await tx.auditLog.create({
        data: buildAuditData({
          entityType: 'PAYMENT',
          entityId: planId,
          action: 'INSTALLMENT_PLAN_CREATED',
          userId: adminUserId,
          changes: {
            planId,
            studentEnrollmentNumber: student.enrollmentNumber,
            sourcePaymentIds: sourcePayments.map((item) => item.id),
            sourceTotalHtg: originalTotal,
            renegotiatedTotalHtg: totalAmount,
            installments: records.map((item, index) => ({
              paymentId: item.id,
              installment: index + 1,
              amountHtg: item.amount,
              dueDate: item.dueDate.toISOString(),
            })),
            intervalDays,
          },
        }),
      });

      return records;
    });

    const ledgerRecord = await this.ledger.append(planId, 'installment-plan', {
      planId,
      studentEnrollmentNumber: student.enrollmentNumber,
      studentName: student.name,
      sourcePaymentIds: sourcePayments.map((item) => item.id),
      sourceTotalHtg: originalTotal,
      renegotiatedTotalHtg: totalAmount,
      installments: createdInstallments.map((item, index) => ({
        paymentId: item.id,
        installment: index + 1,
        amountHtg: item.amount,
        dueDate: item.dueDate.toISOString(),
      })),
      intervalDays,
      createdBy: adminUserId,
    });

    return {
      planId,
      student: {
        id: student.id,
        enrollmentNumber: student.enrollmentNumber,
        name: student.name,
      },
      sourceTotalHtg: originalTotal,
      renegotiatedTotalHtg: totalAmount,
      installments: createdInstallments.map((item, index) => ({
        paymentId: item.id,
        installment: index + 1,
        amountHtg: item.amount,
        dueDate: item.dueDate,
      })),
      ledgerHash: ledgerRecord.hash,
    };
  }

  async getFinancialAuditReport(filters: AdminLedgerReportQueryDto) {
    const report = await this.ledger.buildFinancialTransparencyReport({
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: filters.limit,
    });

    await this.prisma.auditLog.create({
      data: buildAuditData({
        entityType: 'PAYMENT_AUDIT_REPORT',
        entityId: report.lastHash,
        action: 'GENERATE',
        changes: {
          generatedAt: report.generatedAt,
          totalRecords: report.totalRecords,
          integrity: report.integrity,
          filters,
        },
      }),
    });

    await this.ledger.append(
      `audit-report-${Date.now()}`,
      'finance-audit-report',
      {
        generatedAt: report.generatedAt,
        totalRecords: report.totalRecords,
        integrity: report.integrity,
        byCategory: report.byCategory,
        filters,
      },
    );

    return report;
  }

  private buildAdminPaymentsWhere(
    filters: AdminPaymentsQueryDto,
  ): Prisma.PaymentWhereInput {
    const enrollment = filters.studentEnrollmentNumber?.trim();
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;

    if (startDate && Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid startDate');
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid endDate');
    }

    return {
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
  }

  private escapeCsvCell(value: unknown): string {
    const raw = value === null || value === undefined ? '' : String(value);
    const escaped = raw.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  async listPaymentsForAdmin(filters: AdminPaymentsQueryDto) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = this.buildAdminPaymentsWhere(filters);

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

  async exportPaymentsCsvForAdmin(filters: AdminPaymentsQueryDto) {
    const where = this.buildAdminPaymentsWhere(filters);

    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 10000,
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
            name: true,
            enrollmentNumber: true,
          },
        },
      },
    });

    const header = [
      'paymentId',
      'studentName',
      'studentEnrollmentNumber',
      'amountHtg',
      'status',
      'dueDate',
      'paidDate',
      'receiptNumber',
      'description',
      'createdAt',
    ];

    const lines = rows.map((row) => {
      const cells = [
        row.id,
        row.student?.name ?? '',
        row.student?.enrollmentNumber ?? '',
        Number(row.amount).toFixed(2),
        row.status,
        row.dueDate.toISOString(),
        row.paidDate ? row.paidDate.toISOString() : '',
        row.receiptNumber ?? '',
        row.description ?? '',
        row.createdAt.toISOString(),
      ];

      return cells.map((cell) => this.escapeCsvCell(cell)).join(',');
    });

    return [header.join(','), ...lines].join('\n');
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

    const byStatus = grouped.reduce<
      Record<string, { count: number; amountHtg: number }>
    >((acc, item) => {
      acc[item.status] = {
        count: item._count._all,
        amountHtg: Number(item._sum.amount ?? 0),
      };
      return acc;
    }, {});

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
      data: buildAuditData({
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: 'DIASPORA_REMITTANCE_CREDIT',
        changes: {
          sourcePlatform: dto.sourcePlatform,
          transferId: dto.transferId,
          sourceAmount: dto.amount,
          sourceCurrency: dto.currency,
          fx,
          studentEnrollmentNumber: dto.studentEnrollmentNumber,
        },
      }),
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

  private async calculateAutomaticDiscounts(params: {
    studentId: string;
    baseAmountHtg: number;
    scholarshipPercent?: number;
    scholarshipLabel?: string;
    punctualityDiscountPercent?: number;
    applyPunctualityDiscount?: boolean;
  }): Promise<{
    scholarshipPercent: number;
    punctualityPercent: number;
    totalDiscountHtg: number;
    discountTags: string[];
  }> {
    const scholarshipPercent = Math.max(
      0,
      Math.min(params.scholarshipPercent ?? 0, 100),
    );
    const shouldApplyPunctuality = params.applyPunctualityDiscount !== false;
    const punctualityEligible = shouldApplyPunctuality
      ? await this.isPunctualPayer(params.studentId)
      : false;
    const defaultPunctualityPercent = Number(
      process.env.PUNCTUALITY_DISCOUNT_PERCENT ?? '5',
    );
    const punctualityPercent = punctualityEligible
      ? Math.max(
          0,
          Math.min(
            params.punctualityDiscountPercent ?? defaultPunctualityPercent,
            30,
          ),
        )
      : 0;

    const rawTotalPercent = scholarshipPercent + punctualityPercent;
    const cappedPercent = Math.min(rawTotalPercent, 80);
    const totalDiscountHtg = this.roundCurrency(
      (params.baseAmountHtg * cappedPercent) / 100,
    );

    const discountTags = [] as string[];
    if (scholarshipPercent > 0) {
      discountTags.push(
        params.scholarshipLabel?.trim()
          ? `BOLSA:${params.scholarshipLabel.trim()}`
          : 'BOLSA',
      );
    }
    if (punctualityPercent > 0) {
      discountTags.push('PONTUALIDADE');
    }

    return {
      scholarshipPercent,
      punctualityPercent,
      totalDiscountHtg,
      discountTags,
    };
  }

  private async isPunctualPayer(studentId: string): Promise<boolean> {
    const [latestPaid, overdueOpenCount] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          studentId,
          status: PaymentStatus.PAID,
          paidDate: { not: null },
        },
        select: {
          dueDate: true,
          paidDate: true,
        },
        orderBy: { dueDate: 'desc' },
        take: 3,
      }),
      this.prisma.payment.count({
        where: {
          studentId,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.OVERDUE] },
          dueDate: { lt: new Date() },
          OR: [
            { description: null },
            {
              description: {
                not: { contains: '[RENEGOTIATED]' },
              },
            },
          ],
        },
      }),
    ]);

    if (overdueOpenCount > 0 || latestPaid.length < 2) {
      return false;
    }

    return latestPaid.every((item) => {
      if (!item.paidDate) {
        return false;
      }
      return item.paidDate.getTime() <= item.dueDate.getTime();
    });
  }

  private splitInstallments(totalAmount: number, count: number): number[] {
    const cents = Math.round(totalAmount * 100);
    const base = Math.floor(cents / count);
    const remainder = cents - base * count;

    const values = Array.from({ length: count }, (_, index) =>
      (base + (index < remainder ? 1 : 0)) / 100,
    );

    return values.map((value) => this.roundCurrency(value));
  }

  private buildInstallmentDueDate(
    firstDueDate: Date,
    intervalDays: number,
    index: number,
  ): Date {
    const dueDate = new Date(firstDueDate);
    dueDate.setDate(dueDate.getDate() + intervalDays * index);
    return dueDate;
  }

  private roundCurrency(value: number): number {
    return Number(value.toFixed(2));
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
