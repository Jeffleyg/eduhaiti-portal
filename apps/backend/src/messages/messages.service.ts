import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

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
