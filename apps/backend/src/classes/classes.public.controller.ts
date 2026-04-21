import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common"
import { ClassesService } from "./classes.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"

@Controller("classes")
export class ClassesPublicController {
  constructor(private readonly classesService: ClassesService) {}

  @UseGuards(JwtAuthGuard)
  @Get("my-classes")
  async getMyClasses(@Req() req: { user?: { sub?: string; role?: string } }) {
    const userId = req.user?.sub
    const role = req.user?.role

    if (role === "TEACHER") {
      return this.classesService.findByTeacher(userId ?? "")
    }

    if (role === "STUDENT") {
      return this.classesService.findByStudent(userId ?? "")
    }

    return this.classesService.findAll()
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllClasses(
    @Query("academicYearId") academicYearId?: string,
    @Query("seriesId") seriesId?: string,
  ) {
    return this.classesService.findAll(academicYearId, seriesId)
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async getClass(@Param("id") classId: string) {
    return this.classesService.findById(classId)
  }
}
