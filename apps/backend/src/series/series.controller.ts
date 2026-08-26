import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { SeriesService } from './series.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';

@Controller('admin/series')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Get()
  list(@Req() req: { user?: { schoolId?: string } }, @Query('academicYearId') academicYearId?: string) {
    return this.seriesService.list(academicYearId, req.user?.schoolId);
  }

  @Post()
  create(@Req() req: { user?: { schoolId?: string } }, @Body() body: CreateSeriesDto) {
    return this.seriesService.create(body, req.user?.schoolId);
  }

  @Put(':id')
  update(@Req() req: { user?: { schoolId?: string } }, @Param('id') id: string, @Body() body: UpdateSeriesDto) {
    return this.seriesService.update(id, body, req.user?.schoolId);
  }

  @Delete(':id')
  remove(@Req() req: { user?: { schoolId?: string } }, @Param('id') id: string) {
    return this.seriesService.remove(id, req.user?.schoolId);
  }
}
