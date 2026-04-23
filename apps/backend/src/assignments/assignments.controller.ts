import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../auth/decorators/roles.decorator"
import { RolesGuard } from "../auth/guards/roles.guard"
import { AssignmentsService } from "./assignments.service"
import { Role } from "@prisma/client"
import * as path from "path"
import * as fs from "fs"

const uploadDir = "uploads"
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

@Controller("assignments")
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get("class/:classId")
  @UseGuards(JwtAuthGuard)
  async getByClass(@Param("classId") classId: string) {
    return this.assignmentsService.findByClass(classId)
  }

  @Get("my-assignments")
  @UseGuards(JwtAuthGuard)
  async getMyAssignments(@Req() req: any) {
    return this.assignmentsService.findForStudent(req.user.sub)
  }

  @Post("create/:classId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
          cb(null, `${uniqueSuffix}-${file.originalname}`)
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file) {
          cb(null, true)
        } else {
          cb(null, true)
        }
      },
    }),
  )
  async createAssignment(
    @Param("classId") classId: string,
    @UploadedFile() file: any,
    @Body() body: { title: string; description?: string; dueDate: string },
    @Req() req: any,
  ) {
    const filePath = file ? `uploads/${file.filename}` : undefined
    const dueDate = new Date(body.dueDate)

    if (Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException("Invalid dueDate")
    }

    return this.assignmentsService.create(classId, body.title, body.description, dueDate, filePath, req.user.sub)
  }

  @Post(":assignmentId/submit")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
          cb(null, `submission-${uniqueSuffix}-${file.originalname}`)
        },
      }),
    }),
  )
  async submitAssignment(
    @Param("assignmentId") assignmentId: string,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded")
    }

    const filePath = `uploads/${file.filename}`
    return this.assignmentsService.submitAssignment(assignmentId, req.user.sub, filePath)
  }

  @Put(":assignmentId/grade/:submissionId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async gradeSubmission(
    @Param("submissionId") submissionId: string,
    @Body() body: { grade: number; feedback?: string },
  ) {
    return this.assignmentsService.gradeSubmission(submissionId, body.grade, body.feedback)
  }

  @Delete(":assignmentId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async deleteAssignment(@Param("assignmentId") assignmentId: string) {
    return this.assignmentsService.delete(assignmentId)
  }
}
