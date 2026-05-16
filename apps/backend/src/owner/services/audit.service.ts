import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'

interface LogOptions {
  userId: string
  schoolId?: string
  action: string // 'CREATE', 'READ', 'UPDATE', 'DELETE', 'PERMISSION_GRANT', 'PERMISSION_REVOKE', etc.
  resource: string // 'Student', 'Grade', 'Class', 'RolePermission', etc.
  resourceId?: string
  description?: string
  ipAddress?: string
  userAgent?: string
  oldValues?: any
  newValues?: any
}

/**
 * AuditService - Comprehensive audit logging for compliance
 */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Log an action for audit trail
   */
  async log(options: LogOptions) {
    const {
      userId,
      schoolId,
      action,
      resource,
      resourceId,
      description,
      ipAddress,
      userAgent,
      oldValues,
      newValues,
    } = options

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          schoolId,
          action,
          resource,
          resourceId,
          description,
          ipAddress,
          userAgent,
          oldValues,
          newValues,
          changesSummary: `${action} on ${resource}${resourceId ? ` (${resourceId})` : ''}`,
        },
      })
    } catch (error) {
      // Ensure audit failures don't break the main application
      console.error('Audit logging failed:', error)
    }
  }

  /**
   * Query audit logs with filters
   */
  async query(
    filters: {
      userId?: string
      schoolId?: string
      resource?: string
      action?: string
      resourceId?: string
      startDate?: Date
      endDate?: Date
      skip?: number
      take?: number
    } = {}
  ) {
    const { skip = 0, take = 50, startDate, endDate, ...rest } = filters

    // Build where clause with proper typing
    const where: Record<string, unknown> & {
      createdAt?: { gte?: Date; lte?: Date }
    } = { ...rest }

    // Build date filter
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return {
      data: logs.map(log => ({
        ...log,
        // oldValues and newValues are already JSON objects from Prisma
      })),
      total,
      skip,
      take,
    }
  }

  /**
   * Get activity summary for a date range
   */
  async getActivitySummary(startDate: Date, endDate: Date, schoolId?: string) {
    const where = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(schoolId && { schoolId }),
    }

    const [byAction, byResource, byUser] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: true,
      }),
      this.prisma.auditLog.groupBy({
        by: ['resource'],
        where,
        _count: true,
      }),
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where,
        _count: true,
        take: 10,
        orderBy: { _count: { id: 'desc' } },
      }),
    ])

    return {
      byAction,
      byResource,
      topUsers: byUser,
      period: { startDate, endDate },
    }
  }

  /**
   * Get user activity timeline
   */
  async getUserActivityTimeline(userId: string, days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const logs = await this.prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return logs.map(log => ({
      timestamp: log.createdAt,
      action: log.action,
      resource: log.resource,
      description: log.description,
      ip: log.ipAddress,
    }))
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    resource?: string,
    schoolId?: string
  ) {
    const where = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      ...(schoolId && { schoolId }),
      ...(resource && { resource }),
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Group by date
    const byDate = {}
    logs.forEach(log => {
      const date = log.createdAt.toISOString().split('T')[0]
      if (!byDate[date]) {
        byDate[date] = []
      }
      byDate[date].push({
        time: log.createdAt.toISOString(),
        user: log.user?.email,
        action: log.action,
        resource: log.resource,
        description: log.description,
      })
    })

    return {
      report: {
        period: { startDate, endDate },
        totalEvents: logs.length,
        resource,
        schoolId,
        eventsByDate: byDate,
      },
      generatedAt: new Date(),
    }
  }

  /**
   * Check for suspicious activities
   */
  async detectSuspiciousActivity(userId: string, hoursWindow: number = 1) {
    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hoursWindow)

    const logs = await this.prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: { gte: startTime },
      },
      orderBy: { createdAt: 'desc' },
    })

    const suspiciousPatterns = {
      bulkDeleteAttempts: logs.filter(l => l.action === 'DELETE').length > 5,
      failedLoginAttempts: logs.filter(l => l.action === 'FAILED_LOGIN').length > 3,
      permissionChanges: logs.filter(l => l.action === 'PERMISSION_GRANT' || l.action === 'PERMISSION_REVOKE').length > 2,
      dataExportAttempts: logs.filter(l => l.action === 'EXPORT').length > 1,
      multipleIPAddresses: new Set(logs.map(l => l.ipAddress)).size > 2,
    }

    const isSuspicious = Object.values(suspiciousPatterns).some(v => v === true)

    return {
      isSuspicious,
      patterns: suspiciousPatterns,
      recentActivity: logs.slice(0, 10),
    }
  }

  /**
   * Archive old audit logs (for data retention compliance)
   */
  async archiveOldLogs(daysToKeep: number = 365) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    })

    return {
      archived: result.count,
      before: cutoffDate,
    }
  }

  /**
   * Get data changes for a resource
   */
  async getResourceChangeHistory(resource: string, resourceId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        resource,
        resourceId,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return logs.map(log => ({
      timestamp: log.createdAt,
      user: log.user?.email,
      action: log.action,
      oldValues: log.oldValues,
      newValues: log.newValues,
      description: log.description,
    }))
  }

  /**
   * Export audit logs to CSV
   */
  async exportToCSV(filters: any) {
    const result = await this.query({ ...filters, take: 10000 })

    const headers = ['Timestamp', 'User', 'Action', 'Resource', 'ResourceId', 'Description', 'IP Address']
    const rows = result.data.map(log => [
      log.createdAt.toISOString(),
      log.user?.email || 'N/A',
      log.action,
      log.resource,
      log.resourceId || 'N/A',
      log.description || 'N/A',
      log.ipAddress || 'N/A',
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

    return {
      filename: `audit_logs_${new Date().toISOString().split('T')[0]}.csv`,
      content: csv,
      mimeType: 'text/csv',
    }
  }
}
