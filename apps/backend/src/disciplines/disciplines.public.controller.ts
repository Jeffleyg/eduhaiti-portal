import { Controller, Get, Query, UseGuards } from "@nestjs/common"
import { Role } from "@prisma/client"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { RolesGuard } from "../common/guards/roles.guard"
import { DisciplinesService } from "./disciplines.service"

@Controller("disciplines")
export class DisciplinesPublicController {
  constructor(private readonly disciplinesService: DisciplinesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Get()
  findBySeries(@Query("seriesId") seriesId: string) {
    return this.disciplinesService.findBySeries(seriesId)
  }
}
