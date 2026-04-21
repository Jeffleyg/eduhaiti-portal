import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { DiasporaRemittanceDto } from '../dto/diaspora-remittance.dto';

@Injectable()
export class WebhookSignatureService {
  constructor(private readonly config: ConfigService) {}

  verifyDiasporaSignature(
    payload: DiasporaRemittanceDto,
    providedSignature?: string,
    providedTimestamp?: string,
  ): boolean {
    const secret = this.config.get<string>('DIASPORA_WEBHOOK_SECRET');
    if (!secret || !providedSignature || !providedTimestamp) {
      return false;
    }

    const maxSkewSeconds = Number(
      this.config.get<string>('DIASPORA_WEBHOOK_MAX_SKEW_SECONDS') ?? '300',
    );

    if (!this.isTimestampWithinSkew(providedTimestamp, maxSkewSeconds)) {
      return false;
    }

    const message = `${providedTimestamp}.${JSON.stringify(payload)}`;
    const digest = createHmac('sha256', secret).update(message).digest();
    const expectedHex = digest.toString('hex');
    const expectedBase64 = digest.toString('base64');
    const normalizedProvided = this.normalizeSignature(providedSignature);

    return (
      this.secureCompare(normalizedProvided.toLowerCase(), expectedHex) ||
      this.secureCompare(normalizedProvided, expectedBase64)
    );
  }

  private normalizeSignature(signature: string): string {
    const value = signature.trim();
    if (!value.includes('=')) {
      return value;
    }

    const [, normalized] = value.split('=', 2);
    return normalized ?? value;
  }

  private isTimestampWithinSkew(
    rawTimestamp: string,
    maxSkewSeconds: number,
  ): boolean {
    const parsed = Number(rawTimestamp);
    if (!Number.isFinite(parsed)) {
      return false;
    }

    const timestampMs = parsed > 1_000_000_000_000 ? parsed : parsed * 1000;
    const skewMs = Math.abs(Date.now() - timestampMs);
    return skewMs <= maxSkewSeconds * 1000;
  }

  private secureCompare(valueA: string, valueB: string): boolean {
    const a = Buffer.from(valueA);
    const b = Buffer.from(valueB);

    if (a.length !== b.length) {
      return false;
    }

    return timingSafeEqual(a, b);
  }
}
