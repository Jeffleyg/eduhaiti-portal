import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAcademicSettingDto } from './dto/upsert-academic-setting.dto';

@Injectable()
export class AcademicSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveSchoolId(schoolRef: string) {
    const normalized = schoolRef.trim();

    if (!normalized) {
      throw new Error('School identifier is required');
    }

    // Try exact match by ID or name
    const exactMatches = await this.prisma.school.findMany({
      where: {
        OR: [
          { id: normalized },
          { name: { equals: normalized, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });

    if (exactMatches.length === 1) {
      return exactMatches[0].id;
    }

    if (exactMatches.length > 1) {
      throw new Error('Multiple schools match that identifier. Please use the school ID.');
    }

    // Try partial match by name
    const partialMatches = await this.prisma.school.findMany({
      where: {
        name: { contains: normalized, mode: 'insensitive' },
      },
      select: { id: true, name: true },
      take: 10,
    });

    if (partialMatches.length === 1) {
      return partialMatches[0].id;
    }

    if (partialMatches.length > 1) {
      throw new Error('Multiple schools match that name. Please use the school ID.');
    }

    throw new Error(`School ${schoolRef} not found`);
  }

  async getBySchool(schoolId: string) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);
    const setting = await this.prisma.academicSetting.findUnique({
      where: { schoolId: resolvedSchoolId },
    });

    if (setting) {
      return setting;
    }

    return {
      schoolId: resolvedSchoolId,
      passAverage: 10,
      maxAbsencesPerCourse: 5,
      assignmentLateDaysLimit: 2,
      gradeReviewWindowDays: 7,
      createdAt: null,
      updatedAt: null,
    };
  }

  async upsertBySchool(schoolId: string, dto: UpsertAcademicSettingDto) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);

    return this.prisma.academicSetting.upsert({
      where: { schoolId: resolvedSchoolId },
      update: {
        passAverage: dto.passAverage,
        maxAbsencesPerCourse: dto.maxAbsencesPerCourse,
        assignmentLateDaysLimit: dto.assignmentLateDaysLimit,
        gradeReviewWindowDays: dto.gradeReviewWindowDays,
      },
      create: {
        schoolId: resolvedSchoolId,
        passAverage: dto.passAverage ?? 10,
        maxAbsencesPerCourse: dto.maxAbsencesPerCourse ?? 5,
        assignmentLateDaysLimit: dto.assignmentLateDaysLimit ?? 2,
        gradeReviewWindowDays: dto.gradeReviewWindowDays ?? 7,
      },
    });
  }
}
