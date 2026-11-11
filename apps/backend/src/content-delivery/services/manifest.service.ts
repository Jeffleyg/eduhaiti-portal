import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { safeParseJson as auditSafeParseJson } from '../../common/audit-compat';
import { promises as fs } from 'fs';

interface BuildManifestInput {
  since?: string;
  /** Classes the caller may see; undefined means every class (platform owner). */
  classIds?: string[];
}

@Injectable()
export class ManifestService {
  constructor(private readonly prisma: PrismaService) {}

  async buildLessonAudioSummary(studentId: string): Promise<{
    studentId: string;
    classId: string | null;
    className: string | null;
    resource: {
      id: string;
      title: string;
      description: string | null;
      fileType: string;
      filePath: string;
      updatedAt: string;
      sizeBytes: number | null;
    } | null;
    speechText: string;
    lowBandwidthHints: {
      hasAudioFile: boolean;
      supportsIvr: boolean;
      supportsUssdTrigger: boolean;
    };
  }> {
    const currentClass = await this.prisma.class.findFirst({
      where: {
        students: {
          some: { id: studentId },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!currentClass) {
      return {
        studentId,
        classId: null,
        className: null,
        resource: null,
        speechText:
          'Nou pa jwenn okenn klas aktif pou elèv sa a. Tanpri kontakte lekòl la.',
        lowBandwidthHints: {
          hasAudioFile: false,
          supportsIvr: true,
          supportsUssdTrigger: true,
        },
      };
    }

    const latestResource = await this.prisma.resource.findFirst({
      where: {
        classId: currentClass.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        fileType: true,
        filePath: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!latestResource) {
      return {
        studentId,
        classId: currentClass.id,
        className: currentClass.name,
        resource: null,
        speechText: `Pa gen nouvo materyèl pou klas ${currentClass.name}.`,
        lowBandwidthHints: {
          hasAudioFile: false,
          supportsIvr: true,
          supportsUssdTrigger: true,
        },
      };
    }

    const sizeBytes = await this.safeStat(latestResource.filePath);
    const hasAudioFile = latestResource.fileType.toLowerCase() === 'mp3';
    const summary =
      latestResource.description?.trim() || 'Pa gen rezime disponib.';

    return {
      studentId,
      classId: currentClass.id,
      className: currentClass.name,
      resource: {
        id: latestResource.id,
        title: latestResource.title,
        description: latestResource.description,
        fileType: latestResource.fileType,
        filePath: latestResource.filePath,
        updatedAt: latestResource.updatedAt.toISOString(),
        sizeBytes,
      },
      speechText: `Klas ${currentClass.name}. Leson: ${latestResource.title}. Rezime: ${summary}`,
      lowBandwidthHints: {
        hasAudioFile,
        supportsIvr: true,
        supportsUssdTrigger: true,
      },
    };
  }

  async buildDeltaManifest(input: BuildManifestInput): Promise<{
    serverTime: string;
    since: string | null;
    changed: Array<{
      id: string;
      classId: string;
      title: string;
      description: string | null;
      filePath: string;
      fileType: string;
      updatedAt: string;
      sizeBytes: number | null;
    }>;
    deleted: Array<{ id: string; deletedAt: string }>;
  }> {
    const since = this.parseSince(input.since);

    const visibleClasses = input.classIds ? new Set(input.classIds) : null;

    const changedResources = await this.prisma.resource.findMany({
      where: {
        ...(input.classIds ? { classId: { in: input.classIds } } : {}),
        ...(since ? { updatedAt: { gt: since } } : {}),
      },
      orderBy: { updatedAt: 'asc' },
    });

    const changed = await Promise.all(
      changedResources.map(async (resource) => ({
        id: resource.id,
        classId: resource.classId,
        title: resource.title,
        description: resource.description,
        filePath: resource.filePath,
        fileType: resource.fileType,
        updatedAt: resource.updatedAt.toISOString(),
        sizeBytes: await this.safeStat(resource.filePath),
      })),
    );

    const deletedLogs = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'RESOURCE',
        action: 'DELETE',
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    const deleted = deletedLogs
      .map((log) => {
        const parsed = auditSafeParseJson(log.changes);
        const resourceId =
          typeof parsed?.id === 'string' ? parsed.id : log.entityId;

        if (!resourceId) {
          return null;
        }

        if (visibleClasses) {
          const classIdFromPayload =
            typeof parsed?.classId === 'string' ? parsed.classId : null;
          // Unknown class: do not reveal it to a scoped caller.
          if (!classIdFromPayload || !visibleClasses.has(classIdFromPayload)) {
            return null;
          }
        }

        return {
          id: resourceId,
          deletedAt: log.createdAt.toISOString(),
        };
      })
      .filter(
        (item): item is { id: string; deletedAt: string } => item !== null,
      );

    return {
      serverTime: new Date().toISOString(),
      since: since ? since.toISOString() : null,
      changed,
      deleted,
    };
  }

  private parseSince(since?: string): Date | null {
    if (!since) {
      return null;
    }

    const parsed = new Date(since);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private async safeStat(filePath: string): Promise<number | null> {
    try {
      const stat = await fs.stat(filePath);
      return stat.size;
    } catch {
      return null;
    }
  }
}
