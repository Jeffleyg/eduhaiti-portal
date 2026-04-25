import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { DigicelAdapter } from "./adapters/digicel.adapter"
import { NatcomAdapter } from "./adapters/natcom.adapter"
import { HybridGatewayController } from "./hybrid-gateway.controller"
import { HybridGatewayService } from "./hybrid-gateway.service"
import { CommandParserService } from "./services/command-parser.service"
import { HybridAuditService } from "./services/hybrid-audit.service"
import { HybridOtpService } from "./services/hybrid-otp.service"
import { OperatorAdapterRegistryService } from "./services/operator-adapter-registry.service"
import { SqlServerReadService } from "./services/sql-server-read.service"
import { UssdMenuService } from "./services/ussd-menu.service"

@Module({
  imports: [PrismaModule],
  controllers: [HybridGatewayController],
  providers: [
    HybridGatewayService,
    CommandParserService,
    SqlServerReadService,
    UssdMenuService,
    HybridAuditService,
    HybridOtpService,
    OperatorAdapterRegistryService,
    DigicelAdapter,
    NatcomAdapter,
  ],
})
export class HybridGatewayModule {}
