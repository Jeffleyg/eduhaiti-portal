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
