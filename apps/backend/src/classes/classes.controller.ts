import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common"
import { ClassesService } from "./classes.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../common/guards/roles.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role } from "@prisma/client"

@Controller("classes")
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @UseGuards(JwtAuthGuard)
  @Get("my-classes")
  async getMyClasses(@Req() req: { user?: { sub?: string; role?: string } }) {
    const userId = req.user?.sub
    const role = req.user?.role

    if (role === "TEACHER" || role === "ADMIN") {
      return this.classesService.findByTeacher(userId ?? "")
    } else {
      return this.classesService.findByStudent(userId ?? "")
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async getClass(@Param("id") classId: string) {
    return this.classesService.findById(classId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async getAllClasses() {
    return this.classesService.findAll()
  }
}
