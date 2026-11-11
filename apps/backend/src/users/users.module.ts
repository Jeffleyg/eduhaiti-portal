import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EmailService } from '../common/services/email.service';
import { GuardiansService } from './guardians.service';

@Module({
  providers: [UsersService, EmailService, GuardiansService],
  controllers: [UsersController],
  exports: [UsersService, GuardiansService],
})
export class UsersModule {}
