import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, AnnouncementType } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  async create(
    @Req() req: { user?: { sub?: string; schoolId?: string | null } },
    @Body()
    payload: {
      title: string;
      content: string;
      type: AnnouncementType;
      schoolId: string;
      expiresAt?: Date;
    },
  ) {
    return this.announcementsService.create({
      ...payload,
      schoolId: req.user?.schoolId ?? payload.schoolId,
      createdById: req.user?.sub ?? '',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Req() req: { user?: { schoolId?: string | null } },
    @Query('schoolId') schoolId: string,
    @Query('type') type?: AnnouncementType,
  ) {
    return this.announcementsService.findAll(
      req.user?.schoolId ?? schoolId,
      type,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('latest')
  async getLatest(
    @Req() req: { user?: { schoolId?: string | null } },
    @Query('schoolId') schoolId: string,
    @Query('limit') limit?: string,
  ) {
    return this.announcementsService.getLatest(
      req.user?.schoolId ?? schoolId,
      limit ? parseInt(limit) : 10,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findById(
    @Req() req: { user?: { schoolId?: string | null } },
    @Param('id') announcementId: string,
  ) {
    await this.assertSameSchool(announcementId, req.user?.schoolId);
    return this.announcementsService.findById(announcementId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put(':id')
  async update(
    @Req() req: { user?: { schoolId?: string | null } },
    @Param('id') announcementId: string,
    @Body()
    payload: {
      title?: string;
      content?: string;
      type?: AnnouncementType;
      expiresAt?: Date;
    },
  ) {
    await this.assertSameSchool(announcementId, req.user?.schoolId);
    return this.announcementsService.update(announcementId, payload);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  async delete(
    @Req() req: { user?: { schoolId?: string | null } },
    @Param('id') announcementId: string,
  ) {
    await this.assertSameSchool(announcementId, req.user?.schoolId);
    return this.announcementsService.delete(announcementId);
  }

  private async assertSameSchool(announcementId: string, schoolId?: string | null) {
    if (!schoolId) return;
    const announcement = await this.announcementsService.findById(announcementId);
    if ((announcement as { schoolId?: string } | null)?.schoolId !== schoolId) {
      throw new NotFoundException('Announcement not found');
    }
  }
}
