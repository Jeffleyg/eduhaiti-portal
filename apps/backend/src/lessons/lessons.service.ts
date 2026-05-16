import { ForbiddenException, Injectable, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildAuditData, safeParseJson } from '../common/audit-compat';

type LessonPlanPayload = {
  classId: string;
  date: string;
  title: string;
  objectives?: string;
  content?: string;
  methodology?: string;
  visibility?: 'CLASS' | 'SCHOOL';
  tags?: string[];
};

@Injectable()
export class LessonsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPlan(
    payload: LessonPlanPayload,
    requester: { id: string; role: Role },
  ) {
    const classRow = await this.prisma.class.findUnique({
      where: { id: payload.classId },
      select: {
        id: true,
        teacherId: true,
        academicYear: {
          select: {
            schoolId: true,
          },
        },
      },
    });

    if (!classRow) {
      throw new ForbiddenException('Class not found');
    }

    if (
      requester.role === Role.TEACHER &&
      classRow.teacherId &&
      classRow.teacherId !== requester.id
    ) {
      throw new ForbiddenException(
        'Teacher can only create lesson plans for own classes',
      );
    }

    const plan = await this.prisma.auditLog.create({
      data: buildAuditData({
        entityType: 'LESSON_PLAN',
        entityId: payload.classId,
        action: 'PUBLISH',
        userId: requester.id,
        changes: {
          classId: payload.classId,
          schoolId: classRow.academicYear.schoolId,
          date: payload.date,
          title: payload.title,
          objectives: payload.objectives ?? null,
          content: payload.content ?? null,
          methodology: payload.methodology ?? null,
          visibility: payload.visibility ?? 'SCHOOL',
          tags: payload.tags ?? [],
        },
      }),
    });

    return {
      id: plan.id,
      createdAt: plan.createdAt,
      ...this.parseLessonPlanChanges(plan.changes),
      createdById: plan.userId,
    };
  }

  async listByClass(classId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'LESSON_PLAN',
        entityId: classId,
        action: 'PUBLISH',
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const userIds = rows
      .map((row) => row.userId)
      .filter((item): item is string => Boolean(item));
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      createdBy: row.userId ? usersById.get(row.userId) ?? null : null,
      ...this.parseLessonPlanChanges(row.changes),
    }));
  }

  async listRepository(params: {
    teacherId?: string;
    schoolId?: string;
    classId?: string;
    query?: string;
  }) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'LESSON_PLAN',
        action: 'PUBLISH',
        ...(params.classId ? { entityId: params.classId } : {}),
        ...(params.teacherId ? { userId: params.teacherId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const parsed = rows
      .map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        createdById: row.userId,
        ...this.parseLessonPlanChanges(row.changes),
      }))
      .filter((row) => {
        if (params.schoolId && row.schoolId !== params.schoolId) {
          return false;
        }

        if (!params.query) {
          return true;
        }

        const q = params.query.toLowerCase();
        const haystack = [
          row.title,
          row.objectives,
          row.content,
          row.methodology,
          ...(row.tags ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });

    const classIds = Array.from(
      new Set(parsed.map((row) => row.classId).filter(Boolean)),
    );
    const teacherIds = Array.from(
      new Set(parsed.map((row) => row.createdById).filter(Boolean)),
    ) as string[];

    const [classes, teachers] = await Promise.all([
      classIds.length > 0
        ? this.prisma.class.findMany({
            where: { id: { in: classIds } },
            select: {
              id: true,
              name: true,
              series: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve([]),
      teacherIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: teacherIds } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
    ]);

    const classesById = new Map(
      classes.map((item) => [item.id, item] as const),
    );
    const teachersById = new Map(
      teachers.map((item) => [item.id, item] as const),
    );

    return parsed.map((row) => ({
      ...row,
      class: classesById.get(row.classId) ?? null,
      createdBy: row.createdById ? teachersById.get(row.createdById) : null,
    }));
  }

  private parseLessonPlanChanges(changes: unknown): {
    classId: string;
    schoolId?: string;
    date: string;
    title: string;
    objectives?: string;
    content?: string;
    methodology?: string;
    visibility: 'CLASS' | 'SCHOOL';
    tags: string[];
  } {
    try {
      const raw = safeParseJson<Partial<LessonPlanPayload> & { schoolId?: string }>(
        changes,
      );
      if (!raw) throw new BadRequestException('Invalid lesson plan data');
      return {
        classId: String(raw.classId ?? ''),
        schoolId: raw.schoolId,
        date: String(raw.date ?? ''),
        title: String(raw.title ?? ''),
        objectives: raw.objectives ? String(raw.objectives) : undefined,
        content: raw.content ? String(raw.content) : undefined,
        methodology: raw.methodology ? String(raw.methodology) : undefined,
        visibility: raw.visibility === 'CLASS' ? 'CLASS' : 'SCHOOL',
        tags: Array.isArray(raw.tags)
          ? raw.tags.map((item) => String(item))
          : [],
      };
    } catch {
      return {
        classId: '',
        date: '',
        title: '',
        visibility: 'SCHOOL',
        tags: [],
      };
    }
  }
}
