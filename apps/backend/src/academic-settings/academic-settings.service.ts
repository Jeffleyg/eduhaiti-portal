import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { UpsertAcademicSettingDto } from "./dto/upsert-academic-setting.dto"

@Injectable()
export class AcademicSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBySchool(schoolId: string) {
    const setting = await this.prisma.academicSetting.findUnique({
      where: { schoolId },
    })

    if (setting) {
      return setting
    }

    return {
      schoolId,
      passAverage: 10,
      maxAbsencesPerCourse: 5,
      assignmentLateDaysLimit: 2,
      gradeReviewWindowDays: 7,
      createdAt: null,
      updatedAt: null,
    }
  }

  async upsertBySchool(schoolId: string, dto: UpsertAcademicSettingDto) {
    return this.prisma.academicSetting.upsert({
      where: { schoolId },
      update: {
        passAverage: dto.passAverage,
        maxAbsencesPerCourse: dto.maxAbsencesPerCourse,
        assignmentLateDaysLimit: dto.assignmentLateDaysLimit,
        gradeReviewWindowDays: dto.gradeReviewWindowDays,
      },
      create: {
        schoolId,
        passAverage: dto.passAverage ?? 10,
        maxAbsencesPerCourse: dto.maxAbsencesPerCourse ?? 5,
        assignmentLateDaysLimit: dto.assignmentLateDaysLimit ?? 2,
        gradeReviewWindowDays: dto.gradeReviewWindowDays ?? 7,
      },
    })
  }
}
