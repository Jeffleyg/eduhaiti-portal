import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AnnouncementType, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnnouncementsService } from './announcements.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

type AuthRequest = {
  user?: { sub?: string; role?: Role; schoolId?: string | null };
};

const TYPES = new Set<string>(Object.values(AnnouncementType));

@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  /**
   * Active announcements of the user's school. School admins can add
   * `?include=all` to also get scheduled and expired ones.
   */
  @Get()
  list(
    @Req() req: AuthRequest,
    @Query('type') type?: string,
    @Query('include') include?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const school = this.school(req, schoolId);
    const safeType = this.type(type);
    if (include === 'all' && this.isAdmin(req)) {
      return this.announcements.listAll(school, safeType);
    }
    return this.announcements.listActive(school, { type: safeType });
  }

  @Get('latest')
  latest(
    @Req() req: AuthRequest,
    @Query('limit') limit?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const parsed = Number.parseInt(limit ?? '', 10);
    return this.announcements.listActive(this.school(req, schoolId), {
      limit: Number.isNaN(parsed) ? 5 : parsed,
    });
  }

  @Get(':id')
  findOne(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.announcements.findOne(id, this.school(req), this.isAdmin(req));
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Req() req: AuthRequest, @Body() body: CreateAnnouncementDto) {
    return this.announcements.create(
      this.school(req),
      req.user?.sub ?? '',
      body,
    );
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: UpdateAnnouncementDto,
  ) {
    return this.announcements.update(id, this.school(req), body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.announcements.remove(id, this.school(req));
  }

  /** Always the token's school; only the platform owner may pick one. */
  private school(req: AuthRequest, requested?: string) {
    if (req.user?.schoolId) return req.user.schoolId;
    if (req.user?.role === Role.OWNER && requested) return requested;
    throw new ForbiddenException('User is not linked to a school');
  }

  private isAdmin(req: AuthRequest) {
    return req.user?.role === Role.ADMIN;
  }

  private type(value?: string) {
    return value && TYPES.has(value) ? (value as AnnouncementType) : undefined;
  }
}
