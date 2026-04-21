import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { CreateDisciplineDto } from "./dto/create-discipline.dto"
import { UpdateDisciplineDto } from "./dto/update-discipline.dto"

@Injectable()
export class DisciplinesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDisciplineDto) {
    const series = await this.prisma.series.findUnique({
      where: { id: dto.seriesId },
    })

    if (!series) {
      throw new NotFoundException("Series not found")
    }

    const existing = await this.prisma.discipline.findFirst({
      where: {
        seriesId: dto.seriesId,
        name: dto.name,
      },
    })

    if (existing) {
      throw new BadRequestException("Discipline already exists in this series")
    }

    return this.prisma.discipline.create({
      data: {
        seriesId: dto.seriesId,
        name: dto.name,
        code: dto.code,
        credits: dto.credits ?? 0,
      },
    })
  }

  async findBySeries(seriesId?: string) {
    return this.prisma.discipline.findMany({
      where: seriesId ? { seriesId } : undefined,
      include: {
        series: {
          select: {
            id: true,
            name: true,
            academicYear: { select: { id: true, year: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    })
  }

  async findById(disciplineId: string) {
    const discipline = await this.prisma.discipline.findUnique({
      where: { id: disciplineId },
    })

    if (!discipline) {
      throw new NotFoundException("Discipline not found")
    }

    return discipline
  }

  async update(disciplineId: string, dto: UpdateDisciplineDto) {
    const existing = await this.prisma.discipline.findUnique({
      where: { id: disciplineId },
    })

    if (!existing) {
      throw new NotFoundException("Discipline not found")
    }

    return this.prisma.discipline.update({
      where: { id: disciplineId },
      data: {
        name: dto.name ?? existing.name,
        code: dto.code ?? existing.code,
        credits: dto.credits ?? existing.credits,
      },
    })
  }

  async delete(disciplineId: string) {
    const existing = await this.prisma.discipline.findUnique({
      where: { id: disciplineId },
    })

    if (!existing) {
      throw new NotFoundException("Discipline not found")
    }

    return this.prisma.discipline.delete({
      where: { id: disciplineId },
    })
  }
}
