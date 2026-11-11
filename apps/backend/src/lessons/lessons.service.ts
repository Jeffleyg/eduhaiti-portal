import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClassAccessService, ClassRequester } from '../prisma/class-access.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly classAccess: ClassAccessService,
  ) {}

  async createPlan(payload: LessonPlanPayload, requester: ClassRequester) {
    if (!payload.title?.trim() || !payload.date?.trim()) {
      throw new BadRequestException('title and date are required');
    }
    // Same rule as every other class write: own class for teachers, own school for admins.
    const classRow = await this.classAccess.assertCanManageClass(payload.classId, requester);

    const plan = await this.prisma.auditLog.create({
      data: buildAuditData({
        entityType: 'LESSON_PLAN',
        entityId: payload.classId,
        action: 'PUBLISH',
        userId: requester.sub,
        changes: {
          classId: payload.classId,
          schoolId: classRow.academicYear.schoolId,
          date: payload.date.trim(),
          title: payload.title.trim(),
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

  /**
   * Shared lesson bank. Callers pass the school they belong to (undefined only for the
   * owner). Plans marked CLASS stay private to their class unless the viewer wrote them
   * or is browsing that very class.
   */
  async listRepository(params: {
    teacherId?: string;
    schoolId?: string;
    classId?: string;
    query?: string;
    viewerId?: string;
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

        const privateToOtherClass =
          row.visibility === 'CLASS' &&
          row.createdById !== params.viewerId &&
          row.classId !== params.classId;
        if (privateToOtherClass) {
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
