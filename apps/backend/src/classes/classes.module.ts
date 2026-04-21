import { Module } from "@nestjs/common"
import { ClassesService } from "./classes.service"
import { ClassesController } from "./classes.controller"
import { ClassesPublicController } from "./classes.public.controller"

@Module({
  controllers: [ClassesController, ClassesPublicController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
