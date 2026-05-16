import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { AuditService } from './audit.service'
import { CreateRolePermissionDto, UpdateRolePermissionDto } from '../dto'

/**
 * PermissionService - Manages dynamic RBAC (Role-Based Access Control)
 */
@Injectable()
export class PermissionService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService
  ) {}

  /**
   * Create or update role permissions for a school
   */
  async setRolePermission(
    schoolId: string,
    dto: CreateRolePermissionDto,
    userId?: string
  ) {
    // Validate input
    if (!dto.role || !dto.resource || !dto.permissions) {
      throw new BadRequestException('role, resource, and permissions are required')
    }

    // Validate permissions format
    const validPermissions = ['READ', 'WRITE', 'DELETE']
    const permissions = dto.permissions.split(',').map(p => p.trim().toUpperCase())
    
    for (const perm of permissions) {
      if (!validPermissions.includes(perm)) {
        throw new BadRequestException(
          `Invalid permission: ${perm}. Valid permissions: ${validPermissions.join(', ')}`
        )
      }
    }

    // Try to find existing
    const existing = await this.prisma.rolePermission.findUnique({
      where: {
        schoolId_role_resource: {
          schoolId,
          role: dto.role,
          resource: dto.resource,
        },
      },
    })

    let result

    if (existing) {
      // Update
      result = await this.prisma.rolePermission.update({
        where: { id: existing.id },
        data: {
          permissions: dto.permissions,
          metadata: dto.metadata,
        },
      })

      if (userId) {
        await this.auditService.log({
          userId,
          schoolId,
          action: 'PERMISSION_GRANT',
          resource: 'RolePermission',
          resourceId: result.id,
          description: `Updated permissions for role ${dto.role} on ${dto.resource}`,
          newValues: result,
        })
      }
    } else {
      // Create
      result = await this.prisma.rolePermission.create({
        data: {
          schoolId,
          role: dto.role,
          resource: dto.resource,
          permissions: dto.permissions,
          metadata: dto.metadata,
        },
      })

      if (userId) {
        await this.auditService.log({
          userId,
          schoolId,
          action: 'PERMISSION_GRANT',
          resource: 'RolePermission',
          resourceId: result.id,
          description: `Granted permissions for role ${dto.role} on ${dto.resource}`,
          newValues: result,
        })
      }
    }

    return result
  }

  /**
   * Get all permissions for a role
   */
  async getRolePermissions(schoolId: string, role: string) {
    return this.prisma.rolePermission.findMany({
      where: {
        schoolId,
        role,
        isActive: true,
      },
    })
  }

  /**
   * Check if user has permission to access a resource
   */
  async checkPermission(
    schoolId: string,
    userRole: string,
    resource: string,
    action: 'READ' | 'WRITE' | 'DELETE'
  ): Promise<boolean> {
    const permission = await this.prisma.rolePermission.findUnique({
      where: {
        schoolId_role_resource: {
          schoolId,
          role: userRole,
          resource,
        },
      },
    })

    if (!permission || !permission.isActive) {
      return false
    }

    return permission.permissions.includes(action)
  }

  /**
   * Check multiple permissions (all must pass)
   */
  async checkPermissions(
    schoolId: string,
    userRole: string,
    requirements: Array<{ resource: string; action: 'READ' | 'WRITE' | 'DELETE' }>
  ): Promise<{ allowed: boolean; denied: string[] }> {
    const denied: string[] = []

    for (const req of requirements) {
      const allowed = await this.checkPermission(schoolId, userRole, req.resource, req.action)
      if (!allowed) {
        denied.push(`${req.action}:${req.resource}`)
      }
    }

    return {
      allowed: denied.length === 0,
      denied,
    }
  }

  /**
   * Get all permissions for a school
   */
  async listRolePermissions(schoolId: string, skip: number = 0, take: number = 50) {
    const [permissions, total] = await Promise.all([
      this.prisma.rolePermission.findMany({
        where: { schoolId, isActive: true },
        skip,
        take,
        orderBy: [{ role: 'asc' }, { resource: 'asc' }],
      }),
      this.prisma.rolePermission.count({
        where: { schoolId, isActive: true },
      }),
    ])

    return {
      data: permissions,
      total,
      skip,
      take,
    }
  }

  /**
   * Revoke permission
   */
  async revokePermission(
    schoolId: string,
    role: string,
    resource: string,
    userId?: string
  ) {
    const permission = await this.prisma.rolePermission.findUnique({
      where: {
        schoolId_role_resource: {
          schoolId,
          role,
          resource,
        },
      },
    })

    if (!permission) {
      throw new NotFoundException(`Permission not found for ${role} on ${resource}`)
    }

    const updated = await this.prisma.rolePermission.update({
      where: { id: permission.id },
      data: { isActive: false },
    })

    if (userId) {
      await this.auditService.log({
        userId,
        schoolId,
        action: 'PERMISSION_REVOKE',
        resource: 'RolePermission',
        resourceId: updated.id,
        description: `Revoked permissions for role ${role} on ${resource}`,
        oldValues: permission,
      })
    }

    return { success: true, message: 'Permission revoked' }
  }

  /**
   * Get matrix of all permissions for a school
   */
  async getPermissionMatrix(schoolId: string) {
    const permissions = await this.prisma.rolePermission.findMany({
      where: { schoolId, isActive: true },
    })

    // Group by role and resource
    const matrix = {}

    for (const perm of permissions) {
      if (!matrix[perm.role]) {
        matrix[perm.role] = {}
      }
      matrix[perm.role][perm.resource] = perm.permissions.split(',').map(p => p.trim())
    }

    return matrix
  }

  /**
   * Create default permission set for a new school
   */
  async createDefaultPermissions(schoolId: string) {
    const defaultRoles = {
      ADMIN: {
        students: 'READ,WRITE,DELETE',
        grades: 'READ,WRITE',
        attendance: 'READ,WRITE',
        classes: 'READ,WRITE',
        users: 'READ,WRITE',
        reports: 'READ',
        finance: 'READ,WRITE',
        settings: 'READ,WRITE',
      },
      TEACHER: {
        students: 'READ',
        grades: 'READ,WRITE',
        attendance: 'READ,WRITE',
        classes: 'READ',
        assignments: 'READ,WRITE',
        resources: 'READ,WRITE',
        announcements: 'READ,WRITE',
        messages: 'READ,WRITE',
      },
      SECRETARY: {
        students: 'READ,WRITE',
        users: 'READ,WRITE',
        attendance: 'READ',
        classes: 'READ',
        reports: 'READ',
        documents: 'READ,WRITE',
      },
      STUDENT: {
        grades: 'READ',
        attendance: 'READ',
        assignments: 'READ,WRITE',
        resources: 'READ',
        announcements: 'READ',
        messages: 'READ,WRITE',
      },
    }

    const created: Awaited<ReturnType<typeof this.prisma.rolePermission.create>>[] = []

    for (const [role, resources] of Object.entries(defaultRoles)) {
      for (const [resource, permissions] of Object.entries(resources)) {
        const perm = await this.prisma.rolePermission.create({
          data: {
            schoolId,
            role,
            resource,
            permissions,
          },
        })
        created.push(perm)
      }
    }

    return created
  }
}
