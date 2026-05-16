import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as crypto from 'crypto'
import { EmailService } from '../common/services/email.service'

interface AnalyticsSummary {
  totalSchools: number
  totalLogins: number
  totalUsers: number
  totalGrades: number
  totalAttendance: number
  totalMessages: number
  schoolsDetails: Array<{
    id: string
    name: string
    logins: number
    users: number
    students: number
    teachers: number
    classes: number
    lastActivity?: Date
  }>
}

@Injectable()
export class OwnerService {
  constructor(private prisma: PrismaService, private readonly emailService: EmailService) {}

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

    // Only pass allowed scalar fields to Prisma to avoid validation errors
    const updateData: {
      name?: string
      email?: string
      phone?: string
      address?: string
      city?: string
      country?: string
      principal?: string
    } = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.email !== undefined) updateData.email = data.email
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.country !== undefined) updateData.country = data.country
    if (data.principal !== undefined) updateData.principal = data.principal

    return this.prisma.school.update({
      where: { id: schoolId },
      data: updateData,
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

  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const schools = await this.prisma.school.findMany({
      include: { usageAnalytics: true },
    })

    const summary: AnalyticsSummary = {
      totalSchools: schools.length,
      totalLogins: 0,
      totalUsers: 0,
      totalGrades: 0,
      totalAttendance: 0,
      totalMessages: 0,
      schoolsDetails: schools.map((school) => ({
        id: school.id,
        name: school.name,
        logins: school.usageAnalytics?.totalLogins || 0,
        users: school.usageAnalytics?.totalUsers || 0,
        students: school.usageAnalytics?.studentCount || 0,
        teachers: school.usageAnalytics?.teacherCount || 0,
        classes: school.usageAnalytics?.classCount || 0,
        lastActivity: school.usageAnalytics?.lastActivityAt || undefined,
      })),
    }

    // Calculate totals
    schools.forEach((school: any) => {
      if (school.usageAnalytics) {
        summary.totalLogins += school.usageAnalytics.totalLogins
        summary.totalUsers += school.usageAnalytics.totalUsers
        summary.totalGrades += school.usageAnalytics.gradeCreations
        summary.totalAttendance += school.usageAnalytics.attendanceRecords
        summary.totalMessages += school.usageAnalytics.messagesSent
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

  async verifyPermissionCode(code: string, email: string, name?: string) {
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

    // Check if user already exists
    const normalizedEmail = email.trim().toLowerCase()
    let user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    // If user doesn't exist, create as ADMIN
    if (!user) {
      const tempPassword = this.generateTempPassword()
      const passwordHash = await this.hashPassword(tempPassword)
      
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name || `Admin - ${permissionCode.school.name}`,
          firstName: name?.split(' ')[0] || 'Admin',
          lastName: name?.split(' ').slice(1).join(' ') || permissionCode.school.name,
          role: 'ADMIN',
          isActive: true,
          schoolId: permissionCode.school.id,
          passwordHash,
          mustChangePassword: true,
          tempPasswordExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })
      // Send temporary password by email (if SMTP configured)
      try {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await this.emailService.sendTempPasswordEmail(normalizedEmail, tempPassword, expiresAt)
      } catch (e) {
        // Don't fail the whole flow if email sending fails; just log server-side
        // (Nest logger could be used, but keep silent here)
      }
    }

    // Mark permission code as used
    await this.prisma.schoolPermissionCode.update({
      where: { id: permissionCode.id },
      data: {
        usedBy: email,
        usedAt: new Date(),
      },
    })

    return {
      success: true,
      schoolId: permissionCode.school.id,
      schoolName: permissionCode.school.name,
      permissionName: permissionCode.name,
      userId: user.id,
      email: user.email,
      name: user.name,
      message: `Welcome to ${permissionCode.school.name}! Please log in.`,
    }
  }

  private generateTempPassword(): string {
    const length = 12
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const symbols = '!@#$%^&*'
    const all = uppercase + lowercase + numbers + symbols
    
    let password = ''
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]
    
    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)]
    }
    
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  private async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs')
    return bcrypt.default.hash(password, 10)
  }
}
