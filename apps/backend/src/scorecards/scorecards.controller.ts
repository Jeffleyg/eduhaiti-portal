import { Controller, Get, Param, UseGuards } from "@nestjs/common"
import { ScorecardsService } from "./scorecards.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../common/guards/roles.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role } from "@prisma/client"

@Controller()
export class ScorecardsController {
  constructor(private readonly scorecardsService: ScorecardsService) {}

  @Get("public/scorecards/:scorecardId/verify")
  verifyPublic(@Param("scorecardId") scorecardId: string) {
    return this.scorecardsService.verifyPublicScorecard(scorecardId)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.TEACHER)
  @Get("scorecards/:scorecardId/verify")
  verifyPrivate(@Param("scorecardId") scorecardId: string) {
    return this.scorecardsService.verifyPublicScorecard(scorecardId)
  }
}
