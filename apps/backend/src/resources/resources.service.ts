import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(classId: string, title: string, description: string | undefined, filePath: string, fileType: string, uploadedById: string) {
    return this.prisma.resource.create({
      data: {
        classId,
        title,
        description,
        filePath,
        fileType,
        uploadedById,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })
  }

  async findByClass(classId: string) {
    return this.prisma.resource.findMany({
      where: { classId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async findById(resourceId: string) {
    return this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })
  }

  async delete(resourceId: string) {
    return this.prisma.resource.delete({
      where: { id: resourceId },
    })
  }
}
