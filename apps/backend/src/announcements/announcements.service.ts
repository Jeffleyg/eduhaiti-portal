import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnnouncementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

/** Published (not scheduled for later) and not expired yet. */
export function activeAnnouncementWhere(
  now = new Date(),
): Prisma.AnnouncementWhereInput {
  return {
    publishedAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

// Readers never get the author's e-mail.
const AUTHOR = { createdBy: { select: { id: true, name: true } } };
const MAX_LIMIT = 50;

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** What students, teachers and families see. */
  async listActive(
    schoolId: string,
    options: { type?: AnnouncementType; limit?: number } = {},
  ) {
    const limit = Math.min(Math.max(options.limit ?? MAX_LIMIT, 1), MAX_LIMIT);
    return this.prisma.announcement.findMany({
      where: {
        schoolId,
        ...activeAnnouncementWhere(),
        ...(options.type ? { type: options.type } : {}),
      },
      include: AUTHOR,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  /** Every announcement of the school, including scheduled and expired ones. */
  async listAll(schoolId: string, type?: AnnouncementType) {
    return this.prisma.announcement.findMany({
      where: { schoolId, ...(type ? { type } : {}) },
      include: AUTHOR,
      orderBy: { publishedAt: 'desc' },
    });
  }

  async findOne(id: string, schoolId: string, includeInactive: boolean) {
    const announcement = await this.prisma.announcement.findFirst({
      where: {
        id,
        schoolId,
        ...(includeInactive ? {} : activeAnnouncementWhere()),
      },
      include: AUTHOR,
    });
    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }
    return announcement;
  }

  async create(schoolId: string, userId: string, dto: CreateAnnouncementDto) {
    const publishedAt = dto.publishedAt
      ? new Date(dto.publishedAt)
      : new Date();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    this.assertDates(publishedAt, expiresAt);

    return this.prisma.announcement.create({
      data: {
        schoolId,
        createdById: userId,
        title: dto.title,
        content: dto.content,
        type: dto.type,
        publishedAt,
        expiresAt,
      },
      include: AUTHOR,
    });
  }

  async update(id: string, schoolId: string, dto: UpdateAnnouncementDto) {
    const existing = await this.findOne(id, schoolId, true);
    const publishedAt = dto.publishedAt
      ? new Date(dto.publishedAt)
      : existing.publishedAt;
    let expiresAt = existing.expiresAt;
    if (dto.expiresAt !== undefined) {
      expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    this.assertDates(publishedAt, expiresAt);

    return this.prisma.announcement.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        type: dto.type,
        publishedAt,
        expiresAt,
      },
      include: AUTHOR,
    });
  }

  async remove(id: string, schoolId: string) {
    await this.findOne(id, schoolId, true);
    await this.prisma.announcement.delete({ where: { id } });
    return { success: true };
  }

  private assertDates(publishedAt: Date, expiresAt: Date | null) {
    if (expiresAt && expiresAt <= publishedAt) {
      throw new BadRequestException(
        'expiresAt must be after the publication date',
      );
    }
  }
}
