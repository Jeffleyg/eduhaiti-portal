import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DisciplinesService } from './disciplines.service';
import { ClassAccessService } from '../prisma/class-access.service';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';

@Controller('admin/disciplines')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DisciplinesController {
  constructor(
    private readonly disciplinesService: DisciplinesService,
    private readonly classAccess: ClassAccessService,
  ) {}

  @Post()
  async create(@Req() req: any, @Body() body: CreateDisciplineDto) {
    await this.classAccess.assertSeriesInSchool(body.seriesId, req.user);
    return this.disciplinesService.create(body);
  }

  @Get()
  findBySeries(@Req() req: any, @Query('seriesId') seriesId: string) {
    return this.disciplinesService.findBySeries(seriesId, req.user?.schoolId);
  }

  @Get(':disciplineId')
  async findById(@Req() req: any, @Param('disciplineId') disciplineId: string) {
    await this.classAccess.assertDisciplineInSchool(disciplineId, req.user);
    return this.disciplinesService.findById(disciplineId);
  }

  @Put(':disciplineId')
  async update(
    @Req() req: any,
    @Param('disciplineId') disciplineId: string,
    @Body() body: UpdateDisciplineDto,
  ) {
    await this.classAccess.assertDisciplineInSchool(disciplineId, req.user);
    return this.disciplinesService.update(disciplineId, body);
  }

  @Delete(':disciplineId')
  async delete(@Req() req: any, @Param('disciplineId') disciplineId: string) {
    await this.classAccess.assertDisciplineInSchool(disciplineId, req.user);
    return this.disciplinesService.delete(disciplineId);
  }
}
