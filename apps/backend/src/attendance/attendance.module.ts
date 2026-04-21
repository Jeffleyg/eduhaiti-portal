import { Module } from "@nestjs/common"
import { AttendanceService } from "./attendance.service"
import { AttendanceController } from "./attendance.controller"
import { AttendancePublicController } from "./attendance.public.controller"

@Module({
  controllers: [AttendanceController, AttendancePublicController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
