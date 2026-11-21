import { Module } from '@nestjs/common';
import { HybridGatewayModule } from '../hybrid-gateway/hybrid-gateway.module';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendancePublicController } from './attendance.public.controller';
import { AttendanceReportController } from './attendance-report.controller';
import { AttendanceReportService } from './attendance-report.service';

@Module({
  imports: [HybridGatewayModule],
  // The report controller comes first so "attendance/report" is never read as a parameter.
  controllers: [
    AttendanceReportController,
    AttendanceController,
    AttendancePublicController,
  ],
  providers: [AttendanceService, AttendanceReportService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
