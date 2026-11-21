import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { exportFileName } from './finance-export';
import { normalizeExportLanguage } from '../common/csv';

type AdminRequest = { user?: { sub?: string; schoolId?: string | null } };

/** Every admin finance route works on the admin's own school only. */
export function adminSchool(req: AdminRequest): string {
  if (!req.user?.schoolId) {
    throw new ForbiddenException('Admin is not linked to a school');
  }
  return req.user.schoolId;
}
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminLedgerReportQueryDto } from './dto/admin-ledger-report-query.dto';
import { AdminFinanceSummaryQueryDto } from './dto/admin-finance-summary-query.dto';
import { AdminPaymentsQueryDto } from './dto/admin-payments-query.dto';
import { CreateInstallmentPlanDto } from './dto/create-installment-plan.dto';
import { CreateTuitionChargeDto } from './dto/create-tuition-charge.dto';
import { DiasporaRemittanceDto } from './dto/diaspora-remittance.dto';
import { DidTrustTokenDto } from './dto/did-trust-token.dto';
import { GuardianTuitionPaymentDto } from './dto/guardian-tuition-payment.dto';
import { MobileMoneyPaymentDto } from './dto/mobile-money-payment.dto';
import { FinanceIntegrationService } from './finance-integration.service';
import { FinanceObservabilityService } from './services/finance-observability.service';
import { WebhookAlertService } from './services/webhook-alert.service';
import { WebhookSignatureService } from './services/webhook-signature.service';

@Controller('finance')
export class FinanceIntegrationController {
  constructor(
    private readonly financeService: FinanceIntegrationService,
    private readonly webhookSignatureService: WebhookSignatureService,
    private readonly observability: FinanceObservabilityService,
    private readonly webhookAlertService: WebhookAlertService,
  ) {}

  @Post('mobile-money/pay')
  async payViaMobileMoney(@Body() dto: MobileMoneyPaymentDto) {
    await this.observability.logPaymentStage(
      'REQUEST_RECEIVED',
      {
        channel: 'mobile-money',
        provider: dto.provider,
        idempotencyKey: dto.idempotencyKey,
        studentEnrollmentNumber: dto.studentEnrollmentNumber,
      },
      { persistAudit: true },
    );

    return this.financeService.processMobileMoneyPayment(dto);
  }

  @Get('tuition/:studentEnrollmentNumber/pending')
  getPendingTuition(
    @Param('studentEnrollmentNumber') studentEnrollmentNumber: string,
  ) {
    return this.financeService.listPendingTuitionByEnrollment(
      studentEnrollmentNumber,
    );
  }

  @Post('tuition/pay')
  async payTuitionAsGuardian(@Body() dto: GuardianTuitionPaymentDto) {
    await this.observability.logPaymentStage(
      'REQUEST_RECEIVED',
      {
        channel: 'guardian-tuition',
        provider: dto.provider,
        idempotencyKey: dto.idempotencyKey,
        studentEnrollmentNumber: dto.studentEnrollmentNumber,
      },
      { persistAudit: true },
    );

    return this.financeService.processGuardianTuitionPayment(dto);
  }

  @Post('diaspora/webhook')
  @HttpCode(202)
  async handleDiasporaWebhook(
    @Body() dto: DiasporaRemittanceDto,
    @Headers('x-diaspora-signature') signature?: string,
    @Headers('x-diaspora-timestamp') timestamp?: string,
  ) {
    await this.observability.logPaymentStage(
      'REQUEST_RECEIVED',
      {
        channel: 'diaspora-webhook',
        transferId: dto.transferId,
        sourcePlatform: dto.sourcePlatform,
      },
      { persistAudit: true },
    );

    const validSignature = this.webhookSignatureService.verifyDiasporaSignature(
      dto,
      signature,
      timestamp,
    );

    if (!validSignature) {
      this.webhookAlertService.recordAttempt(false, 'invalid_signature_or_ts');
      await this.observability.logPaymentStage(
        'SIGNATURE_REJECTED',
        {
          channel: 'diaspora-webhook',
          transferId: dto.transferId,
        },
        { level: 'warn', persistAudit: true },
      );

      return {
        accepted: false,
        reason: 'Invalid signature',
      };
    }

    await this.observability.logPaymentStage(
      'SIGNATURE_VALIDATED',
      {
        channel: 'diaspora-webhook',
        transferId: dto.transferId,
      },
      { persistAudit: true },
    );

    try {
      const result = await this.financeService.processDiasporaRemittance(dto);
      this.webhookAlertService.recordAttempt(true);

      return { accepted: true, result };
    } catch (error) {
      this.webhookAlertService.recordAttempt(false, 'processing_error');
      await this.observability.logPaymentStage(
        'IDEMPOTENCY_FAILED',
        {
          channel: 'diaspora-webhook',
          transferId: dto.transferId,
          error:
            error instanceof Error ? error.message : 'Unknown webhook error',
        },
        { level: 'error', persistAudit: true },
      );

      throw error;
    }
  }

  @Post('did/trust-token')
  async issueDidToken(@Body() dto: DidTrustTokenDto) {
    return this.financeService.issueDidTrustToken(
      dto.deviceId,
      dto.studentEnrollmentNumber,
    );
  }

  @Post('did/verify-offline')
  verifyDidToken(@Body() payload: { trustToken: string }) {
    return this.financeService.verifyDidTrustTokenOffline(payload.trustToken);
  }

  @Post('admin/tuition-charges')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createTuitionCharge(
    @Body() dto: CreateTuitionChargeDto,
    @Req() req: AdminRequest,
  ) {
    const schoolId = adminSchool(req);
    return this.financeService.createTuitionCharge(
      dto,
      req.user?.sub ?? '',
      schoolId,
    );
  }

  @Post('admin/installment-plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createInstallmentPlan(
    @Body() dto: CreateInstallmentPlanDto,
    @Req() req: AdminRequest,
  ) {
    const schoolId = adminSchool(req);
    return this.financeService.createInstallmentPlan(
      dto,
      req.user?.sub ?? '',
      schoolId,
    );
  }

  @Get('admin/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listPayments(
    @Query() filters: AdminPaymentsQueryDto,
    @Req() req: AdminRequest,
  ) {
    return this.financeService.listPaymentsForAdmin(filters, adminSchool(req));
  }

  /** Spreadsheet export; `lang` (fr|ht|pt|en) picks headers and number format. */
  @Get('admin/payments/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async exportPaymentsCsv(
    @Query() filters: AdminPaymentsQueryDto,
    @Query('lang') lang: string | undefined,
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const language = normalizeExportLanguage(lang);
    const csv = await this.financeService.exportPaymentsCsvForAdmin(
      filters,
      adminSchool(req),
      language,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportFileName(language)}"`,
    );
    return csv;
  }

  /** Data for the printable PDF report (same filters as the export). */
  @Get('admin/payments/report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getPaymentsReport(
    @Query() filters: AdminPaymentsQueryDto,
    @Req() req: AdminRequest,
  ) {
    return this.financeService.getPaymentsReport(filters, adminSchool(req));
  }

  @Get('admin/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getSummary(
    @Query() filters: AdminFinanceSummaryQueryDto,
    @Req() req: AdminRequest,
  ) {
    return this.financeService.getAdminFinanceSummary(
      filters,
      adminSchool(req),
    );
  }

  @Get('admin/audit-report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAuditReport(
    @Query() filters: AdminLedgerReportQueryDto,
    @Req() req: AdminRequest,
  ) {
    return this.financeService.getFinancialAuditReport(
      filters,
      adminSchool(req),
    );
  }
}
