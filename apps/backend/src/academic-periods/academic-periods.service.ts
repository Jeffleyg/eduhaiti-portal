import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicPeriodDto } from './dto/create-academic-period.dto';
import { UpdateAcademicPeriodDto } from './dto/update-academic-period.dto';

@Injectable()
export class AcademicPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveSchoolId(schoolRef: string) {
    const normalized = schoolRef.trim();

    if (!normalized) {
      throw new BadRequestException('School identifier is required');
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
      throw new BadRequestException(
        'Multiple schools match that identifier. Please use the school ID.',
      );
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
      throw new BadRequestException(
        'Multiple schools match that name. Please use the school ID.',
      );
    }

    throw new NotFoundException(`School ${schoolRef} not found`);
  }

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
    });

    if (overlap) {
      throw new BadRequestException(
        'Academic period overlaps an existing period',
      );
    }
  }

  async listBySchool(schoolId: string) {
    const resolvedSchoolId = await this.resolveSchoolId(schoolId);

    return this.prisma.academicPeriod.findMany({
      where: { schoolId: resolvedSchoolId },
      orderBy: { startDate: 'asc' },
    });
  }

  async create(dto: CreateAcademicPeriodDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid period dates');
    }

    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be greater than startDate');
    }

    const schoolId = await this.resolveSchoolId(dto.schoolId);

    await this.ensureNoOverlap(schoolId, startDate, endDate);

    const created = await this.prisma.academicPeriod.create({
      data: {
        schoolId,
        name: dto.name,
        startDate,
        endDate,
        description: dto.description,
      },
    });

    // Ensure there is a corresponding AcademicYear so other parts of the
    // system (classes, series, etc.) that rely on AcademicYear entries will
    // see the newly created period. If an AcademicYear with the same year
    // string already exists, ignore the error.
    try {
      const existingYear = await this.prisma.academicYear.findUnique({
        where: { year: dto.name },
        select: { id: true, schoolId: true },
      });

      if (!existingYear) {
        await this.prisma.academicYear.create({
          data: {
            schoolId,
            year: dto.name,
            startDate,
            endDate,
            isActive: true,
          },
        });
      }
    } catch (err) {
      // Ignore unique constraint or other creation errors here so the
      // primary operation (creating the period) succeeds for the admin UI.
    }

    return created;
  }

  async update(periodId: string, dto: UpdateAcademicPeriodDto) {
    const existing = await this.prisma.academicPeriod.findUnique({
      where: { id: periodId },
    });

    if (!existing) {
      throw new NotFoundException('Academic period not found');
    }

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid period dates');
    }

    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be greater than startDate');
    }

    await this.ensureNoOverlap(
      existing.schoolId,
      startDate,
      endDate,
      existing.id,
    );

    return this.prisma.academicPeriod.update({
      where: { id: periodId },
      data: {
        name: dto.name,
        startDate,
        endDate,
        isOpen: dto.isOpen,
        description: dto.description,
      },
    });
  }

  async setOpenState(periodId: string, isOpen: boolean) {
    const existing = await this.prisma.academicPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, schoolId: true },
    });

    if (!existing) {
      throw new NotFoundException('Academic period not found');
    }

    if (!isOpen) {
      return this.prisma.academicPeriod.update({
        where: { id: periodId },
        data: { isOpen: false },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.academicPeriod.updateMany({
        where: {
          schoolId: existing.schoolId,
          isOpen: true,
          id: { not: existing.id },
        },
        data: { isOpen: false },
      });

      return tx.academicPeriod.update({
        where: { id: periodId },
        data: { isOpen: true },
      });
    });
  }

  async remove(periodId: string) {
    return this.prisma.academicPeriod.delete({ where: { id: periodId } });
  }
}
