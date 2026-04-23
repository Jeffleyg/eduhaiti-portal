import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common"
import { Role } from "@prisma/client"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { RolesGuard } from "../common/guards/roles.guard"
import { FamilyAccessService } from "./family-access.service"

@Controller("family")
export class FamilyAccessController {
  constructor(private readonly familyAccessService: FamilyAccessService) {}

  @Get("overview/:enrollmentNumber")
  getFamilyOverview(
    @Param("enrollmentNumber") enrollmentNumber: string,
    @Query("guardianName") guardianName?: string,
  ) {
    return this.familyAccessService.getFamilyOverview(enrollmentNumber, guardianName)
  }

  @Post("contact-request")
  createContactRequest(
    @Body()
    payload: {
      enrollmentNumber: string
      guardianName: string
      guardianPhone?: string
      subject: string
      body: string
      urgent?: boolean
    },
  ) {
    return this.familyAccessService.createFamilyContactRequest(payload)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @Post("admin/notices")
  createSchoolFamilyNotice(
    @Req() req: { user?: { sub?: string } },
    @Body()
    payload: {
      enrollmentNumber: string
      title: string
      body: string
      severity?: "normal" | "urgent"
      channel?: "IN_APP" | "SMS" | "BOTH"
      guardianPhone?: string
    },
  ) {
    return this.familyAccessService.createSchoolFamilyNotice({
      ...payload,
      actorId: req.user?.sub ?? "",
    })
  }
}
