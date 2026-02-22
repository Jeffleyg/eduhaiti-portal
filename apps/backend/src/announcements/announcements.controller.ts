import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import { AnnouncementsService } from "./announcements.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role, AnnouncementType } from "@prisma/client"
import { RolesGuard } from "../common/guards/roles.guard"

@Controller("announcements")
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  async create(
    @Req() req: { user?: { sub?: string } },
    @Body()
    payload: {
      title: string
      content: string
      type: AnnouncementType
      schoolId: string
      expiresAt?: Date
    },
  ) {
    return this.announcementsService.create({
      ...payload,
      createdById: req.user?.sub ?? "",
    })
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query("schoolId") schoolId: string,
    @Query("type") type?: AnnouncementType,
  ) {
    return this.announcementsService.findAll(schoolId, type)
  }

  @UseGuards(JwtAuthGuard)
  @Get("latest")
  async getLatest(
    @Query("schoolId") schoolId: string,
    @Query("limit") limit?: string,
  ) {
    return this.announcementsService.getLatest(schoolId, limit ? parseInt(limit) : 10)
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async findById(@Param("id") announcementId: string) {
    return this.announcementsService.findById(announcementId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put(":id")
  async update(
    @Param("id") announcementId: string,
    @Body()
    payload: {
      title?: string
      content?: string
      type?: AnnouncementType
      expiresAt?: Date
    },
  ) {
    return this.announcementsService.update(announcementId, payload)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(":id")
  async delete(@Param("id") announcementId: string) {
    return this.announcementsService.delete(announcementId)
  }
}
