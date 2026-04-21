import { Module } from '@nestjs/common';
import { FinanceIntegrationModule } from '../finance-integration/finance-integration.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [PrismaModule, FinanceIntegrationModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
