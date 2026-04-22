import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { CreateAcademicPeriodDto } from "./dto/create-academic-period.dto"
import { UpdateAcademicPeriodDto } from "./dto/update-academic-period.dto"

@Injectable()
export class AcademicPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureNoOverlap(
    schoolId: string,
    startDate: Date,
    endDate: Date,
    excludePeriodId?: string,
  ) {
    const overlap = await this.prisma.academicPeriod.findFirst({
      where: {
        schoolId,
        id: excludePeriodId ? { not: excludePeriodId } : undefined,
        startDate: { lt: endDate },
        endDate: { gt: startDate },
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    })

    if (overlap) {
      throw new BadRequestException("Academic period overlaps an existing period")
    }
  }

  async listBySchool(schoolId: string) {
    return this.prisma.academicPeriod.findMany({
      where: { schoolId },
      orderBy: { startDate: "asc" },
    })
  }

  async create(dto: CreateAcademicPeriodDto) {
    const startDate = new Date(dto.startDate)
    const endDate = new Date(dto.endDate)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("Invalid period dates")
    }

    if (endDate <= startDate) {
      throw new BadRequestException("endDate must be greater than startDate")
    }

    await this.ensureNoOverlap(dto.schoolId, startDate, endDate)

    return this.prisma.academicPeriod.create({
      data: {
        schoolId: dto.schoolId,
        name: dto.name,
        startDate,
        endDate,
        description: dto.description,
      },
    })
  }

  async update(periodId: string, dto: UpdateAcademicPeriodDto) {
    const existing = await this.prisma.academicPeriod.findUnique({
      where: { id: periodId },
    })

    if (!existing) {
      throw new NotFoundException("Academic period not found")
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException("Invalid period dates")
    }

    if (endDate <= startDate) {
      throw new BadRequestException("endDate must be greater than startDate")
    }

    await this.ensureNoOverlap(existing.schoolId, startDate, endDate, existing.id)

    return this.prisma.academicPeriod.update({
      where: { id: periodId },
      data: {
        name: dto.name,
        startDate,
        endDate,
        isOpen: dto.isOpen,
        description: dto.description,
      },
    })
  }

  async setOpenState(periodId: string, isOpen: boolean) {
    const existing = await this.prisma.academicPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, schoolId: true },
    })

    if (!existing) {
      throw new NotFoundException("Academic period not found")
    }

    if (!isOpen) {
      return this.prisma.academicPeriod.update({
        where: { id: periodId },
        data: { isOpen: false },
      })
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.academicPeriod.updateMany({
        where: {
          schoolId: existing.schoolId,
          isOpen: true,
          id: { not: existing.id },
        },
        data: { isOpen: false },
      })

      return tx.academicPeriod.update({
        where: { id: periodId },
        data: { isOpen: true },
      })
    })
  }

  async remove(periodId: string) {
    return this.prisma.academicPeriod.delete({ where: { id: periodId } })
  }
}
