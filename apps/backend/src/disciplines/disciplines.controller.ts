import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Query } from "@nestjs/common"
import { Role } from "@prisma/client"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { RolesGuard } from "../common/guards/roles.guard"
import { DisciplinesService } from "./disciplines.service"
import { CreateDisciplineDto } from "./dto/create-discipline.dto"
import { UpdateDisciplineDto } from "./dto/update-discipline.dto"

@Controller("admin/disciplines")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DisciplinesController {
  constructor(private readonly disciplinesService: DisciplinesService) {}

  @Post()
  create(@Body() body: CreateDisciplineDto) {
    return this.disciplinesService.create(body)
  }

  @Get()
  findBySeries(@Query("seriesId") seriesId: string) {
    return this.disciplinesService.findBySeries(seriesId)
  }

  @Get(":disciplineId")
  findById(@Param("disciplineId") disciplineId: string) {
    return this.disciplinesService.findById(disciplineId)
  }

  @Put(":disciplineId")
  update(@Param("disciplineId") disciplineId: string, @Body() body: UpdateDisciplineDto) {
    return this.disciplinesService.update(disciplineId, body)
  }

  @Delete(":disciplineId")
  delete(@Param("disciplineId") disciplineId: string) {
    return this.disciplinesService.delete(disciplineId)
  }
}
