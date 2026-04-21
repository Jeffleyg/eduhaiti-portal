import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { Role } from "@prisma/client"

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecipients(userId: string, role: Role) {
    if (!userId) return []

    if (role === Role.TEACHER) {
      return this.prisma.user.findMany({
        where: {
          id: { not: userId },
          OR: [
            {
              role: Role.STUDENT,
              classesAttending: { some: { teacherId: userId } },
            },
            { role: Role.ADMIN },
          ],
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      })
    }

    if (role === Role.STUDENT) {
      return this.prisma.user.findMany({
        where: {
          id: { not: userId },
          OR: [
            {
              role: Role.TEACHER,
              classesTeaching: {
                some: {
                  students: {
                    some: { id: userId },
                  },
                },
              },
            },
            { role: Role.ADMIN },
          ],
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      })
    }

    return this.prisma.user.findMany({
      where: {
        id: { not: userId },
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take: 200,
    })
  }

  async findReceivedBy(userId: string) {
    return this.prisma.message.findMany({
      where: { toId: userId },
      include: { from: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  }

  async findSentBy(userId: string) {
    return this.prisma.message.findMany({
      where: { fromId: userId },
      include: { to: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  }

  async send(fromId: string, toId: string, subject: string, body: string) {
    return this.prisma.message.create({
      data: { fromId, toId, subject, body },
      include: { from: { select: { name: true } }, to: { select: { name: true } } },
    })
  }
}
