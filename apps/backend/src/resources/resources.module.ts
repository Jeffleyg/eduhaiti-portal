import { Module } from "@nestjs/common"
import { ResourcesService } from "./resources.service"
import { ResourcesController } from "./resources.controller"
import { PrismaModule } from "../prisma/prisma.module"
import { ContentDeliveryModule } from "../content-delivery/content-delivery.module"

@Module({
  imports: [PrismaModule, ContentDeliveryModule],
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
