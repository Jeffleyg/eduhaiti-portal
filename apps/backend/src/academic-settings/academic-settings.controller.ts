import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common"
import { Role } from "@prisma/client"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { RolesGuard } from "../common/guards/roles.guard"
import { AcademicSettingsService } from "./academic-settings.service"
import { UpsertAcademicSettingDto } from "./dto/upsert-academic-setting.dto"

@Controller("admin/academic-settings")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AcademicSettingsController {
  constructor(private readonly academicSettingsService: AcademicSettingsService) {}

  @Get(":schoolId")
  getBySchool(@Param("schoolId") schoolId: string) {
    return this.academicSettingsService.getBySchool(schoolId)
  }

  @Put(":schoolId")
  upsertBySchool(@Param("schoolId") schoolId: string, @Body() body: UpsertAcademicSettingDto) {
    return this.academicSettingsService.upsertBySchool(schoolId, body)
  }
}
