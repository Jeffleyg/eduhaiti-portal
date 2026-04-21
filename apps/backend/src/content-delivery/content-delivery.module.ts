import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ContentDeliveryController } from './content-delivery.controller';
import { AssetOptimizationService } from './services/asset-optimization.service';
import { AudioTranscodingService } from './services/audio-transcoding.service';
import { ManifestService } from './services/manifest.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ContentDeliveryController],
  providers: [
    AssetOptimizationService,
    AudioTranscodingService,
    ManifestService,
  ],
  exports: [AssetOptimizationService, AudioTranscodingService, ManifestService],
})
export class ContentDeliveryModule {}
