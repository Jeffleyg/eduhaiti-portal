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
    return this.signatureCandidates(providedSignature).some(
      (candidate) =>
        this.secureCompare(candidate.toLowerCase(), expectedHex) ||
        this.secureCompare(candidate, expectedBase64),
    );
  }

  /**
   * Accepts raw signatures and "scheme=signature" forms (e.g. "sha256=<hex>").
   * The raw value is always tried too, because base64 digests end with "="
   * padding and must not be split.
   */
  private signatureCandidates(signature: string): string[] {
    const value = signature.trim();
    const separator = value.indexOf('=');
    const withoutScheme = separator >= 0 ? value.slice(separator + 1) : '';
    return withoutScheme ? [value, withoutScheme] : [value];
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
