import { Type } from 'class-transformer'
import { IsString, IsOptional, IsNumber, IsBoolean, IsEmail, ValidateNested, IsHexColor, IsDateString } from 'class-validator'

// ========== TENANT CONFIGURATION DTOs ==========

export class CreateTenantConfigDto {
  @IsNumber()
  maxStudents: number = 1000

  @IsNumber()
  maxTeachers: number = 100

  @IsNumber()
  maxClasses: number = 50

  @IsNumber()
  storageLimitGb: number = 10

  @IsNumber()
  maxConcurrentUsers: number = 500

  @IsOptional()
  @IsString()
  logoUrl?: string

  @IsOptional()
  @IsString()
  faviconUrl?: string

  @IsHexColor()
  primaryColor: string = '#0F2B5E'

  @IsHexColor()
  secondaryColor: string = '#E63946'

  @IsOptional()
  @IsString()
  companyName?: string

  @IsOptional()
  @IsEmail()
  supportEmail?: string

  @IsOptional()
  @IsString()
  supportPhone?: string

  @IsBoolean()
  enableCustomDomain: boolean = false

  @IsBoolean()
  enableSso: boolean = false

  @IsBoolean()
  enableAdvancedAnalytics: boolean = false

  @IsBoolean()
  enableApiAccess: boolean = false

  @IsString()
  subscriptionTier: string = 'basic'

  @IsOptional()
  @IsEmail()
  billingEmail?: string

  @IsString()
  billingCycle: string = 'monthly'

  @IsOptional()
  @IsDateString()
  nextBillingDate?: string
}

export class CreateTenantDto {
  @IsString()
  name: string

  @IsEmail()
  email: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  country?: string

  @IsOptional()
  @IsString()
  principal?: string

  @IsOptional()
  @IsNumber()
  maxStudents?: number

  @IsOptional()
  @IsNumber()
  maxTeachers?: number

  @IsOptional()
  @IsNumber()
  maxClasses?: number

  @IsOptional()
  @IsNumber()
  storageLimitGb?: number
}

export class UpdateTenantConfigDto {
  @IsOptional()
  @IsNumber()
  maxStudents?: number

  @IsOptional()
  @IsNumber()
  maxTeachers?: number

  @IsOptional()
  @IsNumber()
  maxClasses?: number

  @IsOptional()
  @IsNumber()
  storageLimitGb?: number

  @IsOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string

  @IsOptional()
  @IsString()
  faviconUrl?: string

  @IsOptional()
  @IsHexColor()
  primaryColor?: string

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string

  @IsOptional()
  @IsString()
  companyName?: string

  @IsOptional()
  @IsBoolean()
  enableCustomDomain?: boolean

  @IsOptional()
  @IsBoolean()
  enableSso?: boolean

  @IsOptional()
  @IsBoolean()
  enableAdvancedAnalytics?: boolean

  @IsOptional()
  @IsString()
  subscriptionTier?: string
}

export class UpdateTenantLimitsDto {
  @IsOptional()
  @IsNumber()
  maxStudents?: number

  @IsOptional()
  @IsNumber()
  maxTeachers?: number

  @IsOptional()
  @IsNumber()
  maxClasses?: number

  @IsOptional()
  @IsNumber()
  storageLimitGb?: number

  @IsOptional()
  @IsNumber()
  maxConcurrentUsers?: number
}

export class WhiteLabelDto {
  @IsOptional()
  @IsString()
  logoUrl?: string

  @IsOptional()
  @IsString()
  faviconUrl?: string

  @IsOptional()
  @IsHexColor()
  primaryColor?: string

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string

  @IsOptional()
  @IsString()
  companyName?: string

  @IsOptional()
  @IsEmail()
  supportEmail?: string

  @IsOptional()
  @IsString()
  supportPhone?: string
}

// ========== ROLE PERMISSION DTOs ==========

export class CreateRolePermissionDto {
  @IsString()
  role: string

  @IsString()
  resource: string

  @IsString()
  permissions: string // "READ,WRITE,DELETE"

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, any>
}

export class UpdateRolePermissionDto {
  @IsOptional()
  @IsString()
  permissions?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, any>

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}

// ========== GLOBAL SETTING DTOs ==========

export class CreateGlobalSettingDto {
  @IsString()
  key: string

  @IsString()
  value: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean
}

export class GlobalSettingsDto {
  @IsString()
  settingKey: string

  @IsString()
  settingValue: string

  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean

  @IsOptional()
  @IsString()
  description?: string
}

export class UpdateGlobalSettingDto {
  @IsOptional()
  @IsString()
  value?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean
}

// ========== PAYMENT GATEWAY CONFIG DTOs ==========

export class CreatePaymentGatewayConfigDto {
  @IsString()
  provider: string // stripe, asaas, efi

  @IsString()
  apiKeyEncrypted: string

  @IsOptional()
  @IsString()
  secretKeyEncrypted?: string

  @IsOptional()
  @IsString()
  webhookSecret?: string

  @IsBoolean()
  isActive: boolean = true

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, any>
}

export class UpdatePaymentGatewayConfigDto {
  @IsOptional()
  @IsString()
  apiKeyEncrypted?: string

  @IsOptional()
  @IsString()
  secretKeyEncrypted?: string

  @IsOptional()
  @IsString()
  webhookSecret?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  metadata?: Record<string, any>
}

// ========== AUDIT LOG DTOs ==========

export class FilterAuditLogDto {
  @IsOptional()
  @IsString()
  action?: string

  @IsOptional()
  @IsString()
  resource?: string

  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @IsNumber()
  skip: number = 0

  @IsOptional()
  @IsNumber()
  take: number = 50
}

export class AuditLogQueryDto extends FilterAuditLogDto {}

// ========== METRICS DTOs ==========

export class BusinessMetricsResponseDto {
  totalSchools: number
  totalActiveStudents: number
  totalUsers: number
  totalTeachers: number
  totalRevenue: number
  delinquencyRate: number
  averageStudentPerSchool: number
  newSchoolsThisMonth: number
  newStudentsThisMonth: number
  churnRate: number
  systemUptime: number
  avgResponseTime: number
  errorRate: number
}

export class SchoolMetricsResponseDto {
  schoolId: string
  schoolName: string
  studentCount: number
  teacherCount: number
  classCount: number
  enrollmentsCount: number
  revenue: number
  delinquentCount: number
  delinquencyRate: number
  monthlyGrowth: number
  attendanceRate: number
  averageGrade: number
}

export class MonthlyEnrollmentTrendDto {
  month: number
  year: number
  totalEnrollments: number
  newEnrollments: number
  growthPercent: number
}
