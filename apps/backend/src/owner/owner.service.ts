import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as crypto from 'crypto'

@Injectable()
export class OwnerService {
  constructor(private prisma: PrismaService) {}

  // Schools Management
  async listAllSchools() {
    return this.prisma.school.findMany({
      include: {
        usageAnalytics: true,
        permissionCodes: {
          where: { isActive: true },
          select: { id: true, name: true, code: true, expiresAt: true, usedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getSchoolDetails(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        usageAnalytics: true,
        permissionCodes: { where: { isActive: true } },
        academicYears: { select: { year: true, isActive: true } },
      },
    })

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found`)
    }

    return school
  }

  async createSchool(data: {
    name: string
    email: string
    phone?: string
    address?: string
    city?: string
    country?: string
    principal?: string
  }) {
    // Check if email already exists
    const existing = await this.prisma.school.findFirst({
      where: { OR: [{ email: data.email }, { name: data.name }] },
    })

    if (existing) {
      throw new BadRequestException('School with this email or name already exists')
    }

    const school = await this.prisma.school.create({
      data: {
        ...data,
        country: data.country || 'Haiti',
      },
    })

    // Initialize analytics
    await this.prisma.schoolUsageAnalytic.create({
      data: { schoolId: school.id },
    })

    return school
  }

  async updateSchool(
    schoolId: string,
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
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    })

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found`)
    }

    // Check if new email already exists
    if (data.email && data.email !== school.email) {
      const existing = await this.prisma.school.findUnique({
        where: { email: data.email },
      })
      if (existing) {
        throw new BadRequestException('Email already in use by another school')
      }
    }

    return this.prisma.school.update({
      where: { id: schoolId },
      data,
    })
  }

  async deleteSchool(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    })

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found`)
    }

    // Delete cascading relations are handled by database
    await this.prisma.school.delete({
      where: { id: schoolId },
    })
  }

  // School Features Management
  async getSchoolFeatures(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        enableFamilyAccess: true,
        enablePayment: true,
        enableGamification: true,
        enableForums: true,
        enableLessons: true,
        enableInventory: true,
        enableFinance: true,
        enableSync: true,
      },
    })

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found`)
    }

    return school
  }

  async updateSchoolFeatures(
    schoolId: string,
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
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    })

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found`)
    }

    return this.prisma.school.update({
      where: { id: schoolId },
      data: features,
    })
  }

  // School Usage Analytics
  async getSchoolAnalytics(schoolId: string) {
    const analytics = await this.prisma.schoolUsageAnalytic.findUnique({
      where: { schoolId },
    })

    if (!analytics) {
      throw new NotFoundException(`Analytics for school ${schoolId} not found`)
    }

    return analytics
  }

  async getAnalyticsSummary() {
    const schools = await this.prisma.school.findMany({
      include: { usageAnalytics: true },
    })

    const summary = {
      totalSchools: schools.length,
      totalLogins: 0,
      totalUsers: 0,
      totalGrades: 0,
      totalAttendance: 0,
      totalMessages: 0,
      schoolsDetails: schools.map((school) => {
        const analytics = Array.isArray(school.usageAnalytics) ? school.usageAnalytics[0] : school.usageAnalytics
        return {
          id: school.id,
          name: school.name,
          logins: analytics?.totalLogins || 0,
          users: analytics?.totalUsers || 0,
          students: analytics?.studentCount || 0,
          teachers: analytics?.teacherCount || 0,
          classes: analytics?.classCount || 0,
          lastActivity: analytics?.lastActivityAt,
        }
      }),
    }

    // Calculate totals
    schools.forEach((school) => {
      const analytics = Array.isArray(school.usageAnalytics) ? school.usageAnalytics[0] : school.usageAnalytics
      if (analytics) {
        summary.totalLogins += analytics.totalLogins
        summary.totalUsers += analytics.totalUsers
        summary.totalGrades += analytics.gradeCreations
        summary.totalAttendance += analytics.attendanceRecords
        summary.totalMessages += analytics.messagesSent
      }
    })

    return summary
  }

  // Track usage metrics
  async trackUsage(schoolId: string, metric: string, increment: number = 1) {
    try {
      await this.prisma.schoolUsageAnalytic.update({
        where: { schoolId },
        data: {
          [metric]: { increment },
          lastActivityAt: new Date(),
        },
      })
    } catch (error) {
      // If analytics record doesn't exist, create it
      await this.prisma.schoolUsageAnalytic.create({
        data: { schoolId, [metric]: increment },
      })
    }
  }

  // Permission Codes Management
  private generateCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase()
  }

  async generatePermissionCode(
    schoolId: string,
    data: { name?: string; expiresIn?: number }, // expiresIn in days
  ) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    })

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found`)
    }

    const expiresAt = data.expiresIn ? new Date(Date.now() + data.expiresIn * 24 * 60 * 60 * 1000) : null

    const permissionCode = await this.prisma.schoolPermissionCode.create({
      data: {
        schoolId,
        code: this.generateCode(),
        name: data.name,
        expiresAt,
      },
    })

    return {
      id: permissionCode.id,
      code: permissionCode.code,
      name: permissionCode.name,
      expiresAt: permissionCode.expiresAt,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/redeem-access?code=${permissionCode.code}`,
    }
  }

  async listPermissionCodes(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    })

    if (!school) {
      throw new NotFoundException(`School ${schoolId} not found`)
    }

    return this.prisma.schoolPermissionCode.findMany({
      where: { schoolId, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        expiresAt: true,
        isActive: true,
        usedBy: true,
        usedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async revokePermissionCode(codeId: string) {
    const code = await this.prisma.schoolPermissionCode.findUnique({
      where: { id: codeId },
    })

    if (!code) {
      throw new NotFoundException(`Permission code ${codeId} not found`)
    }

    await this.prisma.schoolPermissionCode.update({
      where: { id: codeId },
      data: { isActive: false },
    })
  }

  async verifyPermissionCode(code: string, email: string) {
    const permissionCode = await this.prisma.schoolPermissionCode.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { school: true },
    })

    if (!permissionCode) {
      throw new BadRequestException('Invalid or expired permission code')
    }

    // Mark as used
    await this.prisma.schoolPermissionCode.update({
      where: { id: permissionCode.id },
      data: {
        usedBy: email,
        usedAt: new Date(),
      },
    })

    return {
      schoolId: permissionCode.school.id,
      schoolName: permissionCode.school.name,
      permissionName: permissionCode.name,
      message: `Access granted to ${permissionCode.school.name}`,
    }
  }
}
