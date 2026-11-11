import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'
import { Role } from '@prisma/client'

/**
 * MetricsService - Business analytics and dashboard metrics
 */
/** Haitian grading scale and the default pass mark on it. */
const GRADE_SCALE = 20
const PASSING_GRADE = 10

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

    // Placeholder until the finance schema is wired into owner metrics
    return {
      defaultRate: 0,
      period: { startDate, days: periodDays },
      status: 'Finance module integration needed',
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
      select: { score: true, maxScore: true },
    })

    if (grades.length === 0) {
      return {
        distribution: {},
        statistics: { average: 0, highest: 0, lowest: 0, count: 0, scale: GRADE_SCALE },
      }
    }

    // Grades are on the Haitian /20 scale; normalise any other maxScore to it.
    const distribution = {
      '0-5': 0,
      '5-10': 0,
      '10-12': 0,
      '12-16': 0,
      '16-20': 0,
    }

    let sum = 0
    let highest = 0
    let lowest = GRADE_SCALE

    grades.forEach(g => {
      const maxScore = g.maxScore > 0 ? g.maxScore : GRADE_SCALE
      const score = Math.min(GRADE_SCALE, Math.max(0, (g.score / maxScore) * GRADE_SCALE))
      sum += score
      if (score > highest) highest = score
      if (score < lowest) lowest = score

      if (score < 5) distribution['0-5']++
      else if (score < 10) distribution['5-10']++
      else if (score < 12) distribution['10-12']++
      else if (score < 16) distribution['12-16']++
      else distribution['16-20']++
    })

    return {
      distribution,
      statistics: {
        average: parseFloat((sum / grades.length).toFixed(2)),
        highest: parseFloat(highest.toFixed(2)),
        lowest: parseFloat(lowest.toFixed(2)),
        count: grades.length,
        scale: GRADE_SCALE,
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

    // Performance score: the four factors below add up to at most 100 points.
    let performanceScore = 0

    // Attendance factor (0-30 points)
    performanceScore += (dashboard.attendance.presentPercent / 100) * 30

    // Academic factor (0-30 points), average on the /20 scale
    performanceScore += (dashboard.academics.averageGrade / GRADE_SCALE) * 30

    // Enrollment stability (0-20 points)
    const growthTrend = dashboard.enrollment.monthGrowthPercent
    if (growthTrend >= -5 && growthTrend <= 10) {
      performanceScore += 20
    } else if (growthTrend > 10) {
      performanceScore += 15
    } else {
      performanceScore += 5
    }

    // Class capacity utilization (0-20 points)
    const avgOccupancy = classesList.reduce((sum, c) => sum + c.occupancyRate, 0) / (classesList.length || 1)
    if (avgOccupancy >= 70 && avgOccupancy <= 90) {
      performanceScore += 20
    } else if (avgOccupancy > 90) {
      performanceScore += 15
    } else {
      performanceScore += 10
    }

    return {
      schoolId,
      performanceScore: parseFloat(performanceScore.toFixed(2)),
      metrics: dashboard,
      classMetrics: classesList,
      recommendations: this.generateRecommendations(performanceScore, dashboard),
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

    if (dashboard.academics.averageGrade < PASSING_GRADE) {
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
