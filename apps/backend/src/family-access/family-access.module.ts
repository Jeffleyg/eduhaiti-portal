import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { HybridGatewayModule } from '../hybrid-gateway/hybrid-gateway.module';
import { FamilyAccessController } from './family-access.controller';
import { FamilyAccessService } from './family-access.service';
import { FamilyAuthService } from './family-auth.service';
import { FamilySessionGuard } from './family-session.guard';

@Module({
  imports: [
    PrismaModule,
    HybridGatewayModule,
    // Own key (derived from JWT_SECRET): a family token must never pass the staff/student guard.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: `${config.getOrThrow<string>('JWT_SECRET')}::family-portal`,
      }),
    }),
  ],
  controllers: [FamilyAccessController],
  providers: [FamilyAccessService, FamilyAuthService, FamilySessionGuard],
})
export class FamilyAccessModule {}
