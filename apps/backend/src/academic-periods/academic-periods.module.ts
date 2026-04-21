import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { AcademicPeriodsController } from "./academic-periods.controller"
import { AcademicPeriodsService } from "./academic-periods.service"

@Module({
  imports: [PrismaModule],
  controllers: [AcademicPeriodsController],
  providers: [AcademicPeriodsService],
})
export class AcademicPeriodsModule {}
