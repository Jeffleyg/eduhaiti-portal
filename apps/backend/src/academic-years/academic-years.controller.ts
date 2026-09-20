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
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';

@Controller('admin/academic-years')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AcademicYearsController {
  constructor(
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  @Get()
  list(@Request() req: any) {
    return this.academicYearsService.listBySchool(req.user?.schoolId);
  }

  @Post()
  create(@Request() req: any, @Body() body: CreateAcademicYearDto) {
    return this.academicYearsService.create(req.user?.schoolId, body);
  }

  @Delete(':yearId')
  remove(@Request() req: any, @Param('yearId') yearId: string) {
    return this.academicYearsService.remove(req.user?.schoolId, yearId);
  }
}