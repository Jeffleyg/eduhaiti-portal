import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common"
import { Role } from "@prisma/client"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { RolesGuard } from "../common/guards/roles.guard"
import { AcademicPeriodsService } from "./academic-periods.service"
import { CreateAcademicPeriodDto } from "./dto/create-academic-period.dto"
import { UpdateAcademicPeriodDto } from "./dto/update-academic-period.dto"

@Controller("admin/academic-periods")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AcademicPeriodsController {
  constructor(private readonly academicPeriodsService: AcademicPeriodsService) {}

  @Get()
  listBySchool(@Query("schoolId") schoolId: string) {
    return this.academicPeriodsService.listBySchool(schoolId)
  }

  @Post()
  create(@Body() body: CreateAcademicPeriodDto) {
    return this.academicPeriodsService.create(body)
  }

  @Put(":periodId")
  update(@Param("periodId") periodId: string, @Body() body: UpdateAcademicPeriodDto) {
    return this.academicPeriodsService.update(periodId, body)
  }

  @Patch(":periodId/open")
  open(@Param("periodId") periodId: string) {
    return this.academicPeriodsService.setOpenState(periodId, true)
  }

  @Patch(":periodId/close")
  close(@Param("periodId") periodId: string) {
    return this.academicPeriodsService.setOpenState(periodId, false)
  }

  @Delete(":periodId")
  remove(@Param("periodId") periodId: string) {
    return this.academicPeriodsService.remove(periodId)
  }
}
