import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { SuperAdminGuard } from './guards/super-admin.guard'
import {
  TenantService,
  PermissionService,
  GlobalSettingsService,
  AuditService,
  MetricsService,
} from './services'
import { OwnerService } from './owner.service'
import {
  CreateTenantDto,
  UpdateTenantLimitsDto,
  WhiteLabelDto,
  CreateRolePermissionDto,
  GlobalSettingsDto,
  AuditLogQueryDto,
} from './dto'

/**
 * OwnerController - Super Admin control panel for EduHaiti
 * Manages tenants, RBAC, global settings, audit logs, and business metrics
 */
@Controller('owner')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class OwnerController {
  constructor(
    private ownerService: OwnerService,
    private tenantService: TenantService,
    private permissionService: PermissionService,
    private globalSettingsService: GlobalSettingsService,
    private auditService: AuditService,
    private metricsService: MetricsService
  ) {}

  // ============================================
  // TENANT MANAGEMENT ENDPOINTS
  // ============================================

  /**
   * Create a new tenant/school
   * POST /owner/tenants
   */
  @Post('tenants')
  async createTenant(@Body() dto: CreateTenantDto, @Request() req: any) {
    const result = await this.tenantService.createTenant(dto)

    // Log audit
    await this.auditService.log({
      userId: req.user.id,
      action: 'TENANT_CREATED',
      resource: 'Tenant',
      resourceId: result.id,
      description: `Created new tenant: ${dto.name}`,
      newValues: result,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    })

    return {
      success: true,
      tenant: result,
      message: 'Tenant created successfully',
    }
  }

  /**
   * List all tenants with pagination
   * GET /owner/tenants?skip=0&take=50
   */
  @Get('tenants')
  async listTenants(@Query('skip') skip: number = 0, @Query('take') take: number = 50) {
    return this.tenantService.listTenants(skip, take)
  }

  /**
   * Get tenant details
   * GET /owner/tenants/:id
   */
  @Get('tenants/:id')
  async getTenant(@Param('id') tenantId: string) {
    return this.tenantService.getTenant(tenantId)
  }

  /**
   * Update tenant limits
   * PUT /owner/tenants/:id/limits
   */
  @Put('tenants/:id/limits')
  async updateTenantLimits(
    @Param('id') tenantId: string,
    @Body() dto: UpdateTenantLimitsDto,
    @Request() req: any
  ) {
    const result = await this.tenantService.updateTenantLimits(tenantId, dto)

    await this.auditService.log({
      userId: req.user.id,
      action: 'TENANT_LIMITS_UPDATED',
      resource: 'Tenant',
      resourceId: tenantId,
      description: `Updated limits for tenant ${tenantId}`,
      newValues: dto,
      ipAddress: req.ip,
    })

    return result
  }

  /**
   * Configure white label branding
   * POST /owner/tenants/:id/white-label
   */
  @Post('tenants/:id/white-label')
  async configureWhiteLabel(
    @Param('id') tenantId: string,
    @Body() dto: WhiteLabelDto,
    @Request() req: any
  ) {
    const result = await this.tenantService.configureWhiteLabel(tenantId, dto)

    await this.auditService.log({
      userId: req.user.id,
      action: 'WHITE_LABEL_UPDATED',
      resource: 'Tenant',
      resourceId: tenantId,
      description: `Updated white label for tenant ${tenantId}`,
      newValues: dto,
      ipAddress: req.ip,
    })

    return result
  }

  /**
   * Get tenant usage metrics
   * GET /owner/tenants/:id/usage
   */
  @Get('tenants/:id/usage')
  async getTenantUsage(@Param('id') tenantId: string) {
    return this.tenantService.getTenantUsage(tenantId)
  }

  /**
   * Soft delete a tenant
   * DELETE /owner/tenants/:id
   */
  @Delete('tenants/:id')
  @HttpCode(HttpStatus.OK)
  async deleteTenant(@Param('id') tenantId: string, @Request() req: any) {
    const result = await this.tenantService.softDeleteTenant(tenantId)

    await this.auditService.log({
      userId: req.user.id,
      action: 'TENANT_DELETED',
      resource: 'Tenant',
      resourceId: tenantId,
      description: `Soft deleted tenant ${tenantId}`,
      ipAddress: req.ip,
    })

    return result
  }

  // ============================================
  // RBAC (PERMISSIONS) ENDPOINTS
  // ============================================

  /**
   * Assign or update role permission
   * POST /owner/rbac/permissions
   */
  @Post('rbac/permissions')
  async setRolePermission(@Body() dto: CreateRolePermissionDto, @Request() req: any) {
    const result = await this.permissionService.setRolePermission(
      req.user.schoolId || 'global',
      dto,
      req.user.id
    )

    return {
      success: true,
      permission: result,
      message: 'Permission granted successfully',
    }
  }

  /**
   * Get all permissions for a role
   * GET /owner/rbac/roles/:role
   */
  @Get('rbac/roles/:role')
  async getRolePermissions(@Param('role') role: string, @Request() req: any) {
    const permissions = await this.permissionService.getRolePermissions(
      req.user.schoolId || 'global',
      role
    )

    return {
      role,
      permissions,
      count: permissions.length,
    }
  }

  /**
   * List all permissions with pagination
   * GET /owner/rbac/permissions?skip=0&take=50
   */
  @Get('rbac/permissions')
  async listPermissions(@Query('skip') skip: number = 0, @Query('take') take: number = 50, @Request() req: any) {
    return this.permissionService.listRolePermissions(req.user.schoolId || 'global', skip, take)
  }

  /**
   * Get permission matrix
   * GET /owner/rbac/matrix
   */
  @Get('rbac/matrix')
  async getPermissionMatrix(@Request() req: any) {
    const matrix = await this.permissionService.getPermissionMatrix(
      req.user.schoolId || 'global'
    )

    return {
      matrix,
      roles: Object.keys(matrix),
    }
  }

  /**
   * Check user permission
   * POST /owner/rbac/check
   */
  @Post('rbac/check')
  async checkPermission(
    @Body() body: { resource: string; action: 'READ' | 'WRITE' | 'DELETE' },
    @Request() req: any
  ) {
    const allowed = await this.permissionService.checkPermission(
      req.user.schoolId || 'global',
      req.user.role,
      body.resource,
      body.action
    )

    return {
      allowed,
      user: {
        id: req.user.id,
        role: req.user.role,
      },
      resource: body.resource,
      action: body.action,
    }
  }

  /**
   * Revoke permission
   * DELETE /owner/rbac/permissions/:role/:resource
   */
  @Delete('rbac/permissions/:role/:resource')
  @HttpCode(HttpStatus.OK)
  async revokePermission(
    @Param('role') role: string,
    @Param('resource') resource: string,
    @Request() req: any
  ) {
    return this.permissionService.revokePermission(
      req.user.schoolId || 'global',
      role,
      resource,
      req.user.id
    )
  }

  /**
   * Initialize default permissions for a school
   * POST /owner/rbac/init-defaults
   */
  @Post('rbac/init-defaults')
  async initializeDefaultPermissions(@Request() req: any) {
    const permissions = await this.permissionService.createDefaultPermissions(
      req.user.schoolId || 'global'
    )

    await this.auditService.log({
      userId: req.user.id,
      schoolId: req.user.schoolId,
      action: 'PERMISSIONS_INITIALIZED',
      resource: 'RolePermission',
      description: 'Initialized default permissions',
      newValues: { count: permissions.length },
      ipAddress: req.ip,
    })

    return {
      success: true,
      created: permissions.length,
      permissions,
    }
  }

  // ============================================
  // GLOBAL SETTINGS ENDPOINTS
  // ============================================

  /**
   * Set a global setting
   * POST /owner/settings
   */
  @Post('settings')
  async setSetting(@Body() dto: GlobalSettingsDto, @Request() req: any) {
    await this.globalSettingsService.setSetting(
      dto.settingKey,
      dto.settingValue,
      dto.isEncrypted || false,
      req.user.id,
      dto.description
    )

    return {
      success: true,
      message: 'Setting saved successfully',
      key: dto.settingKey,
    }
  }

  /**
   * Get a specific setting
   * GET /owner/settings/:key
   */
  @Get('settings/:key')
  async getSetting(@Param('key') key: string) {
    const setting = await this.globalSettingsService.getSetting(key)

    if (!setting) {
      throw new BadRequestException(`Setting not found: ${key}`)
    }

    return setting
  }

  /**
   * List all public settings
   * GET /owner/settings?skip=0&take=50
   */
  @Get('settings')
  async listSettings(@Query('skip') skip: number = 0, @Query('take') take: number = 50) {
    return this.globalSettingsService.listSettings(skip, take)
  }

  /**
   * Get system configuration (public settings only)
   * GET /owner/system-config
   */
  @Get('system-config')
  async getSystemConfig() {
    return this.globalSettingsService.getSystemConfig()
  }

  /**
   * Configure payment gateway
   * POST /owner/settings/gateway
   */
  @Post('settings/gateway')
  async setPaymentGateway(
    @Body() body: { provider: 'STRIPE' | 'ASAAS' | 'EFI' | 'MONCASH'; apiKey: string; apiSecret?: string },
    @Request() req: any
  ) {
    // Validate gateway config
    await this.globalSettingsService.validateGatewayConfig(body.provider, body.apiKey)

    const result = await this.globalSettingsService.setPaymentGatewayConfig(
      body.provider,
      body.apiKey,
      body.apiSecret,
      req.user.id
    )

    return result
  }

  /**
   * Get payment gateway config
   * GET /owner/settings/gateway/:provider
   */
  @Get('settings/gateway/:provider')
  async getPaymentGateway(
    @Param('provider') provider: 'STRIPE' | 'ASAAS' | 'EFI' | 'MONCASH'
  ) {
    return this.globalSettingsService.getPaymentGatewayConfig(provider)
  }

  /**
   * Initialize default settings
   * POST /owner/settings/init-defaults
   */
  @Post('settings/init-defaults')
  async initializeDefaultSettings(@Request() req: any) {
    const result = await this.globalSettingsService.initializeDefaults()

    await this.auditService.log({
      userId: req.user.id,
      action: 'SETTINGS_INITIALIZED',
      resource: 'GlobalSettings',
      description: 'Initialized default system settings',
      newValues: { count: result.created },
      ipAddress: req.ip,
    })

    return result
  }

  // ============================================
  // AUDIT LOG ENDPOINTS
  // ============================================

  /**
   * Query audit logs
   * GET /owner/audit-logs?userId=&resource=&action=&skip=0&take=50
   */
  @Get('audit-logs')
  async queryAuditLogs(
    @Query('userId') userId?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('skip') skip: number = 0,
    @Query('take') take: number = 50
  ) {
    return this.auditService.query({
      userId,
      resource,
      action,
      skip,
      take,
    })
  }

  /**
   * Get user activity timeline
   * GET /owner/audit-logs/user/:userId/timeline
   */
  @Get('audit-logs/user/:userId/timeline')
  async getUserActivityTimeline(@Param('userId') userId: string, @Query('days') days: number = 30) {
    return this.auditService.getUserActivityTimeline(userId, days)
  }

  /**
   * Get activity summary for date range
   * GET /owner/audit-logs/summary?startDate=2025-01-01&endDate=2025-01-31
   */
  @Get('audit-logs/summary')
  async getActivitySummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required')
    }

    return this.auditService.getActivitySummary(
      new Date(startDate),
      new Date(endDate)
    )
  }

  /**
   * Generate compliance report
   * GET /owner/audit-logs/compliance-report?startDate=&endDate=&resource=
   */
  @Get('audit-logs/compliance-report')
  async generateComplianceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('resource') resource?: string
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required')
    }

    return this.auditService.generateComplianceReport(
      new Date(startDate),
      new Date(endDate),
      resource
    )
  }

  /**
   * Export audit logs as CSV
   * GET /owner/audit-logs/export/csv
   */
  @Get('audit-logs/export/csv')
  async exportAuditLogsCSV(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('resource') resource?: string
  ) {
    const filters: Record<string, unknown> = {}
    if (startDate && endDate) {
      filters.startDate = new Date(startDate)
      filters.endDate = new Date(endDate)
    }
    if (resource) filters.resource = resource

    return this.auditService.exportToCSV(filters)
  }

  /**
   * Detect suspicious activity
   * POST /owner/audit-logs/suspicious-check/:userId
   */
  @Post('audit-logs/suspicious-check/:userId')
  async detectSuspiciousActivity(
    @Param('userId') userId: string,
    @Query('hoursWindow') hoursWindow: number = 1
  ) {
    return this.auditService.detectSuspiciousActivity(userId, hoursWindow)
  }

  // ============================================
  // METRICS & DASHBOARD ENDPOINTS
  // ============================================

  /**
   * Get executive dashboard
   * GET /owner/metrics/dashboard
   */
  @Get('metrics/dashboard')
  async getExecutiveDashboard() {
    return this.metricsService.generateExecutiveDashboard()
  }

  /**
   * Get total active students
   * GET /owner/metrics/students
   */
  @Get('metrics/students')
  async getTotalStudents() {
    return this.metricsService.getTotalActiveStudents()
  }

  /**
   * Get total active teachers
   * GET /owner/metrics/teachers
   */
  @Get('metrics/teachers')
  async getTotalTeachers() {
    return this.metricsService.getTotalActiveTeachers()
  }

  /**
   * Get enrollment growth trend
   * GET /owner/metrics/enrollment-growth?months=12
   */
  @Get('metrics/enrollment-growth')
  async getEnrollmentGrowth(@Query('months') months: number = 12) {
    return this.metricsService.getEnrollmentGrowth(undefined, months)
  }

  /**
   * Get default rate
   * GET /owner/metrics/default-rate?days=30
   */
  @Get('metrics/default-rate')
  async getDefaultRate(@Query('days') days: number = 30) {
    return this.metricsService.calculateDefaultRate(undefined, days)
  }

  /**
   * Get attendance statistics
   * GET /owner/metrics/attendance?days=30
   */
  @Get('metrics/attendance')
  async getAttendanceStats(@Query('days') days: number = 30) {
    return this.metricsService.getAttendanceStatistics(undefined, days)
  }

  /**
   * Get grade distribution
   * GET /owner/metrics/grades
   */
  @Get('metrics/grades')
  async getGradeDistribution() {
    return this.metricsService.getGradeDistribution()
  }

  /**
   * Get enrollment by class
   * GET /owner/metrics/enrollment-by-class
   */
  @Get('metrics/enrollment-by-class')
  async getEnrollmentByClass() {
    return this.metricsService.getEnrollmentByClass()
  }

  /**
   * Get school performance metrics
   * GET /owner/metrics/school-performance/:schoolId
   */
  @Get('metrics/school-performance/:schoolId')
  async getSchoolPerformance(@Param('schoolId') schoolId: string) {
    return this.metricsService.getSchoolPerformanceMetrics(schoolId)
  }

  /**
   * Get resource utilization
   * GET /owner/metrics/resource-utilization/:schoolId
   */
  @Get('metrics/resource-utilization/:schoolId')
  async getResourceUtilization(@Param('schoolId') schoolId: string) {
    return this.metricsService.getResourceUtilization(schoolId)
  }

  // ============================================
  // ANALYTICS ENDPOINTS
  // ============================================

  /**
   * Get analytics summary
   * GET /owner/analytics/summary
   */
  @Get('analytics/summary')
  async getAnalyticsSummary(): Promise<any> {
    return this.ownerService.getAnalyticsSummary()
  }

  // ============================================
  // SCHOOLS MANAGEMENT ENDPOINTS
  // ============================================

  /**
   * Create a new school
   * POST /owner/schools
   */
  @Post('schools')
  async createSchool(
    @Body() data: {
      name: string
      email: string
      phone?: string
      address?: string
      city?: string
      country?: string
      principal?: string
    },
    @Request() req: any
  ) {
    const result = await this.ownerService.createSchool(data)

    // Log audit
    await this.auditService.log({
      userId: req.user?.id,
      action: 'CREATE',
      resource: 'School',
      resourceId: result.id,
      description: `Created new school: ${data.name}`,
      newValues: result,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    })

    return {
      success: true,
      school: result,
      message: 'School created successfully',
    }
  }

  /**
   * List all schools
   * GET /owner/schools
   */
  @Get('schools')
  async listSchools() {
    return this.ownerService.listAllSchools()
  }

  /**
   * Get school features
   * GET /owner/schools/:id/features
   */
  @Get('schools/:id/features')
  async getSchoolFeatures(@Param('id') schoolId: string) {
    return this.ownerService.getSchoolFeatures(schoolId)
  }

  /**
   * Update school features
   * PATCH /owner/schools/:id/features
   */
  @Patch('schools/:id/features')
  async updateSchoolFeatures(
    @Param('id') schoolId: string,
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
    }
  ) {
    return this.ownerService.updateSchoolFeatures(schoolId, features)
  }

  /**
   * List school permission codes
   * GET /owner/schools/:id/permission-codes
   */
  @Get('schools/:id/permission-codes')
  async listPermissionCodes(@Param('id') schoolId: string) {
    return this.ownerService.listPermissionCodes(schoolId)
  }

  /**
   * Generate a school permission code
   * POST /owner/schools/:id/permission-codes
   */
  @Post('schools/:id/permission-codes')
  async generatePermissionCode(
    @Param('id') schoolId: string,
    @Body() data: { name?: string; expiresIn?: number }
  ) {
    return this.ownerService.generatePermissionCode(schoolId, data)
  }

  /**
   * Revoke a permission code
   * DELETE /owner/permission-codes/:codeId
   */
  @Delete('permission-codes/:codeId')
  @HttpCode(HttpStatus.OK)
  async revokePermissionCode(@Param('codeId') codeId: string) {
    return this.ownerService.revokePermissionCode(codeId)
  }

  /**
   * Delete a school
   * DELETE /owner/schools/:id
   */
  @Delete('schools/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSchool(@Param('id') schoolId: string, @Request() req: any) {
    // Log the delete attempt before removing the school to avoid foreign key issues
    await this.auditService.log({
      userId: req.user?.id,
      schoolId,
      action: 'DELETE',
      resource: 'School',
      resourceId: schoolId,
      description: `Requested deletion of school ${schoolId}`,
      ipAddress: req.ip,
    })

    await this.ownerService.deleteSchool(schoolId)

    return {
      success: true,
      schoolId,
      message: 'School deleted successfully',
    }
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  /**
   * Health check for Owner API
   * GET /owner/health
   */
  @Get('health')
  async health() {
    return {
      status: 'ok',
      service: 'Owner Control Panel',
      timestamp: new Date(),
    }
  }
}
