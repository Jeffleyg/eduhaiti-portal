import { Module } from "@nestjs/common"
import { UsersService } from "./users.service"
import { UsersController } from "./users.controller"
import { EmailService } from "../common/services/email.service"

@Module({
  providers: [UsersService, EmailService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
