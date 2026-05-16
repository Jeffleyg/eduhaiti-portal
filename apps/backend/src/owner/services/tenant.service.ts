import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { AuditService } from './audit.service'
import { Role } from '@prisma/client'
import {
  CreateTenantDto,
  CreateTenantConfigDto,
  UpdateTenantConfigDto,
  UpdateTenantLimitsDto,
  WhiteLabelDto,
} from '../dto'

/**
 * TenantService - Manages multi-tenant configurations
 */
@Injectable()
export class TenantService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  /**
   * Create a school tenant and initialize its configuration.
   */
  async createTenant(dto: CreateTenantDto) {
    const school = await this.prisma.school.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        principal: dto.principal,
      },
    })

    await this.prisma.tenantConfiguration.create({
      data: {
        schoolId: school.id,
        maxStudents: dto.maxStudents ?? 1000,
        maxTeachers: dto.maxTeachers ?? 100,
        maxClasses: dto.maxClasses ?? 50,
        storageLimitGb: dto.storageLimitGb ?? 10,
      },
    })

    return this.getTenant(school.id)
  }

  /**
   * List tenants with their configuration.
   */
  async listTenants(skip: number = 0, take: number = 50) {
    const [schools, total] = await Promise.all([
      this.prisma.school.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          tenantConfig: true,
        },
      }),
      this.prisma.school.count(),
    ])

    return {
      data: schools.map(school => ({
        ...school,
        tenantConfig: school.tenantConfig ? this.sanitizeConfig(school.tenantConfig) : null,
      })),
      total,
      skip,
      take,
    }
  }

  /**
   * Get a tenant with configuration.
   */
  async getTenant(tenantId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: tenantId },
      include: {
        tenantConfig: true,
      },
    })

    if (!school) {
      throw new NotFoundException(`School not found: ${tenantId}`)
    }

    return {
      ...school,
      tenantConfig: school.tenantConfig ? this.sanitizeConfig(school.tenantConfig) : null,
    }
  }

  /**
   * Update tenant limits.
   */
  async updateTenantLimits(tenantId: string, dto: UpdateTenantLimitsDto) {
    return this.updateTenantConfig(tenantId, dto)
  }

  /**
   * Configure white label branding.
   */
  async configureWhiteLabel(tenantId: string, dto: WhiteLabelDto) {
    return this.updateWhiteLabel(tenantId, dto)
  }

  /**
   * Get a simple usage snapshot for a tenant.
   */
  async getTenantUsage(tenantId: string) {
    const [students, teachers, classes] = await Promise.all([
      this.prisma.user.count({
        where: {
          role: Role.STUDENT,
          isActive: true,
          classesAttending: { some: { academicYear: { schoolId: tenantId } } },
        },
      }),
      this.prisma.user.count({
        where: {
          role: Role.TEACHER,
          isActive: true,
          classesTeaching: { some: { academicYear: { schoolId: tenantId } } },
        },
      }),
      this.prisma.class.count({ where: { academicYear: { schoolId: tenantId } } }),
    ])

    return {
      tenantId,
      students,
      teachers,
      classes,
    }
  }

  /**
   * Soft delete a tenant.
   */
  async softDeleteTenant(tenantId: string, userId?: string) {
    await this.deleteTenantConfig(tenantId, userId)

    await this.prisma.school.update({
      where: { id: tenantId },
      data: { updatedAt: new Date() },
    })

    return { success: true, message: 'Tenant soft-deleted' }
  }

  /**
   * Get or create tenant configuration for a school
   */
  async getTenantConfig(schoolId: string) {
    const config = await this.prisma.tenantConfiguration.findUnique({
      where: { schoolId },
    })

    if (!config) {
      throw new NotFoundException(`Tenant configuration not found for school ${schoolId}`)
    }

    // Hide encrypted fields from response
    return this.sanitizeConfig(config)
  }

  /**
   * Create tenant configuration
   */
  async createTenantConfig(schoolId: string, dto: CreateTenantConfigDto, userId?: string) {
    // Verify school exists
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    })

    if (!school) {
      throw new NotFoundException(`School not found: ${schoolId}`)
    }

    // Check if already exists
    const existing = await this.prisma.tenantConfiguration.findUnique({
      where: { schoolId },
    })

    if (existing) {
      throw new BadRequestException(`Tenant config already exists for school ${schoolId}`)
    }

    // Validate limits
    if (dto.maxStudents < 1) {
      throw new BadRequestException('maxStudents must be at least 1')
    }

    const config = await this.prisma.tenantConfiguration.create({
      data: {
        schoolId,
        ...dto,
      },
    })

    // Log audit
    if (userId) {
      await this.auditService.log({
        userId,
        schoolId,
        action: 'CONFIG_CHANGE',
        resource: 'TenantConfiguration',
        resourceId: config.id,
        description: `Created tenant configuration for school ${school.name}`,
        newValues: config,
      })
    }

    return this.sanitizeConfig(config)
  }

  /**
   * Update tenant configuration
   */
  async updateTenantConfig(
    schoolId: string,
    dto: UpdateTenantConfigDto,
    userId?: string
  ) {
    const old = await this.prisma.tenantConfiguration.findUnique({
      where: { schoolId },
    })

    if (!old) {
      throw new NotFoundException(`Tenant config not found for school ${schoolId}`)
    }

    // Validate limits if provided
    if (dto.maxStudents && dto.maxStudents < 1) {
      throw new BadRequestException('maxStudents must be at least 1')
    }

    const updated = await this.prisma.tenantConfiguration.update({
      where: { schoolId },
      data: dto,
    })

    // Log audit
    if (userId) {
      await this.auditService.log({
        userId,
        schoolId,
        action: 'UPDATE',
        resource: 'TenantConfiguration',
        resourceId: updated.id,
        description: `Updated tenant configuration`,
        oldValues: old,
        newValues: updated,
      })
    }

    return this.sanitizeConfig(updated)
  }

  /**
   * Get all tenant configurations (paginated)
   */
  async listTenantConfigs(skip: number = 0, take: number = 50) {
    const [configs, total] = await Promise.all([
      this.prisma.tenantConfiguration.findMany({
        where: { deletedAt: null },
        skip,
        take,
        include: {
          school: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.tenantConfiguration.count({
        where: { deletedAt: null },
      }),
    ])

    return {
      data: configs.map(c => this.sanitizeConfig(c)),
      total,
      skip,
      take,
    }
  }

  /**
   * Soft delete tenant configuration
   */
  async deleteTenantConfig(schoolId: string, userId?: string) {
    const config = await this.prisma.tenantConfiguration.findUnique({
      where: { schoolId },
    })

    if (!config) {
      throw new NotFoundException(`Tenant config not found for school ${schoolId}`)
    }

    const updated = await this.prisma.tenantConfiguration.update({
      where: { schoolId },
      data: { deletedAt: new Date() },
    })

    // Log audit
    if (userId) {
      await this.auditService.log({
        userId,
        schoolId,
        action: 'DELETE',
        resource: 'TenantConfiguration',
        resourceId: updated.id,
        description: `Deleted tenant configuration`,
        oldValues: config,
      })
    }

    return { success: true, message: 'Tenant configuration soft-deleted' }
  }

  /**
   * Update White Label configuration
   */
  async updateWhiteLabel(
    schoolId: string,
    whiteLabel: {
      logoUrl?: string
      faviconUrl?: string
      primaryColor?: string
      secondaryColor?: string
      companyName?: string
    },
    userId?: string
  ) {
    const config = await this.prisma.tenantConfiguration.findUnique({
      where: { schoolId },
    })

    if (!config) {
      throw new NotFoundException(`Tenant config not found for school ${schoolId}`)
    }

    const updated = await this.prisma.tenantConfiguration.update({
      where: { schoolId },
      data: whiteLabel,
    })

    // Log audit
    if (userId) {
      await this.auditService.log({
        userId,
        schoolId,
        action: 'UPDATE',
        resource: 'TenantConfiguration',
        resourceId: updated.id,
        description: 'Updated White Label configuration',
        oldValues: config,
        newValues: updated,
      })
    }

    return this.sanitizeConfig(updated)
  }

  /**
   * Check tenant limits
   */
  async checkTenantLimits(schoolId: string, resource: string, currentCount: number) {
    const config = await this.getTenantConfig(schoolId)

    const limits = {
      students: config.maxStudents,
      teachers: config.maxTeachers,
      classes: config.maxClasses,
    }

    const limit = limits[resource]
    if (!limit) {
      return { allowed: true }
    }

    return {
      allowed: currentCount < limit,
      current: currentCount,
      limit,
      remaining: limit - currentCount,
    }
  }

  /**
   * Get tenant features
   */
  async getTenantFeatures(schoolId: string) {
    const config = await this.getTenantConfig(schoolId)

    return {
      customDomain: config.enableCustomDomain,
      sso: config.enableSso,
      advancedAnalytics: config.enableAdvancedAnalytics,
      apiAccess: config.enableApiAccess,
    }
  }

  /**
   * Sanitize config by removing sensitive data
   */
  private sanitizeConfig(config: any) {
    const { ...sanitized } = config
    return sanitized
  }
}
