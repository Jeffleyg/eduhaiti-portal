import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MobileMoneyChargeRequest,
  MobileMoneyChargeResult,
  MobileMoneyProvider,
} from '../interfaces/mobile-money.interface';

@Injectable()
export class NatCashProvider implements MobileMoneyProvider {
  readonly name = 'natcash' as const;

  constructor(private readonly config: ConfigService) {}

  async processCharge(
    request: MobileMoneyChargeRequest,
  ): Promise<MobileMoneyChargeResult> {
    const endpoint = this.config.get<string>('NATCASH_API_URL');
    const apiKey = this.config.get<string>('NATCASH_API_KEY');
    const timeoutMs = Number(
      this.config.get<string>('NATCASH_TIMEOUT_MS') ?? '4500',
    );
    const fallbackFeePercent = Number(
      this.config.get<string>('NATCASH_FEE_PERCENT') ?? '0.0085',
    );

    if (!endpoint || !apiKey) {
      throw new ServiceUnavailableException(
        'NatCash provider configuration missing',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          reference: request.externalReference,
          accountNumber: request.accountNumber,
          amountHtg: request.amountHtg,
          narration: request.narration,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BadGatewayException(
          `NatCash rejected charge (${response.status})`,
        );
      }

      const data = (await response.json()) as Record<string, unknown>;
      const approved = this.readApproved(data);
      const feeAmountHtg = this.readNumber(
        data,
        ['feeAmountHtg', 'fee', 'providerFee'],
        Number((request.amountHtg * fallbackFeePercent).toFixed(2)),
      );
      const netAmountHtg = this.readNumber(
        data,
        ['netAmountHtg', 'netAmount', 'creditedAmountHtg'],
        Number((request.amountHtg - feeAmountHtg).toFixed(2)),
      );
      const providerTransactionId = this.readString(data, [
        'providerTransactionId',
        'transactionId',
        'id',
      ]);

      return {
        approved,
        providerName: this.name,
        providerTransactionId:
          providerTransactionId || `NAT-${request.externalReference}`,
        netAmountHtg,
        feeAmountHtg,
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException('NatCash provider unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  private readApproved(payload: Record<string, unknown>): boolean {
    const direct = payload.approved;
    if (typeof direct === 'boolean') {
      return direct;
    }

    const status = this.readString(payload, ['status', 'state']);
    return ['approved', 'success', 'succeeded', 'ok'].includes(
      status.toLowerCase(),
    );
  }

  private readString(payload: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return '';
  }

  private readNumber(
    payload: Record<string, unknown>,
    keys: string[],
    fallback: number,
  ): number {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return Number(value.toFixed(2));
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return Number(parsed.toFixed(2));
        }
      }
    }

    return fallback;
  }
}
