import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
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
import { ClassAccessService, ClassRequester } from '../prisma/class-access.service';
import { buildAuditData } from '../common/audit-compat';

@Controller('content-delivery')
export class ContentDeliveryController {
  constructor(
    private readonly manifestService: ManifestService,
    private readonly audioTranscodingService: AudioTranscodingService,
    private readonly prisma: PrismaService,
    private readonly classAccess: ClassAccessService,
  ) {}

  @Get('manifest')
  @UseGuards(JwtAuthGuard)
  async getManifest(
    @Req() req: Request & { user?: ClassRequester },
    @Query() query: ManifestQueryDto,
  ) {
    return this.manifestService.buildDeltaManifest({
      since: query.since,
      classIds: await this.visibleClassIds(req.user, query.classId),
    });
  }

  @Get('lesson-audio-summary')
  @UseGuards(JwtAuthGuard)
  async getLessonAudioSummary(
    @Req() req: Request & { user?: ClassRequester },
    @Query('studentId') studentId?: string,
  ) {
    const user = req.user;
    if (user?.role === Role.STUDENT) {
      return this.manifestService.buildLessonAudioSummary(user.sub ?? '');
    }

    if (!studentId) {
      throw new BadRequestException('studentId is required');
    }
    await this.assertCanSeeStudent(studentId, user);
    return this.manifestService.buildLessonAudioSummary(studentId);
  }

  /** Classes whose content the caller may download (undefined = all, owner only). */
  private async visibleClassIds(user: ClassRequester | undefined, classId?: string) {
    if (classId) {
      await this.classAccess.assertCanViewClass(classId, user);
      return [classId];
    }

    if (user?.role === Role.OWNER) {
      return undefined;
    }

    const where =
      user?.role === Role.STUDENT
        ? { students: { some: { id: user.sub } } }
        : user?.role === Role.TEACHER
          ? { teacherId: user.sub }
          : user?.role === Role.ADMIN && user.schoolId
            ? { academicYear: { schoolId: user.schoolId } }
            : null;
    if (!where) {
      throw new ForbiddenException('Not allowed to list content');
    }

    const classes = await this.prisma.class.findMany({ where, select: { id: true } });
    return classes.map((item) => item.id);
  }

  /** Teachers: students in their classes. Admins: students of their school. */
  private async assertCanSeeStudent(studentId: string, user?: ClassRequester) {
    if (user?.role === Role.OWNER) {
      return;
    }

    const visible =
      user?.role === Role.TEACHER
        ? await this.prisma.class.findFirst({
            where: { teacherId: user.sub, students: { some: { id: studentId } } },
            select: { id: true },
          })
        : user?.role === Role.ADMIN && user.schoolId
          ? await this.prisma.user.findFirst({
              where: { id: studentId, schoolId: user.schoolId },
              select: { id: true },
            })
          : null;

    if (!visible) {
      throw new ForbiddenException('Student is outside your classes');
    }
  }

  @Post('convert-audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async convertToAudio(
    @Body() dto: AudioConversionDto,
    @Req() req: Request & { user: ClassRequester & { sub: string } },
  ) {
    await this.classAccess.assertCanManageResource(dto.resourceId, req.user);
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
      data: buildAuditData({
        entityType: 'RESOURCE',
        entityId: audioResource.id,
        action: 'CREATE_AUDIO_ALTERNATIVE',
        userId: req.user.sub,
        changes: {
          id: audioResource.id,
          classId: resource.classId,
          sourceResourceId: resource.id,
          filePath: transcoded.outputPath,
          fileType: 'mp3',
          bitrate: transcoded.bitrate,
          sizeBytes: transcoded.sizeBytes,
        },
      }),
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
