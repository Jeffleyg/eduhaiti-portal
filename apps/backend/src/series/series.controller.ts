import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SeriesService } from './series.service';
import { CreateSeriesDto } from './dto/create-series.dto';

@Controller('admin/series')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Get()
  list(@Request() req: any) {
    return this.seriesService.listAll(req.user?.schoolId);
  }

  @Post()
  create(@Request() req: any, @Body() body: CreateSeriesDto) {
    return this.seriesService.create(req.user?.schoolId, body);
  }

  @Delete(':seriesId')
  remove(@Param('seriesId') seriesId: string) {
    return this.seriesService.remove(seriesId);
  }
}