import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { AnnouncementType } from "@prisma/client"

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(payload: {
    title: string
    content: string
    type: AnnouncementType
    createdById: string
    schoolId: string
    expiresAt?: Date
  }) {
    return this.prisma.announcement.create({
      data: payload,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })
  }

  async update(
    announcementId: string,
    payload: {
      title?: string
      content?: string
      type?: AnnouncementType
      expiresAt?: Date
    },
  ) {
    const existing = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    })

    if (!existing) {
      throw new NotFoundException("Announcement not found")
    }

    return this.prisma.announcement.update({
      where: { id: announcementId },
      data: payload,
    })
  }

  async delete(announcementId: string) {
    const existing = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    })

    if (!existing) {
      throw new NotFoundException("Announcement not found")
    }

    await this.prisma.announcement.delete({ where: { id: announcementId } })
    return { message: "Announcement deleted" }
  }

  async findAll(schoolId: string, type?: AnnouncementType) {
    const where: any = { schoolId }

    if (type) {
      where.type = type
    }

    return this.prisma.announcement.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { publishedAt: "desc" },
    })
  }

  async findById(announcementId: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    if (!announcement) {
      throw new NotFoundException("Announcement not found")
    }

    return announcement
  }

  async getLatest(schoolId: string, limit: number = 10) {
    return this.prisma.announcement.findMany({
      where: { schoolId },
      take: limit,
      orderBy: { publishedAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })
  }
}
