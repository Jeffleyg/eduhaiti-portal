import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}

  async listBySchool(schoolId: string) {
    if (!schoolId) {
      throw new BadRequestException('Identificador da escola não fornecido');
    }

    return this.prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { year: 'desc' },
    });
  }
  private async resolveSchoolId(schoolRef?: string) {
    if (!schoolRef || typeof schoolRef !== 'string') {
      throw new BadRequestException('O identificador da escola (schoolId) é obrigatório.');
    }

    const normalized = schoolRef.trim();

    if (!normalized) {
      throw new BadRequestException('O identificador da escola (schoolId) é obrigatório.');
    }

    // Tentar correspondência exata por ID ou Nome
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
        'Várias escolas correspondem a esse identificador. Utilize o ID da escola.',
      );
    }

    // Tentar correspondência parcial por nome
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
        'Várias escolas correspondem a esse nome. Utilize o ID da escola.',
      );
    }

    throw new NotFoundException(`Escola "${schoolRef}" não encontrada.`);
  }

  async create(schoolId: string, dto: CreateAcademicYearDto) {
    if (!schoolId) {
      throw new BadRequestException('Identificador da escola não fornecido');
    }

    const yearTrimmed = dto.year.trim();

    // Verificar se o ano já se encontra registado para esta escola
    const existing = await this.prisma.academicYear.findFirst({
      where: {
        schoolId,
        year: yearTrimmed,
      },
    });

    if (existing) {
      throw new BadRequestException('Este ano académico já está registado nesta escola.');
    }

    // Determinar datas padrão caso não sejam especificadas (ex: 2026-2027 -> 01/09/2026 a 30/06/2027)
    const startYearNumber = parseInt(yearTrimmed.split('-')[0], 10) || new Date().getFullYear();
    const endYearNumber = parseInt(yearTrimmed.split('-')[1], 10) || startYearNumber + 1;

    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : new Date(`${startYearNumber}-09-01T00:00:00.000Z`);

    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : new Date(`${endYearNumber}-06-30T23:59:59.999Z`);

    if (dto.isActive) {
      return this.prisma.$transaction(async (tx) => {
        await tx.academicYear.updateMany({
          where: { schoolId, isActive: true },
          data: { isActive: false },
        });

        return tx.academicYear.create({
          data: {
            schoolId,
            year: yearTrimmed,
            startDate,
            endDate,
            isActive: true,
          },
        });
      });
    }

    return this.prisma.academicYear.create({
      data: {
        schoolId,
        year: yearTrimmed,
        startDate,
        endDate,
        isActive: false,
      },
    });
  }

  async remove(schoolId: string, yearId: string) {
    const existing = await this.prisma.academicYear.findFirst({
      where: { id: yearId, schoolId },
    });

    if (!existing) {
      throw new NotFoundException('Ano académico não encontrado');
    }

    return this.prisma.academicYear.delete({
      where: { id: yearId },
    });
  }
}