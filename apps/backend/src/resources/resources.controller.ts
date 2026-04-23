import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../auth/decorators/roles.decorator"
import { RolesGuard } from "../auth/guards/roles.guard"
import { ResourcesService } from "./resources.service"
import { Role } from "@prisma/client"
import { AssetOptimizationService } from "../content-delivery/services/asset-optimization.service"
import * as path from "path"
import * as fs from "fs"

const uploadDir = "uploads"

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

@Controller("resources")
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly assetOptimizationService: AssetOptimizationService,
  ) {}

  @Get("class/:classId")
  @UseGuards(JwtAuthGuard)
  async getByClass(@Param("classId") classId: string) {
    return this.resourcesService.findByClass(classId)
  }

  @Get("library/series/:seriesId")
  @UseGuards(JwtAuthGuard)
  async getLibraryBySeries(@Param("seriesId") seriesId: string) {
    return this.resourcesService.findLibraryBySeries(seriesId)
  }

  @Get("library/school/:schoolId")
  @UseGuards(JwtAuthGuard)
  async getLibraryBySchool(@Param("schoolId") schoolId: string) {
    return this.resourcesService.findLibraryBySchool(schoolId)
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

    const filePath = `uploads/${file.filename}`
    const optimized = await this.assetOptimizationService.optimizeUploadedAsset(filePath)

    const fileType =
      optimized.fileType || path.extname(file.originalname).toLowerCase().replace(".", "")

    const resource = await this.resourcesService.create(
      classId,
      body.title,
      body.description,
      optimized.optimizedPath,
      fileType,
      req.user.sub,
    )

    return {
      ...resource,
      optimization: {
        contentHash: optimized.contentHash,
        sizeBytes: optimized.sizeBytes,
      },
    }
  }

  @Delete(":resourceId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  async deleteResource(@Param("resourceId") resourceId: string) {
    return this.resourcesService.delete(resourceId)
  }
}
