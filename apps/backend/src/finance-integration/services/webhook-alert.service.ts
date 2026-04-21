import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface WebhookAttempt {
  at: number;
  ok: boolean;
  reason?: string;
}

@Injectable()
export class WebhookAlertService {
  private readonly logger = new Logger(WebhookAlertService.name);
  private readonly attempts: WebhookAttempt[] = [];

  constructor(private readonly config: ConfigService) {}

  recordAttempt(ok: boolean, reason?: string): void {
    const now = Date.now();
    this.attempts.push({ at: now, ok, reason });
    this.trim(now);

    const snapshot = this.getSnapshot();
    if (
      snapshot.total >= snapshot.minSamples &&
      snapshot.failureRate > snapshot.threshold
    ) {
      this.logger.error(
        JSON.stringify({
          ts: new Date(now).toISOString(),
          component: 'webhook-alert',
          alert: 'WEBHOOK_FAILURE_RATE_HIGH',
          failureRate: Number(snapshot.failureRate.toFixed(4)),
          threshold: snapshot.threshold,
          total: snapshot.total,
          failed: snapshot.failed,
          windowSeconds: snapshot.windowSeconds,
        }),
      );
    }
  }

  getSnapshot(): {
    total: number;
    failed: number;
    success: number;
    failureRate: number;
    threshold: number;
    minSamples: number;
    windowSeconds: number;
    critical: boolean;
  } {
    const now = Date.now();
    this.trim(now);

    const failed = this.attempts.filter((item) => !item.ok).length;
    const total = this.attempts.length;
    const success = total - failed;
    const failureRate = total > 0 ? failed / total : 0;
    const threshold = this.getNumber('WEBHOOK_FAILURE_RATE_THRESHOLD', 0.2);
    const minSamples = this.getNumber('WEBHOOK_ALERT_MIN_SAMPLES', 10);
    const windowSeconds = this.getNumber('WEBHOOK_ALERT_WINDOW_SECONDS', 300);

    return {
      total,
      failed,
      success,
      failureRate,
      threshold,
      minSamples,
      windowSeconds,
      critical: total >= minSamples && failureRate > threshold,
    };
  }

  private trim(now: number): void {
    const windowSeconds = this.getNumber('WEBHOOK_ALERT_WINDOW_SECONDS', 300);
    const from = now - windowSeconds * 1000;

    while (this.attempts.length > 0 && this.attempts[0].at < from) {
      this.attempts.shift();
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
