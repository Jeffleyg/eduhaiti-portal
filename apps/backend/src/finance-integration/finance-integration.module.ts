import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { FinanceIntegrationController } from "./finance-integration.controller"
import { FinanceIntegrationService } from "./finance-integration.service"
import { MonCashProvider } from "./providers/moncash.provider"
import { NatCashProvider } from "./providers/natcash.provider"
import { DidAuthService } from "./services/did-auth.service"
import { FinanceObservabilityService } from "./services/finance-observability.service"
import { ExchangeRateService } from "./services/exchange-rate.service"
import { IdempotencyService } from "./services/idempotency.service"
import { ImmutableLedgerService } from "./services/immutable-ledger.service"
import { WebhookAlertService } from "./services/webhook-alert.service"
import { WebhookSignatureService } from "./services/webhook-signature.service"

@Module({
  imports: [PrismaModule],
  controllers: [FinanceIntegrationController],
  providers: [
    FinanceIntegrationService,
    MonCashProvider,
    NatCashProvider,
    ExchangeRateService,
    IdempotencyService,
    FinanceObservabilityService,
    WebhookAlertService,
    DidAuthService,
    ImmutableLedgerService,
    WebhookSignatureService,
  ],
  exports: [WebhookAlertService],
})
export class FinanceIntegrationModule {}
