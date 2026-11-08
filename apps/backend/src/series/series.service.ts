import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeriesDto } from './dto/create-series.dto';

@Injectable()
export class SeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(schoolId?: string) {
    return this.prisma.series.findMany({
      where: schoolId ? { academicYear: { schoolId } } : undefined,
      include: {
        academicYear: {
          select: { id: true, year: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(schoolId: string, dto: CreateSeriesDto) {
    const nameTrimmed = dto.name.trim();

    // 1. Identificar o Ano Acadêmico (o informado no DTO ou o ano ativo da escola)
    let academicYearId = dto.academicYearId;

    if (!academicYearId && schoolId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { schoolId, isActive: true },
      }) || await this.prisma.academicYear.findFirst({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
      });

      academicYearId = activeYear?.id;
    }

    if (!academicYearId) {
      throw new BadRequestException(
        "É necessário cadastrar ou selecionar um Ano Acadêmico antes de criar séries.",
      );
    }

    // 2. Verificar se já existe a mesma série para este ano acadêmico
    const existing = await this.prisma.series.findFirst({
      where: {
        name: { equals: nameTrimmed, mode: 'insensitive' },
        academicYearId,
      },
    });

    if (existing) {
      throw new BadRequestException('Esta série já está cadastrada para este ano acadêmico.');
    }

    // 3. Criar a Série vinculada ao AcademicYear
    return this.prisma.series.create({
      data: {
        name: nameTrimmed,
        academicYearId,
      },
    });
  }

  async remove(seriesId: string) {
    const existing = await this.prisma.series.findUnique({
      where: { id: seriesId },
    });

    if (!existing) {
      throw new NotFoundException('Série não encontrada');
    }

    return this.prisma.series.delete({
      where: { id: seriesId },
    });
  }
}