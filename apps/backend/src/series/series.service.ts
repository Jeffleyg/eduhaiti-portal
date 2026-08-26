import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';

@Injectable()
export class SeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSeriesDto, schoolId?: string) {
    const ay = await this.prisma.academicYear.findUnique({ where: { id: dto.academicYearId }, select: { id: true, schoolId: true } });
    if (!ay) throw new NotFoundException('Academic year not found');
    if (schoolId && ay.schoolId !== schoolId) throw new ForbiddenException('Academic year does not belong to this school');

    // Ensure uniqueness handled by prisma constraint; surface friendly error
    try {
      return this.prisma.series.create({ data: { name: dto.name, academicYearId: dto.academicYearId, description: dto.description } });
    } catch (err) {
      throw new BadRequestException('Could not create series');
    }
  }

  async update(id: string, dto: UpdateSeriesDto, schoolId?: string) {
    const existing = await this.prisma.series.findUnique({ where: { id }, include: { academicYear: { select: { schoolId: true } } } });
    if (!existing) throw new NotFoundException('Series not found');
    if (schoolId && existing.academicYear.schoolId !== schoolId) throw new ForbiddenException('Series does not belong to this school');

    return this.prisma.series.update({ where: { id }, data: { name: dto.name, description: dto.description } });
  }

  async remove(id: string, schoolId?: string) {
    const existing = await this.prisma.series.findUnique({ where: { id }, include: { academicYear: { select: { schoolId: true } } } });
    if (!existing) throw new NotFoundException('Series not found');
    if (schoolId && existing.academicYear.schoolId !== schoolId) throw new ForbiddenException('Series does not belong to this school');

    await this.prisma.series.delete({ where: { id } });
    return { message: 'Series deleted' };
  }

  async list(academicYearId?: string, schoolId?: string) {
    const where: any = {};
    if (academicYearId) where.academicYearId = academicYearId;
    if (schoolId) where.academicYear = { schoolId };

    return this.prisma.series.findMany({ where, include: { academicYear: { select: { id: true, year: true } } }, orderBy: { name: 'asc' } });
  }
}
