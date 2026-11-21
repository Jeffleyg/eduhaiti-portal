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
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClassAccessService } from '../prisma/class-access.service';
import { AssignmentsService } from './assignments.service';
import { Role } from '@prisma/client';
import {
  MAX_ASSIGNMENT_FILE_BYTES,
  PRIVATE_ASSIGNMENT_DIR,
  displayName,
  ensurePrivateDir,
  removeStoredFile,
  resolveStoredFile,
  storedFileName,
  storedPath,
} from './assignment-files';

/** Largest file a student may hand in (keeps disks and slow links safe). */
export const MAX_SUBMISSION_BYTES = MAX_ASSIGNMENT_FILE_BYTES;

ensurePrivateDir();

type FilenameCallback = (error: Error | null, filename: string) => void;

export function assignmentFilename(
  _req: unknown,
  file: { originalname: string },
  cb: FilenameCallback,
) {
  cb(null, storedFileName('task', file.originalname));
}

export function submissionFilename(
  _req: unknown,
  file: { originalname: string },
  cb: FilenameCallback,
) {
  cb(null, storedFileName('submission', file.originalname));
}

/** The attachment is optional: every file (or none) is accepted. */
export function acceptAnyFile(
  _req: unknown,
  _file: unknown,
  cb: (error: Error | null, accept: boolean) => void,
) {
  cb(null, true);
}

/** Streams a stored document as a download; never exposes its disk location. */
export function sendStoredFile(res: Response, filePath: string) {
  const absolute = resolveStoredFile(filePath);
  if (!absolute) {
    throw new NotFoundException('File not found');
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.download(absolute, displayName(filePath) ?? 'file');
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
    return this.assignmentsService.findByClass(classId, req.user);
  }

  @Get('my-assignments')
  @UseGuards(JwtAuthGuard)
  async getMyAssignments(@Req() req: any) {
    return this.assignmentsService.findForStudent(req.user.sub);
  }

  /** Teacher's document: only the class it was given to (and its managers). */
  @Get(':assignmentId/file')
  @UseGuards(JwtAuthGuard)
  async downloadAssignmentFile(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
    @Res() res: Response,
  ) {
    const assignment =
      await this.assignmentsService.findAssignmentFile(assignmentId);
    await this.classAccess.assertCanViewClass(assignment.classId, req.user);
    sendStoredFile(res, assignment.filePath);
  }

  /** Hand-ins received by the teacher who created the assignment. */
  @Get(':assignmentId/submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async listSubmissions(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.assignmentsService.listSubmissions(assignmentId, req.user);
  }

  /** A hand-in: only its student or the teacher who created the assignment. */
  @Get(':assignmentId/submissions/:submissionId/file')
  @UseGuards(JwtAuthGuard)
  async downloadSubmissionFile(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
    @Param('submissionId') submissionId: string,
    @Res() res: Response,
  ) {
    const submission = await this.assignmentsService.findSubmissionFile(
      assignmentId,
      submissionId,
      req.user,
    );
    sendStoredFile(res, submission.filePath);
  }

  @Post('create/:classId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: PRIVATE_ASSIGNMENT_DIR,
        filename: assignmentFilename,
      }),
      fileFilter: acceptAnyFile,
      limits: { fileSize: MAX_ASSIGNMENT_FILE_BYTES },
    }),
  )
  async createAssignment(
    @Param('classId') classId: string,
    @UploadedFile() file: any,
    @Body() body: { title: string; description?: string; dueDate: string },
    @Req() req: any,
  ) {
    const filePath = file ? storedPath(file.filename) : undefined;
    try {
      await this.classAccess.assertCanManageClass(classId, req.user);
      const dueDate = new Date(body.dueDate);

      if (Number.isNaN(dueDate.getTime())) {
        throw new BadRequestException('Invalid dueDate');
      }

      return await this.assignmentsService.create(
        classId,
        body.title,
        body.description,
        dueDate,
        filePath,
        req.user.sub,
      );
    } catch (error) {
      // a rejected request must not leave its upload behind
      removeStoredFile(filePath);
      throw error;
    }
  }

  /** Hands in, or replaces (edits) the student's document until it is graded. */
  @Post(':assignmentId/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: PRIVATE_ASSIGNMENT_DIR,
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

    const filePath = storedPath(file.filename);
    try {
      return await this.assignmentsService.submitAssignment(
        assignmentId,
        req.user.sub,
        filePath,
      );
    } catch (error) {
      removeStoredFile(filePath);
      throw error;
    }
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
    // only the teacher who gave the assignment grades what they received
    await this.assignmentsService.assertIsCreator(assignmentId, req.user);
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
