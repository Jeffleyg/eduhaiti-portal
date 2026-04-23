import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { DisciplinesController } from "./disciplines.controller"
import { DisciplinesPublicController } from "./disciplines.public.controller"
import { DisciplinesService } from "./disciplines.service"

@Module({
  imports: [PrismaModule],
  controllers: [DisciplinesController, DisciplinesPublicController],
  providers: [DisciplinesService],
})
export class DisciplinesModule {}
