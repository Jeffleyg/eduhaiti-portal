import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { Role } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"

type Requester = {
  id: string
  role: Role
}

type ThreadPayload = {
  threadId: string
  classId: string
  title: string
  body: string
}

type PostPayload = {
  postId: string
  threadId: string
  classId: string
  body: string
}

@Injectable()
export class ForumsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseJson<T>(value: string): T | null {
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }

  private async ensureClassAccess(classId: string, requester: Requester) {
    if (requester.role === Role.ADMIN) {
      return
    }

    const cls = await this.prisma.class.findFirst({
      where: {
        id: classId,
        OR: [
          { teacherId: requester.id },
          { students: { some: { id: requester.id } } },
        ],
      },
      select: { id: true },
    })

    if (!cls) {
      throw new ForbiddenException("You do not have access to this class forum")
    }
  }

  async listThreads(classId: string, requester: Requester) {
    await this.ensureClassAccess(classId, requester)

    const rows = await this.prisma.auditLog.findMany({
      where: {
        entityType: "FORUM_THREAD",
        action: "CREATE",
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    const parsed = rows
      .map((row) => {
        const payload = this.parseJson<ThreadPayload>(row.changes)
        if (!payload || payload.classId !== classId) {
          return null
        }

        return {
          id: payload.threadId,
          classId: payload.classId,
          title: payload.title,
          body: payload.body,
          createdAt: row.createdAt,
          createdById: row.userId,
        }
      })
      .filter(
        (item): item is { id: string; classId: string; title: string; body: string; createdAt: Date; createdById: string | null } =>
          item !== null,
      )

    const userIds = [...new Set(parsed.map((item) => item.createdById).filter(Boolean))] as string[]
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : []

    const userMap = new Map(users.map((user) => [user.id, user]))

    const postCounts = await this.prisma.auditLog.groupBy({
      by: ["entityId"],
      where: {
        entityType: "FORUM_POST",
        action: "CREATE",
        entityId: { in: parsed.map((item) => item.id) },
      },
      _count: { _all: true },
    })

    const postCountMap = new Map(postCounts.map((item) => [item.entityId, item._count._all]))

    return parsed.map((item) => ({
      ...item,
      createdBy: item.createdById ? userMap.get(item.createdById) ?? null : null,
      postsCount: postCountMap.get(item.id) ?? 0,
    }))
  }

  async createThread(classId: string, body: { title: string; body: string }, requester: Requester) {
    await this.ensureClassAccess(classId, requester)

    const title = body.title?.trim()
    const content = body.body?.trim()

    if (!title || !content) {
      throw new BadRequestException("title and body are required")
    }

    const threadId = crypto.randomUUID()
    await this.prisma.auditLog.create({
      data: {
        entityType: "FORUM_THREAD",
        entityId: threadId,
        action: "CREATE",
        userId: requester.id,
        changes: JSON.stringify({
          threadId,
          classId,
          title,
          body: content,
        }),
      },
    })

    return {
      id: threadId,
      classId,
      title,
      body: content,
    }
  }

  private async getThread(threadId: string) {
    const row = await this.prisma.auditLog.findFirst({
      where: {
        entityType: "FORUM_THREAD",
        entityId: threadId,
        action: "CREATE",
      },
      orderBy: { createdAt: "asc" },
    })

    if (!row) {
      throw new NotFoundException("Forum thread not found")
    }

    const payload = this.parseJson<ThreadPayload>(row.changes)
    if (!payload) {
      throw new NotFoundException("Forum thread payload is invalid")
    }

    return {
      row,
      payload,
    }
  }

  async listPosts(threadId: string, requester: Requester) {
    const thread = await this.getThread(threadId)
    await this.ensureClassAccess(thread.payload.classId, requester)

    const rows = await this.prisma.auditLog.findMany({
      where: {
        entityType: "FORUM_POST",
        entityId: threadId,
        action: "CREATE",
      },
      orderBy: { createdAt: "asc" },
      take: 1000,
    })

    const posts = rows
      .map((row) => {
        const payload = this.parseJson<PostPayload>(row.changes)
        if (!payload) {
          return null
        }

        return {
          id: payload.postId,
          threadId: payload.threadId,
          classId: payload.classId,
          body: payload.body,
          createdAt: row.createdAt,
          createdById: row.userId,
        }
      })
      .filter(
        (item): item is { id: string; threadId: string; classId: string; body: string; createdAt: Date; createdById: string | null } =>
          item !== null,
      )

    const userIds = [...new Set(posts.map((item) => item.createdById).filter(Boolean))] as string[]
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : []

    const userMap = new Map(users.map((user) => [user.id, user]))

    return {
      thread: {
        id: thread.payload.threadId,
        classId: thread.payload.classId,
        title: thread.payload.title,
        body: thread.payload.body,
        createdAt: thread.row.createdAt,
        createdById: thread.row.userId,
      },
      posts: posts.map((post) => ({
        ...post,
        createdBy: post.createdById ? userMap.get(post.createdById) ?? null : null,
      })),
    }
  }

  async createPost(threadId: string, body: { body: string }, requester: Requester) {
    const thread = await this.getThread(threadId)
    await this.ensureClassAccess(thread.payload.classId, requester)

    const content = body.body?.trim()
    if (!content) {
      throw new BadRequestException("body is required")
    }

    const postId = crypto.randomUUID()
    await this.prisma.auditLog.create({
      data: {
        entityType: "FORUM_POST",
        entityId: threadId,
        action: "CREATE",
        userId: requester.id,
        changes: JSON.stringify({
          postId,
          threadId,
          classId: thread.payload.classId,
          body: content,
        }),
      },
    })

    return {
      id: postId,
      threadId,
      classId: thread.payload.classId,
      body: content,
    }
  }
}
