import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PullSyncDto } from './dto/pull-sync.dto';
import { PushSyncDto } from './dto/push-sync.dto';
import type { SyncAuthenticatedRequest } from './guards/sync-school-access.guard';
import { SyncSchoolAccessGuard } from './guards/sync-school-access.guard';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard, SyncSchoolAccessGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Roles(Role.ADMIN, Role.TEACHER)
  @Post('push')
  async push(@Req() req: SyncAuthenticatedRequest, @Body() dto: PushSyncDto) {
    return this.syncService.push(dto, req.syncContext);
  }

  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @Post('pull')
  async pull(@Req() req: SyncAuthenticatedRequest, @Body() dto: PullSyncDto) {
    return this.syncService.pull(dto, req.syncContext);
  }
}
