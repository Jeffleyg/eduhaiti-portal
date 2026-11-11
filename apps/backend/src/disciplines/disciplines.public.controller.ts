import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DisciplinesService } from './disciplines.service';
import { ClassAccessService, ClassRequester } from '../prisma/class-access.service';

@Controller('disciplines')
export class DisciplinesPublicController {
  constructor(
    private readonly disciplinesService: DisciplinesService,
    private readonly classAccess: ClassAccessService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get()
  async findBySeries(
    @Req() req: { user?: ClassRequester },
    @Query('seriesId') seriesId: string,
  ) {
    await this.classAccess.assertSeriesInSchool(seriesId, req.user);
    return this.disciplinesService.findBySeries(seriesId);
  }
}
