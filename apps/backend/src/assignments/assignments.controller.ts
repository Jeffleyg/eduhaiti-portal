import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClassAccessService } from '../prisma/class-access.service';
import { AssignmentsService } from './assignments.service';
import { Role } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const uploadDir = 'uploads';
/** Largest file a student may hand in (keeps disks and slow links safe). */
export const MAX_SUBMISSION_BYTES = 20 * 1024 * 1024;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

type FilenameCallback = (error: Error | null, filename: string) => void;

const uniqueSuffix = () => Date.now() + '-' + Math.round(Math.random() * 1e9);

export function assignmentFilename(
  _req: unknown,
  file: { originalname: string },
  cb: FilenameCallback,
) {
  cb(null, `${uniqueSuffix()}-${file.originalname}`);
}

export function submissionFilename(
  _req: unknown,
  file: { originalname: string },
  cb: FilenameCallback,
) {
  cb(null, `submission-${uniqueSuffix()}-${file.originalname}`);
}

/** The attachment is optional: every file (or none) is accepted. */
export function acceptAnyFile(
  _req: unknown,
  _file: unknown,
  cb: (error: Error | null, accept: boolean) => void,
) {
  cb(null, true);
}

@Controller('assignments')
export class AssignmentsController {
  constructor(
    private readonly assignmentsService: AssignmentsService,
    private readonly classAccess: ClassAccessService,
  ) {}

  @Get('class/:classId')
  @UseGuards(JwtAuthGuard)
  async getByClass(@Req() req: any, @Param('classId') classId: string) {
    await this.classAccess.assertCanViewClass(classId, req.user);
    return this.assignmentsService.findByClass(classId);
  }

  @Get('my-assignments')
  @UseGuards(JwtAuthGuard)
  async getMyAssignments(@Req() req: any) {
    return this.assignmentsService.findForStudent(req.user.sub);
  }

  @Post('create/:classId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: assignmentFilename,
      }),
      fileFilter: acceptAnyFile,
    }),
  )
  async createAssignment(
    @Param('classId') classId: string,
    @UploadedFile() file: any,
    @Body() body: { title: string; description?: string; dueDate: string },
    @Req() req: any,
  ) {
    await this.classAccess.assertCanManageClass(classId, req.user);
    const filePath = file ? `uploads/${file.filename}` : undefined;
    const dueDate = new Date(body.dueDate);

    if (Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException('Invalid dueDate');
    }

    return this.assignmentsService.create(
      classId,
      body.title,
      body.description,
      dueDate,
      filePath,
      req.user.sub,
    );
  }

  @Post(':assignmentId/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: submissionFilename,
      }),
      limits: { fileSize: MAX_SUBMISSION_BYTES },
    }),
  )
  async submitAssignment(
    @Param('assignmentId') assignmentId: string,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const filePath = `uploads/${file.filename}`;
    return this.assignmentsService.submitAssignment(
      assignmentId,
      req.user.sub,
      filePath,
    );
  }

  @Put(':assignmentId/grade/:submissionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async gradeSubmission(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
    @Param('submissionId') submissionId: string,
    @Body() body: { grade: number; feedback?: string },
  ) {
    await this.classAccess.assertCanManageSubmission(
      assignmentId,
      submissionId,
      req.user,
    );
    return this.assignmentsService.gradeSubmission(
      submissionId,
      body.grade,
      body.feedback,
    );
  }

  @Delete(':assignmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async deleteAssignment(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
  ) {
    await this.classAccess.assertCanManageAssignment(assignmentId, req.user);
    return this.assignmentsService.delete(assignmentId);
  }
}
