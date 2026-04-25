import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { promises as fs } from 'fs';

interface BuildManifestInput {
  since?: string;
  classId?: string;
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
          'Nao encontramos turma ativa para este aluno. Solicite atualizacao junto a escola.',
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
        speechText:
          `Nao ha material recente para a turma ${currentClass.name}.`,
        lowBandwidthHints: {
          hasAudioFile: false,
          supportsIvr: true,
          supportsUssdTrigger: true,
        },
      };
    }

    const sizeBytes = await this.safeStat(latestResource.filePath);
    const hasAudioFile = latestResource.fileType.toLowerCase() === 'mp3';
    const summary = latestResource.description?.trim() || 'Sem resumo textual disponivel.';

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
      speechText: `Turma ${currentClass.name}. Aula: ${latestResource.title}. Resumo: ${summary}`,
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

    const changedResources = await this.prisma.resource.findMany({
      where: {
        classId: input.classId,
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
        ...(input.classId
          ? {
              changes: {
                contains: `"classId":"${input.classId}"`,
              },
            }
          : {}),
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    const deleted = deletedLogs
      .map((log) => {
        const parsed = this.safeParseJson(log.changes);
        const resourceId =
          typeof parsed?.id === 'string' ? parsed.id : log.entityId;

        if (!resourceId) {
          return null;
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

  private safeParseJson(value: string): Record<string, unknown> | null {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
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
