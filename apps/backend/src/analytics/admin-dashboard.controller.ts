import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  /** Always the admin's own school: there is no way to ask for another one. */
  @Get()
  getDashboard(@Req() req: { user?: { schoolId?: string | null } }) {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      throw new ForbiddenException('Admin is not linked to a school');
    }
    return this.dashboard.getDashboard(schoolId);
  }
}
