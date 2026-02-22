import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../auth/decorators/roles.decorator"
import { RolesGuard } from "../auth/guards/roles.guard"
import { ResourcesService } from "./resources.service"
import { Role } from "@prisma/client"
import * as path from "path"
import * as fs from "fs"

const uploadDir = "uploads"

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

@Controller("resources")
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get("class/:classId")
  @UseGuards(JwtAuthGuard)
  async getByClass(@Param("classId") classId: string) {
    return this.resourcesService.findByClass(classId)
  }

  @Post("upload/:classId")
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
    }),
  )
  async uploadResource(
    @Param("classId") classId: string,
    @UploadedFile() file: any,
    @Body() body: { title: string; description?: string },
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded")
    }

    const fileType = path.extname(file.originalname).toLowerCase().replace(".", "")
    const filePath = `uploads/${file.filename}`

    return this.resourcesService.create(classId, body.title, body.description, filePath, fileType, req.user.sub)
  }

  @Delete(":resourceId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async deleteResource(@Param("resourceId") resourceId: string) {
    return this.resourcesService.delete(resourceId)
  }
}
