import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { DisciplinesController } from "./disciplines.controller"
import { DisciplinesService } from "./disciplines.service"

@Module({
  imports: [PrismaModule],
  controllers: [DisciplinesController],
  providers: [DisciplinesService],
})
export class DisciplinesModule {}
