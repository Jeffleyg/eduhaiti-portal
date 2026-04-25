import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AudioConversionDto } from './dto/audio-conversion.dto';
import { ManifestQueryDto } from './dto/manifest-query.dto';
import { AudioTranscodingService } from './services/audio-transcoding.service';
import { ManifestService } from './services/manifest.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('content-delivery')
export class ContentDeliveryController {
  constructor(
    private readonly manifestService: ManifestService,
    private readonly audioTranscodingService: AudioTranscodingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('manifest')
  @UseGuards(JwtAuthGuard)
  async getManifest(@Query() query: ManifestQueryDto) {
    return this.manifestService.buildDeltaManifest({
      since: query.since,
      classId: query.classId,
    });
  }

  @Get('lesson-audio-summary')
  @UseGuards(JwtAuthGuard)
  async getLessonAudioSummary(
    @Req() req: Request & { user?: { sub?: string; role?: Role } },
    @Query('studentId') studentId?: string,
  ) {
    const targetStudentId =
      req.user?.role === Role.STUDENT ? req.user.sub : studentId ?? req.user?.sub;

    if (!targetStudentId) {
      throw new BadRequestException('studentId is required');
    }

    return this.manifestService.buildLessonAudioSummary(targetStudentId);
  }

  @Post('convert-audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async convertToAudio(
    @Body() dto: AudioConversionDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    const resource = await this.prisma.resource.findUnique({
      where: { id: dto.resourceId },
    });
    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    const allowedVideoTypes = new Set(['mp4', 'mov', 'mkv', 'webm']);
    if (!allowedVideoTypes.has(resource.fileType.toLowerCase())) {
      throw new BadRequestException(
        'Only video resources can be converted to audio',
      );
    }

    const transcoded =
      await this.audioTranscodingService.transcodeVideoToLowBitrateMp3(
        resource.filePath,
        dto.targetBitrate,
      );

    const audioResource = await this.prisma.resource.create({
      data: {
        classId: resource.classId,
        title: `${resource.title} (Audio)`,
        description: resource.description ?? 'Low-bandwidth audio version',
        filePath: transcoded.outputPath,
        fileType: 'mp3',
        uploadedById: req.user.sub,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'RESOURCE',
        entityId: audioResource.id,
        action: 'CREATE_AUDIO_ALTERNATIVE',
        userId: req.user.sub,
        changes: JSON.stringify({
          id: audioResource.id,
          classId: resource.classId,
          sourceResourceId: resource.id,
          filePath: transcoded.outputPath,
          fileType: 'mp3',
          bitrate: transcoded.bitrate,
          sizeBytes: transcoded.sizeBytes,
        }),
      },
    });

    return {
      resource: audioResource,
      audioMeta: {
        bitrate: transcoded.bitrate,
        contentHash: transcoded.contentHash,
        sizeBytes: transcoded.sizeBytes,
      },
    };
  }
}
