import { Injectable } from '@nestjs/common';
import { PaymentStatus, Role } from '@prisma/client';
import { gzipSync } from 'node:zlib';
import { PrismaService } from '../prisma/prisma.service';
import { ExportFormat } from './dto/export-report.dto';

export type AnalyticsReportType =
  | 'evasao-escolar'
  | 'media-notas-regiao'
  | 'fluxo-pagamentos-realtime'
  | 'impacto-diaspora-bolsas';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDropoutRiskReport(schoolId?: string) {
    const now = Date.now();
    const since90d = new Date(now - 90 * 24 * 60 * 60 * 1000);

    const students = await this.prisma.user.findMany({
      where: {
        role: Role.STUDENT,
        ...(schoolId
          ? {
              classesAttending: {
                some: {
                  academicYear: {
                    schoolId,
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        enrollmentNumber: true,
      },
      take: 5000,
    });

    const studentIds = students.map((item) => item.id);
    if (studentIds.length === 0) {
      return [];
    }

    const [attendanceRows, gradeRows] = await Promise.all([
      this.prisma.attendance.findMany({
        where: {
          studentId: { in: studentIds },
          date: { gte: since90d },
        },
        select: { studentId: true, status: true },
      }),
      this.prisma.grade.findMany({
        where: {
          studentId: { in: studentIds },
          createdAt: { gte: since90d },
        },
        select: { studentId: true, score: true, createdAt: true },
      }),
    ]);

    const attendanceMap = new Map<
      string,
      { total: number; absences: number }
    >();
    for (const row of attendanceRows) {
      const current = attendanceMap.get(row.studentId) ?? {
        total: 0,
        absences: 0,
      };
      current.total += 1;
      if (row.status === 'ABSENT') {
        current.absences += 1;
      }
      attendanceMap.set(row.studentId, current);
    }

    const gradeMap = new Map<
      string,
      { sum: number; count: number; lastGradeAt: Date | null }
    >();
    for (const row of gradeRows) {
      const current = gradeMap.get(row.studentId) ?? {
        sum: 0,
        count: 0,
        lastGradeAt: null,
      };
      current.sum += row.score;
      current.count += 1;
      if (!current.lastGradeAt || row.createdAt > current.lastGradeAt) {
        current.lastGradeAt = row.createdAt;
      }
      gradeMap.set(row.studentId, current);
    }

    return students.map((student) => {
      const attendance = attendanceMap.get(student.id) ?? {
        total: 0,
        absences: 0,
      };
      const grades = gradeMap.get(student.id) ?? {
        sum: 0,
        count: 0,
        lastGradeAt: null,
      };

      const avgScore90d = grades.count > 0 ? grades.sum / grades.count : 0;
      const absenceRate90d =
        attendance.total > 0 ? attendance.absences / attendance.total : 0;
      const atRiskDropout =
        attendance.total >= 10 && absenceRate90d >= 0.35 && avgScore90d < 10;

      return {
        studentId: student.id,
        enrollmentNumber: student.enrollmentNumber,
        studentName: student.name,
        absences90d: attendance.absences,
        attendanceEvents90d: attendance.total,
        absenceRate90d: Number(absenceRate90d.toFixed(4)),
        avgScore90d: Number(avgScore90d.toFixed(2)),
        lastGradeAt: grades.lastGradeAt
          ? grades.lastGradeAt.toISOString()
          : null,
        atRiskDropout,
      };
    });
  }

  async getAverageGradesByRegionReport() {
    const rows = await this.prisma.grade.findMany({
      select: {
        score: true,
        updatedAt: true,
        class: {
          select: {
            academicYear: {
              select: {
                school: {
                  select: {
                    city: true,
                    country: true,
                  },
                },
              },
            },
          },
        },
      },
      take: 100000,
    });

    const byRegion = new Map<
      string,
      {
        gradesCount: number;
        scoreSum: number;
        lastUpdateAt: Date | null;
      }
    >();

    for (const row of rows) {
      const region =
        row.class.academicYear.school.city?.trim() ||
        row.class.academicYear.school.country?.trim() ||
        'Unknown';
      const current = byRegion.get(region) ?? {
        gradesCount: 0,
        scoreSum: 0,
        lastUpdateAt: null,
      };

      current.gradesCount += 1;
      current.scoreSum += row.score;
      if (!current.lastUpdateAt || row.updatedAt > current.lastUpdateAt) {
        current.lastUpdateAt = row.updatedAt;
      }

      byRegion.set(region, current);
    }

    return [...byRegion.entries()].map(([region, value]) => ({
      region,
      gradesCount: value.gradesCount,
      avgGrade:
        value.gradesCount > 0
          ? Number((value.scoreSum / value.gradesCount).toFixed(2))
          : 0,
      lastUpdateAt: value.lastUpdateAt
        ? value.lastUpdateAt.toISOString()
        : null,
    }));
  }

  async getRealtimePaymentsFlowReport(schoolId?: string) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rows = await this.prisma.payment.findMany({
      where: {
        createdAt: { gte: since24h },
        ...(schoolId ? { schoolId } : {}),
      },
      select: {
        createdAt: true,
        status: true,
        amount: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 100000,
    });

    const bucketMap = new Map<
      string,
      {
        createdAt: Date;
        status: PaymentStatus;
        paymentsCount: number;
        amountTotal: number;
      }
    >();

    for (const row of rows) {
      const bucketStart = this.floorTo15Minutes(row.createdAt);
      const key = `${bucketStart.toISOString()}|${row.status}`;
      const current = bucketMap.get(key) ?? {
        createdAt: bucketStart,
        status: row.status,
        paymentsCount: 0,
        amountTotal: 0,
      };

      current.paymentsCount += 1;
      current.amountTotal += row.amount;
      bucketMap.set(key, current);
    }

    return [...bucketMap.values()]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((item) => ({
        bucket15m: item.createdAt.toISOString(),
        status: item.status,
        paymentsCount: item.paymentsCount,
        amountTotal: Number(item.amountTotal.toFixed(2)),
      }));
  }

  async getDiasporaScholarshipImpactDashboard(schoolId?: string) {
    const diasporaPaymentIds = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'PAYMENT',
        action: 'DIASPORA_REMITTANCE_CREDIT',
      },
      select: {
        entityId: true,
        createdAt: true,
      },
      take: 100000,
    });

    const paymentIds = diasporaPaymentIds.map((item) => item.entityId);
    if (paymentIds.length === 0) {
      return {
        remittanceVolume: 0,
        creditedTotalHtg: 0,
        estimatedScholarships: 0,
        scholarshipUnitHtg: this.getScholarshipUnit(),
        timeline: [],
      };
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        id: { in: paymentIds },
        ...(schoolId ? { schoolId } : {}),
      },
      select: {
        id: true,
        schoolId: true,
        amount: true,
        createdAt: true,
        studentId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const scholarshipUnit = this.getScholarshipUnit();
    const totalHtg = payments.reduce((sum, item) => sum + item.amount, 0);

    const byDay = new Map<
      string,
      { remittanceVolume: number; creditedTotalHtg: number }
    >();
    for (const payment of payments) {
      const day = payment.createdAt.toISOString().slice(0, 10);
      const current = byDay.get(day) ?? {
        remittanceVolume: 0,
        creditedTotalHtg: 0,
      };

      current.remittanceVolume += 1;
      current.creditedTotalHtg += payment.amount;
      byDay.set(day, current);
    }

    const timeline = [...byDay.entries()].map(([day, value]) => ({
      date: day,
      remittanceVolume: value.remittanceVolume,
      creditedTotalHtg: Number(value.creditedTotalHtg.toFixed(2)),
      estimatedScholarships: Math.floor(
        value.creditedTotalHtg / scholarshipUnit,
      ),
    }));

    return {
      remittanceVolume: payments.length,
      creditedTotalHtg: Number(totalHtg.toFixed(2)),
      estimatedScholarships: Math.floor(totalHtg / scholarshipUnit),
      scholarshipUnitHtg: scholarshipUnit,
      timeline,
    };
  }

  async buildReportData(type: AnalyticsReportType, schoolId?: string) {
    if (type === 'evasao-escolar') {
      return this.getDropoutRiskReport(schoolId);
    }

    if (type === 'media-notas-regiao') {
      return this.getAverageGradesByRegionReport();
    }

    if (type === 'fluxo-pagamentos-realtime') {
      return this.getRealtimePaymentsFlowReport(schoolId);
    }

    return this.getDiasporaScholarshipImpactDashboard(schoolId);
  }

  async exportReport(
    type: AnalyticsReportType,
    schoolId: string | undefined,
    format: ExportFormat,
  ): Promise<{
    fileName: string;
    contentType: string;
    buffer: Buffer;
  }> {
    const data = await this.buildReportData(type, schoolId);
    const fileBase = `${type}-${new Date().toISOString().replace(/[:.]/g, '-')}`;

    if (format === 'csv') {
      const csv = this.toCsv(data);
      return {
        fileName: `${fileBase}.csv`,
        contentType: 'text/csv; charset=utf-8',
        buffer: Buffer.from(csv, 'utf8'),
      };
    }

    const json = JSON.stringify(data);
    const compressed = gzipSync(Buffer.from(json, 'utf8'));
    return {
      fileName: `${fileBase}.json.gz`,
      contentType: 'application/gzip',
      buffer: compressed,
    };
  }

  private toCsv(data: unknown): string {
    if (!Array.isArray(data)) {
      return this.objectToSingleRowCsv(data as Record<string, unknown>);
    }

    if (data.length === 0) {
      return 'empty\ntrue\n';
    }

    const rows = data as Array<Record<string, unknown>>;
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];

    const lines = [headers.join(',')];
    for (const row of rows) {
      const values = headers.map((header) => this.csvEscape(row[header]));
      lines.push(values.join(','));
    }

    return `${lines.join('\n')}\n`;
  }

  private objectToSingleRowCsv(data: Record<string, unknown>): string {
    const headers = Object.keys(data);
    const values = headers.map((header) => this.csvEscape(data[header]));
    return `${headers.join(',')}\n${values.join(',')}\n`;
  }

  private csvEscape(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    let raw = '';
    if (typeof value === 'object') {
      raw = JSON.stringify(value);
    } else if (typeof value === 'string') {
      raw = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      raw = `${value}`;
    }

    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }

    return raw;
  }

  private floorTo15Minutes(date: Date): Date {
    const ms = date.getTime();
    const bucket = 15 * 60 * 1000;
    return new Date(Math.floor(ms / bucket) * bucket);
  }

  private getScholarshipUnit(): number {
    const raw = process.env.SCHOLARSHIP_UNIT_HTG;
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }

    return 15000;
  }
}
