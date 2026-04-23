import { Module } from "@nestjs/common"
import { PrismaModule } from "../prisma/prisma.module"
import { ForumsController } from "./forums.controller"
import { ForumsService } from "./forums.service"

@Module({
  imports: [PrismaModule],
  controllers: [ForumsController],
  providers: [ForumsService],
})
export class ForumsModule {}
