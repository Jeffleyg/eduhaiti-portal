import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecipients(userId: string, role: Role, schoolId?: string | null) {
    if (!userId) return [];
    const adminFilter = schoolId
      ? { role: Role.ADMIN, schoolId }
      : { role: Role.ADMIN };

    if (role === Role.TEACHER) {
      return this.prisma.user.findMany({
        where: {
          id: { not: userId },
          OR: [
            {
              role: Role.STUDENT,
              classesAttending: { some: { teacherId: userId } },
            },
            adminFilter,
          ],
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      });
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
            adminFilter,
          ],
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      });
    }

    return this.prisma.user.findMany({
      where: {
        id: { not: userId },
        isActive: true,
        ...(schoolId ? { schoolId } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      take: 200,
    });
  }

  async findReceivedBy(userId: string) {
    return this.prisma.message.findMany({
      where: { toId: userId },
      include: { from: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findSentBy(userId: string) {
    return this.prisma.message.findMany({
      where: { fromId: userId },
      include: { to: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async send(
    fromId: string,
    toId: string,
    subject: string,
    body: string,
    sender?: { role?: Role; schoolId?: string | null },
  ) {
    if (!fromId) {
      throw new ForbiddenException('Authentication required');
    }
    if (!toId || !body?.trim()) {
      throw new BadRequestException('Recipient and message body are required');
    }

    // Only allow messaging users the sender is entitled to see as recipients
    if (sender?.role && sender.role !== Role.OWNER) {
      const allowed = await this.listRecipients(
        fromId,
        sender.role,
        sender.schoolId,
      );
      if (!allowed.some((recipient) => recipient.id === toId)) {
        throw new ForbiddenException('You cannot message this user');
      }
    }

    return this.prisma.message.create({
      data: { fromId, toId, subject, body },
      include: {
        from: { select: { name: true } },
        to: { select: { name: true } },
      },
    });
  }
}
