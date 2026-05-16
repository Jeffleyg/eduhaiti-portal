import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { Role } from '@prisma/client'

/**
 * MetricsService - Business analytics and dashboard metrics
 */
@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get total active students across all schools or for a specific school
   */
  async getTotalActiveStudents(schoolId?: string) {
    const total = await this.prisma.user.count({
      where: {
        role: Role.STUDENT,
        isActive: true,
        ...(schoolId ? { school: { id: schoolId } } : {}),
      },
    })

    return { totalStudents: total, period: new Date() }
  }

  /**
   * Get total active teachers
   */
  async getTotalActiveTeachers(schoolId?: string) {
    const total = await this.prisma.user.count({
      where: {
        role: Role.TEACHER,
        isActive: true,
        ...(schoolId ? { school: { id: schoolId } } : {}),
      },
    })

    return { totalTeachers: total, period: new Date() }
  }

  /**
   * Calculate default rate (overdue payments / total)
   */
  async calculateDefaultRate(schoolId?: string, periodDays: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)

    // Try to get data from Finance model if exists, otherwise return placeholder
    try {
      // Placeholder - adjust based on actual finance schema
      return {
        defaultRate: 0,
        period: { startDate, days: periodDays },
        status: 'Finance module integration needed',
      }
    } catch (error) {
      return {
        defaultRate: 0,
        period: { startDate, days: periodDays },
        status: 'unavailable',
      }
    }
  }

  /**
   * Calculate enrollment growth (month-over-month percentage)
   */
  async getEnrollmentGrowth(schoolId?: string, monthsBack: number = 12) {
    const growth: Array<{ month: string; enrollments: number }> = []

    for (let i = monthsBack; i > 0; i--) {
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - i)
      startDate.setDate(1)
      startDate.setHours(0, 0, 0, 0)

      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(0)
      endDate.setHours(23, 59, 59, 999)

      const where = {
        role: Role.STUDENT,
        isActive: true,
        createdAt: { gte: startDate, lte: endDate },
        ...(schoolId && { school: { id: schoolId } }),
      }

      const count = await this.prisma.user.count({ where })

      growth.push({
        month: startDate.toISOString().slice(0, 7),
        enrollments: count,
      })
    }

    // Calculate month-over-month growth percentage
    const growthPercentages: Array<{ month: string; enrollments: number; growthPercent: number }> = []
    for (let i = 1; i < growth.length; i++) {
      const current = growth[i].enrollments
      const previous = growth[i - 1].enrollments

      const percentage = previous === 0 ? 0 : ((current - previous) / previous) * 100

      growthPercentages.push({
        month: growth[i].month,
        enrollments: current,
        growthPercent: parseFloat(percentage.toFixed(2)),
      })
    }

    return {
      data: growthPercentages,
      currentMonthEnrollments: growth[growth.length - 1]?.enrollments || 0,
    }
  }

  /**
   * Get student enrollment by class
   */
  async getEnrollmentByClass(schoolId?: string) {
    const classes = await this.prisma.class.findMany({
      where: schoolId ? { academicYear: { schoolId } } : undefined,
      include: {
        _count: {
          select: { students: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return classes.map(cls => ({
      classId: cls.id,
      className: cls.name,
      studentCount: cls._count.students,
      capacity: cls.maxStudents,
      occupancyRate: cls.maxStudents ? (cls._count.students / cls.maxStudents) * 100 : 0,
    }))
  }

  /**
   * Get attendance statistics
   */
  async getAttendanceStatistics(schoolId?: string, periodDays: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)

    const where = {
      date: { gte: startDate },
      ...(schoolId && { class: { academicYear: { schoolId } } }),
    }

    const [totalRecords, presentCount, absentCount, lateCount] = await Promise.all([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.count({ where: { ...where, status: 'PRESENT' } }),
      this.prisma.attendance.count({ where: { ...where, status: 'ABSENT' } }),
      this.prisma.attendance.count({ where: { ...where, status: 'LATE' } }),
    ])

    return {
      period: { days: periodDays, startDate },
      totalRecords,
      presentCount,
      presentPercent: totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0,
      absentCount,
      absentPercent: totalRecords > 0 ? (absentCount / totalRecords) * 100 : 0,
      lateCount,
      latePercent: totalRecords > 0 ? (lateCount / totalRecords) * 100 : 0,
    }
  }

  /**
   * Get grade distribution
   */
  async getGradeDistribution(schoolId?: string) {
    const grades = await this.prisma.grade.findMany({
      where: schoolId ? { class: { academicYear: { schoolId } } } : undefined,
      select: { score: true },
    })

    if (grades.length === 0) {
      return {
        distribution: {},
        statistics: { average: 0, highest: 0, lowest: 0, count: 0 },
      }
    }

    // Bucket grades
    const distribution = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0,
    }

    let sum = 0
    let highest = 0
    let lowest = 100

    grades.forEach(g => {
      sum += g.score
      if (g.score > highest) highest = g.score
      if (g.score < lowest) lowest = g.score

      if (g.score <= 20) distribution['0-20']++
      else if (g.score <= 40) distribution['21-40']++
      else if (g.score <= 60) distribution['41-60']++
      else if (g.score <= 80) distribution['61-80']++
      else distribution['81-100']++
    })

    return {
      distribution,
      statistics: {
        average: parseFloat((sum / grades.length).toFixed(2)),
        highest,
        lowest,
        count: grades.length,
      },
    }
  }

  /**
   * Generate executive dashboard
   */
  async generateExecutiveDashboard(schoolId?: string) {
    const [students, teachers, classes, enrollmentGrowth, attendance, grades] = await Promise.all([
      this.getTotalActiveStudents(schoolId),
      this.getTotalActiveTeachers(schoolId),
      schoolId
        ? this.prisma.class.count({ where: { academicYear: { schoolId } } })
        : this.prisma.class.count(),
      this.getEnrollmentGrowth(schoolId, 12),
      this.getAttendanceStatistics(schoolId, 30),
      this.getGradeDistribution(schoolId),
    ])

    const currentMonthGrowth = enrollmentGrowth.data[enrollmentGrowth.data.length - 1]

    return {
      summary: {
        totalStudents: students.totalStudents,
        totalTeachers: teachers.totalTeachers,
        totalClasses: classes,
        generatedAt: new Date(),
      },
      enrollment: {
        current: enrollmentGrowth.currentMonthEnrollments,
        monthGrowthPercent: currentMonthGrowth?.growthPercent || 0,
        trend: enrollmentGrowth.data.slice(-3),
      },
      attendance: {
        presentPercent: parseFloat(attendance.presentPercent.toFixed(2)),
        absentPercent: parseFloat(attendance.absentPercent.toFixed(2)),
        latePercent: parseFloat(attendance.latePercent.toFixed(2)),
        period: `Last ${attendance.period.days} days`,
      },
      academics: {
        averageGrade: grades.statistics.average,
        gradeDistribution: grades.distribution,
        highestGrade: grades.statistics.highest,
        lowestGrade: grades.statistics.lowest,
      },
    }
  }

  /**
   * Get school performance metrics
   */
  async getSchoolPerformanceMetrics(schoolId: string) {
    const [dashboard, classesList] = await Promise.all([
      this.generateExecutiveDashboard(schoolId),
      this.getEnrollmentByClass(schoolId),
    ])

    // Calculate performance score (0-100)
    let performanceScore = 0
    let factors = 0

    // Attendance factor (0-30 points)
    performanceScore += (dashboard.attendance.presentPercent / 100) * 30
    factors++

    // Academic factor (0-30 points)
    const gradePercentage = (dashboard.academics.averageGrade / 100) * 100
    performanceScore += (gradePercentage / 100) * 30
    factors++

    // Enrollment stability (0-20 points)
    const growthTrend = dashboard.enrollment.monthGrowthPercent
    if (growthTrend >= -5 && growthTrend <= 10) {
      performanceScore += 20
    } else if (growthTrend > 10) {
      performanceScore += 15
    } else {
      performanceScore += 5
    }
    factors++

    // Class capacity utilization (0-20 points)
    const avgOccupancy = classesList.reduce((sum, c) => sum + c.occupancyRate, 0) / (classesList.length || 1)
    if (avgOccupancy >= 70 && avgOccupancy <= 90) {
      performanceScore += 20
    } else if (avgOccupancy > 90) {
      performanceScore += 15
    } else {
      performanceScore += 10
    }
    factors++

    return {
      schoolId,
      performanceScore: parseFloat((performanceScore / factors).toFixed(2)),
      metrics: dashboard,
      classMetrics: classesList,
      recommendations: this.generateRecommendations(performanceScore / factors, dashboard),
    }
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(performanceScore: number, dashboard: any): string[] {
    const recommendations: string[] = []

    if (dashboard.attendance.absentPercent > 20) {
      recommendations.push('High absence rate detected. Consider implementing attendance incentives.')
    }

    if (dashboard.academics.averageGrade < 60) {
      recommendations.push('Average grades are below passing. Consider implementing tutoring programs.')
    }

    if (dashboard.enrollment.monthGrowthPercent < -10) {
      recommendations.push('Declining enrollment. Review student satisfaction and retention programs.')
    }

    if (performanceScore < 50) {
      recommendations.push('Overall performance is low. Schedule a review meeting with school administration.')
    }

    if (recommendations.length === 0) {
      recommendations.push('School is performing well. Maintain current strategies.')
    }

    return recommendations
  }

  /**
   * Get resource utilization metrics
   */
  async getResourceUtilization(schoolId: string) {
    const [classrooms, materials, teachers, labs] = await Promise.all([
      this.prisma.class.count({ where: { academicYear: { schoolId } } }),
      this.prisma.resource.count({ where: { class: { academicYear: { schoolId } } } }),
      this.getTotalActiveTeachers(schoolId),
      // No dedicated LAB type in current schema
      this.prisma.class.count({ where: { academicYear: { schoolId } } }),
    ])

    return {
      schoolId,
      resources: {
        classrooms,
        teachingMaterials: materials,
        teachers: teachers.totalTeachers,
        laboratories: labs,
      },
      utilizationScore: 0, // Will be calculated based on actual usage data
    }
  }
}
