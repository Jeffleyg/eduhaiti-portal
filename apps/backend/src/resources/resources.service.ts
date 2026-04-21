import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(classId: string, title: string, description: string | undefined, filePath: string, fileType: string, uploadedById: string) {
    const resource = await this.prisma.resource.create({
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

    await this.prisma.auditLog.create({
      data: {
        entityType: "RESOURCE",
        entityId: resource.id,
        action: "CREATE",
        userId: uploadedById,
        changes: JSON.stringify({
          id: resource.id,
          classId,
          title,
          filePath,
          fileType,
        }),
      },
    })

    return resource
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
    const deleted = await this.prisma.resource.delete({
      where: { id: resourceId },
    })

    await this.prisma.auditLog.create({
      data: {
        entityType: "RESOURCE",
        entityId: deleted.id,
        action: "DELETE",
        changes: JSON.stringify({
          id: deleted.id,
          classId: deleted.classId,
          title: deleted.title,
          filePath: deleted.filePath,
          fileType: deleted.fileType,
        }),
      },
    })

    return deleted
  }
}
