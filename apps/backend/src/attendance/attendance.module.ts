import { Module } from '@nestjs/common';
import { HybridGatewayModule } from '../hybrid-gateway/hybrid-gateway.module';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendancePublicController } from './attendance.public.controller';

@Module({
  imports: [HybridGatewayModule],
  controllers: [AttendanceController, AttendancePublicController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
