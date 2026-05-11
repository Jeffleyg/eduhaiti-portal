import { Module } from '@nestjs/common'
import { OwnerController } from './owner.controller'
import { OwnerAuthController } from './owner-auth.controller'
import { OwnerService } from './owner.service'
import { PrismaService } from '../prisma/prisma.service'
import { EmailService } from '../common/services/email.service'

@Module({
  controllers: [OwnerController, OwnerAuthController],
  providers: [OwnerService, PrismaService, EmailService],
  exports: [OwnerService],
})
export class OwnerModule {}
