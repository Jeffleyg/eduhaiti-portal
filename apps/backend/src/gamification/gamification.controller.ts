import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GamificationService } from './gamification.service';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(Role.STUDENT)
  async me(@Req() req: { user?: { sub?: string } }) {
    return this.gamificationService.getStudentSummary(req.user?.sub ?? '');
  }

  @Get('class/:classId/leaderboard')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async classLeaderboard(
    @Req() req: { user?: { sub?: string; role?: Role } },
    @Param('classId') classId: string,
  ) {
    return this.gamificationService.getClassLeaderboard(classId, {
      id: req.user?.sub ?? '',
      role: req.user?.role ?? Role.TEACHER,
    });
  }
}
