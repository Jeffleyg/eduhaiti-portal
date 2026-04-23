import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { FamilyAccessController } from "./family-access.controller"
import { FamilyAccessService } from "./family-access.service"

@Module({
  imports: [PrismaModule],
  controllers: [FamilyAccessController],
  providers: [FamilyAccessService],
})
export class FamilyAccessModule {}
