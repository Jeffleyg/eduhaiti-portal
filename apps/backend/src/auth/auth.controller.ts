import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common"
import { AuthService } from "./auth.service"
import { LoginDto } from "./dto/login.dto"
import { ChangePasswordDto } from "./dto/change-password.dto"
import { JwtAuthGuard } from "./guards/jwt-auth.guard"

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password)
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  changePassword(
    @Req() req: { user?: { sub?: string } },
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user?.sub ?? "", body.currentPassword, body.newPassword)
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getProfile(@Req() req: { user?: { sub?: string } }) {
    const userId = req.user?.sub
    return this.authService.getProfile(userId ?? "")
  }
}
