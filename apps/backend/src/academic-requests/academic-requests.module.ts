import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { AcademicRequestsController } from "./academic-requests.controller"
import { AcademicRequestsService } from "./academic-requests.service"

@Module({
  imports: [PrismaModule],
  controllers: [AcademicRequestsController],
  providers: [AcademicRequestsService],
})
export class AcademicRequestsModule {}
