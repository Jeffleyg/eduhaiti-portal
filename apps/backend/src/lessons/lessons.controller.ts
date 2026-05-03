import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LessonsService } from './lessons.service';

@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  async listByClass(@Query('classId') classId?: string) {
    if (!classId) {
      return [];
    }

    return this.lessonsService.listByClass(classId);
  }

  @Get('repository')
  async listRepository(@Query('classId') classId?: string, @Query('q') q?: string) {
    return this.lessonsService.listRepository({
      classId,
      query: q,
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async create(
    @Req() req: { user?: { sub?: string; role?: Role } },
    @Body()
    body: {
      classId: string;
      date: string;
      title: string;
      objectives?: string;
      content?: string;
      methodology?: string;
      visibility?: 'CLASS' | 'SCHOOL';
      tags?: string[];
    },
  ) {
    return this.lessonsService.createPlan(body, {
      id: req.user?.sub ?? '',
      role: req.user?.role ?? Role.TEACHER,
    });
  }
}
