import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookAlertService } from '../finance-integration/services/webhook-alert.service';

export interface DependencyHealth {
  ok: boolean;
  latencyMs: number;
  endpoint?: string;
  reason?: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly webhookAlert: WebhookAlertService,
  ) {}

  async check() {
    const [db, moncash, natcash] = await Promise.all([
      this.checkDatabase(),
      this.checkProviderLatency('MONCASH'),
      this.checkProviderLatency('NATCASH'),
    ]);

    const webhook = this.webhookAlert.getSnapshot();
    const serverOk = db.ok && moncash.ok && natcash.ok;

    return {
      status: serverOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: db,
        providers: {
          moncash,
          natcash,
        },
      },
      webhookFailures: {
        total: webhook.total,
        failed: webhook.failed,
        success: webhook.success,
        failureRate: Number(webhook.failureRate.toFixed(4)),
        threshold: webhook.threshold,
        critical: webhook.critical,
        windowSeconds: webhook.windowSeconds,
      },
    };
  }

  private async checkDatabase(): Promise<DependencyHealth> {
    const start = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        ok: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        reason:
          error instanceof Error
            ? error.message
            : 'Database connectivity failed',
      };
    }
  }

  private async checkProviderLatency(
    providerPrefix: 'MONCASH' | 'NATCASH',
  ): Promise<DependencyHealth> {
    const endpoint =
      this.config.get<string>(`${providerPrefix}_HEALTHCHECK_URL`) ??
      this.config.get<string>(`${providerPrefix}_API_URL`) ??
      '';

    if (!endpoint) {
      return {
        ok: false,
        latencyMs: 0,
        reason: 'Provider endpoint not configured',
      };
    }

    const timeoutMs = this.getNumber('HEALTH_PROVIDER_TIMEOUT_MS', 2000);
    const controller = new AbortController();
    const start = Date.now();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
        signal: controller.signal,
      });

      return {
        ok: response.ok,
        latencyMs: Date.now() - start,
        endpoint,
        reason: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        endpoint,
        reason:
          error instanceof Error ? error.message : 'Provider request failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private getNumber(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    if (!raw) {
      return fallback;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
