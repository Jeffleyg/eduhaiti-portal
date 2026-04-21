import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common"
import { Role } from "@prisma/client"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { RolesGuard } from "../common/guards/roles.guard"
import { AcademicRequestsService } from "./academic-requests.service"
import { CreateAcademicRequestDto } from "./dto/create-academic-request.dto"
import { ListAcademicRequestsDto } from "./dto/list-academic-requests.dto"
import { ReviewAcademicRequestDto } from "./dto/review-academic-request.dto"

@Controller("academic-requests")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicRequestsController {
  constructor(private readonly academicRequestsService: AcademicRequestsService) {}

  @Post()
  @Roles(Role.STUDENT)
  create(@Req() req: any, @Body() body: CreateAcademicRequestDto) {
    return this.academicRequestsService.create(req.user.sub, body)
  }

  @Get("me")
  @Roles(Role.STUDENT)
  listMine(@Req() req: any) {
    return this.academicRequestsService.listMine(req.user.sub)
  }

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  listForReview(@Req() req: any, @Query() query: ListAcademicRequestsDto) {
    return this.academicRequestsService.listForReview(
      {
        id: req.user.sub,
        role: req.user.role,
      },
      query,
    )
  }

  @Patch(":requestId/review")
  @Roles(Role.TEACHER, Role.ADMIN)
  review(@Req() req: any, @Body() body: ReviewAcademicRequestDto, @Param("requestId") requestId: string) {
    return this.academicRequestsService.reviewRequest(
      requestId,
      {
        id: req.user.sub,
        role: req.user.role,
      },
      body,
    )
  }
}
