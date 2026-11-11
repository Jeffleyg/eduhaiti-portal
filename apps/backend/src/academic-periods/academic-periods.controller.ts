import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AcademicPeriodsService } from './academic-periods.service';
import { CreateAcademicPeriodDto } from './dto/create-academic-period.dto';
import { UpdateAcademicPeriodDto } from './dto/update-academic-period.dto';

@Controller('admin/academic-periods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AcademicPeriodsController {
  constructor(
    private readonly academicPeriodsService: AcademicPeriodsService,
  ) {}

  @Get()
  listBySchool(@Request() req: any, @Query('schoolId') schoolId?: string) {
    // An admin linked to a school is always scoped to it
    const targetSchoolId = req.user?.schoolId || schoolId;
    return this.academicPeriodsService.listBySchool(targetSchoolId);
  }

  @Post()
  create(@Request() req: any, @Body() body: CreateAcademicPeriodDto) {
    if (req.user?.schoolId) {
      body.schoolId = req.user.schoolId;
    }
    return this.academicPeriodsService.create(body);
  }

  @Put(':periodId')
  async update(
    @Request() req: any,
    @Param('periodId') periodId: string,
    @Body() body: UpdateAcademicPeriodDto,
  ) {
    await this.academicPeriodsService.assertPeriodInSchool(periodId, req.user?.schoolId);
    return this.academicPeriodsService.update(periodId, body);
  }

  @Patch(':periodId/open')
  async open(@Request() req: any, @Param('periodId') periodId: string) {
    await this.academicPeriodsService.assertPeriodInSchool(periodId, req.user?.schoolId);
    return this.academicPeriodsService.setOpenState(periodId, true);
  }

  @Patch(':periodId/close')
  async close(@Request() req: any, @Param('periodId') periodId: string) {
    await this.academicPeriodsService.assertPeriodInSchool(periodId, req.user?.schoolId);
    return this.academicPeriodsService.setOpenState(periodId, false);
  }

  @Delete(':periodId')
  async remove(@Request() req: any, @Param('periodId') periodId: string) {
    await this.academicPeriodsService.assertPeriodInSchool(periodId, req.user?.schoolId);
    return this.academicPeriodsService.remove(periodId);
  }
}