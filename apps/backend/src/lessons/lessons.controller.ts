import {
  Body,
  Controller,
  ForbiddenException,
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
import { ClassAccessService, ClassRequester } from '../prisma/class-access.service';

type AuthRequest = { user?: ClassRequester & { role?: Role } };

@Controller('lessons')
@UseGuards(JwtAuthGuard)
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly classAccess: ClassAccessService,
  ) {}

  @Get()
  async listByClass(@Req() req: AuthRequest, @Query('classId') classId?: string) {
    if (!classId) {
      return [];
    }

    // Students of the class, its teacher, or admins of its school.
    await this.classAccess.assertCanViewClass(classId, req.user);
    return this.lessonsService.listByClass(classId);
  }

  @Get('repository')
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN, Role.OWNER)
  async listRepository(
    @Req() req: AuthRequest,
    @Query('classId') classId?: string,
    @Query('q') q?: string,
  ) {
    const user = req.user ?? {};
    if (user.role !== Role.OWNER && !user.schoolId) {
      throw new ForbiddenException('User is not linked to a school');
    }
    if (classId) {
      await this.classAccess.assertCanViewClass(classId, user);
    }

    return this.lessonsService.listRepository({
      classId,
      query: q,
      schoolId: user.role === Role.OWNER ? undefined : (user.schoolId ?? undefined),
      viewerId: user.sub,
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async create(
    @Req() req: AuthRequest,
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
    return this.lessonsService.createPlan(body, req.user ?? {});
  }
}
