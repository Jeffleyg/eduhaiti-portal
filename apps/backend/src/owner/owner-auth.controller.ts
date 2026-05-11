import { Controller, Post, Body, HttpCode } from '@nestjs/common'
import { OwnerService } from './owner.service'

@Controller('owner-auth')
export class OwnerAuthController {
  constructor(private readonly ownerService: OwnerService) {}

  // Public endpoint: Verify permission code and create school admin account
  @Post('verify-permission-code')
  @HttpCode(200)
  async verifyPermissionCode(@Body() data: { code: string; email: string; name?: string }) {
    return this.ownerService.verifyPermissionCode(data.code, data.email, data.name)
  }
}
