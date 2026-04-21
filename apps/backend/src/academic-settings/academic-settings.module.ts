import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { AcademicSettingsController } from "./academic-settings.controller"
import { AcademicSettingsService } from "./academic-settings.service"

@Module({
  imports: [PrismaModule],
  controllers: [AcademicSettingsController],
  providers: [AcademicSettingsService],
})
export class AcademicSettingsModule {}
