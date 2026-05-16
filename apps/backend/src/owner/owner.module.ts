import { Module } from '@nestjs/common'
import { OwnerController } from './owner.controller'
import { OwnerAuthController } from './owner-auth.controller'
import { OwnerService } from './owner.service'
import {
  TenantService,
  PermissionService,
  GlobalSettingsService,
  AuditService,
  MetricsService,
} from './services'
import { SuperAdminGuard } from './guards/super-admin.guard'
import { EmailService } from '../common/services/email.service'

/**
 * OwnerModule - Owner/Super Admin control panel
 * Manages:
 * - Tenant lifecycle (schools/institutions)
 * - Role-Based Access Control (RBAC)
 * - Global system settings with encryption
 * - Comprehensive audit logging
 * - Business analytics and dashboards
 */
@Module({
  controllers: [OwnerController, OwnerAuthController],
  providers: [
    OwnerService,
    EmailService,
    TenantService,
    PermissionService,
    GlobalSettingsService,
    AuditService,
    MetricsService,
    SuperAdminGuard,
  ],
  exports: [
    OwnerService,
    TenantService,
    PermissionService,
    GlobalSettingsService,
    AuditService,
    MetricsService,
  ],
})
export class OwnerModule {}
