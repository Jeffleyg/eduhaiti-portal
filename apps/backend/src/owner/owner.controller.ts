import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common'
import { OwnerService } from './owner.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'

@Controller('owner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class OwnerController {
  constructor(private readonly ownerService: OwnerService) {}

  // Schools Management
  @Get('schools')
  async listSchools() {
    return this.ownerService.listAllSchools()
  }

  @Get('schools/:id')
  async getSchool(@Param('id') id: string) {
    return this.ownerService.getSchoolDetails(id)
  }

  @Post('schools')
  @HttpCode(201)
  async createSchool(
    @Body()
    data: {
      name: string
      email: string
      phone?: string
      address?: string
      city?: string
      country?: string
      principal?: string
    },
  ) {
    return this.ownerService.createSchool(data)
  }

  @Patch('schools/:id')
  async updateSchool(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string
      email?: string
      phone?: string
      address?: string
      city?: string
      country?: string
      principal?: string
    },
  ) {
    return this.ownerService.updateSchool(id, data)
  }

  @Delete('schools/:id')
  @HttpCode(204)
  async deleteSchool(@Param('id') id: string) {
    return this.ownerService.deleteSchool(id)
  }

  // School Features Management
  @Get('schools/:id/features')
  async getSchoolFeatures(@Param('id') id: string) {
    return this.ownerService.getSchoolFeatures(id)
  }

  @Patch('schools/:id/features')
  async updateSchoolFeatures(
    @Param('id') id: string,
    @Body()
    features: {
      enableFamilyAccess?: boolean
      enablePayment?: boolean
      enableGamification?: boolean
      enableForums?: boolean
      enableLessons?: boolean
      enableInventory?: boolean
      enableFinance?: boolean
      enableSync?: boolean
    },
  ) {
    return this.ownerService.updateSchoolFeatures(id, features)
  }

  // School Usage Analytics
  @Get('schools/:id/analytics')
  async getSchoolAnalytics(@Param('id') id: string) {
    return this.ownerService.getSchoolAnalytics(id)
  }

  @Get('analytics/summary')
  async getAnalyticsSummary() {
    return this.ownerService.getAnalyticsSummary()
  }

  // Permission Codes Management
  @Post('schools/:id/permission-codes')
  @HttpCode(201)
  async generatePermissionCode(
    @Param('id') id: string,
    @Body() data: { name?: string; expiresIn?: number }, // expiresIn in days
  ) {
    return this.ownerService.generatePermissionCode(id, data)
  }

  @Get('schools/:id/permission-codes')
  async listPermissionCodes(@Param('id') id: string) {
    return this.ownerService.listPermissionCodes(id)
  }

  @Delete('permission-codes/:codeId')
  @HttpCode(204)
  async revokePermissionCode(@Param('codeId') codeId: string) {
    return this.ownerService.revokePermissionCode(codeId)
  }

  // Verify permission code (for school admins)
  @Post('verify-permission-code')
  async verifyPermissionCode(@Body() data: { code: string; email: string }) {
    return this.ownerService.verifyPermissionCode(data.code, data.email)
  }
}
