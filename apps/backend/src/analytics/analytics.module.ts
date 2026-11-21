import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { EarlyWarningService } from './early-warning.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController, AdminDashboardController],
  providers: [AnalyticsService, AdminDashboardService, EarlyWarningService],
})
export class AnalyticsModule {}
