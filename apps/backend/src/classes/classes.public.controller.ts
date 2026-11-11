import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ClassesService } from './classes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ClassAccessService,
  ClassRequester,
} from '../prisma/class-access.service';

type AuthRequest = { user?: ClassRequester };

@Controller('classes')
@UseGuards(JwtAuthGuard)
export class ClassesPublicController {
  constructor(
    private readonly classesService: ClassesService,
    private readonly classAccess: ClassAccessService,
  ) {}

  /** School the caller may browse; undefined means "every school" (owner only). */
  private browsableSchool(user?: ClassRequester): string | undefined {
    if (user?.role === Role.OWNER) {
      return undefined;
    }
    if (!user?.schoolId) {
      throw new ForbiddenException('User is not linked to a school');
    }
    return user.schoolId;
  }

  @Get('my-classes')
  async getMyClasses(@Req() req: AuthRequest) {
    const userId = req.user?.sub ?? '';
    const role = req.user?.role;

    if (role === Role.TEACHER) {
      return this.classesService.findByTeacher(userId);
    }

    if (role === Role.STUDENT) {
      return this.classesService.findByStudent(userId);
    }

    return this.classesService.findAll(
      undefined,
      undefined,
      this.browsableSchool(req.user),
    );
  }

  /** Declared before ':id' so "my-summary" is not read as a class id. */
  @Get('my-summary')
  async getMySummary(@Req() req: AuthRequest) {
    if (req.user?.role !== Role.TEACHER) {
      throw new ForbiddenException('Only teachers have a class summary');
    }
    return this.classesService.getTeacherSummary(req.user.sub ?? '');
  }

  @Get()
  async getAllClasses(
    @Req() req: AuthRequest,
    @Query('academicYearId') academicYearId?: string,
    @Query('seriesId') seriesId?: string,
  ) {
    // Students only ever see their own classes.
    if (req.user?.role === Role.STUDENT) {
      return this.classesService.findByStudent(req.user.sub ?? '');
    }
    return this.classesService.findAll(
      academicYearId,
      seriesId,
      this.browsableSchool(req.user),
    );
  }

  @Get(':id')
  async getClass(@Req() req: AuthRequest, @Param('id') classId: string) {
    await this.classAccess.assertCanViewClass(classId, req.user);
    return this.classesService.findById(classId);
  }
}
