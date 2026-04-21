import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FxConversionResult {
  sourceCurrency: 'USD' | 'EUR';
  sourceAmount: number;
  fxRateToHtg: number;
  grossHtg: number;
  spreadPercent: number;
  platformFeePercent: number;
  spreadAmountHtg: number;
  platformFeeAmountHtg: number;
  netHtg: number;
}

@Injectable()
export class ExchangeRateService {
  constructor(private readonly config: ConfigService) {}

  async convertToHtg(
    amount: number,
    currency: 'USD' | 'EUR',
  ): Promise<FxConversionResult> {
    const rate = await this.resolveRateToHtg(currency);
    const spreadPercent = this.getNumber('FX_SPREAD_PERCENT', 0.0125);
    const platformFeePercent = this.getNumber('FX_PLATFORM_FEE_PERCENT', 0.005);

    const grossHtg = Number((amount * rate).toFixed(2));
    const spreadAmountHtg = Number((grossHtg * spreadPercent).toFixed(2));
    const platformFeeAmountHtg = Number(
      (grossHtg * platformFeePercent).toFixed(2),
    );
    const netHtg = Number(
      (grossHtg - spreadAmountHtg - platformFeeAmountHtg).toFixed(2),
    );

    return {
      sourceCurrency: currency,
      sourceAmount: amount,
      fxRateToHtg: rate,
      grossHtg,
      spreadPercent,
      platformFeePercent,
      spreadAmountHtg,
      platformFeeAmountHtg,
      netHtg,
    };
  }

  private async resolveRateToHtg(currency: 'USD' | 'EUR'): Promise<number> {
    const fallbackRate = this.getFallbackRate(currency);
    const endpoint = this.config.get<string>('FX_RATE_API_URL');

    if (!endpoint) {
      return fallbackRate;
    }

    const timeoutMs = this.getNumber('FX_RATE_TIMEOUT_MS', 2000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return fallbackRate;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const directKey = `${currency}_TO_HTG`;
      const rate = this.readNumber(payload[directKey]);

      if (rate !== null) {
        return rate;
      }

      const nested = payload.rates;
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const nestedRate = this.readNumber(
          (nested as Record<string, unknown>)[directKey],
        );
        if (nestedRate !== null) {
          return nestedRate;
        }
      }

      return fallbackRate;
    } catch {
      return fallbackRate;
    } finally {
      clearTimeout(timeout);
    }
  }

  private getFallbackRate(currency: 'USD' | 'EUR'): number {
    return currency === 'USD'
      ? this.getNumber('FX_USD_TO_HTG_RATE', 132.0)
      : this.getNumber('FX_EUR_TO_HTG_RATE', 143.5);
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
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
