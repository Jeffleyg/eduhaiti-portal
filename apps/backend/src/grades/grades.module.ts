import { Module } from "@nestjs/common"
import { GradesService } from "./grades.service"
import { GradesController } from "./grades.controller"
import { GradesPublicController } from "./grades.public.controller"

@Module({
  controllers: [GradesController, GradesPublicController],
  providers: [GradesService],
  exports: [GradesService],
})
export class GradesModule {}
