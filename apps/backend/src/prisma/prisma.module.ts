import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ClassAccessService } from './class-access.service';

@Global()
@Module({
  providers: [PrismaService, ClassAccessService],
  exports: [PrismaService, ClassAccessService],
})
export class PrismaModule {}
