import { Injectable } from '@nestjs/common';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

export type LedgerCategory =
  | 'mobile-money'
  | 'diaspora-remittance'
  | 'did-key'
  | 'guardian-tuition'
  | 'tuition-charge'
  | 'installment-plan'
  | 'finance-audit-report';

export interface LedgerRecord {
  timestamp: string;
  transactionId: string;
  category: LedgerCategory;
  payload: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

@Injectable()
export class ImmutableLedgerService {
  private readonly ledgerPath = join(
    process.cwd(),
    'uploads',
    'finance',
    'ledger.ndjson',
  );

  async append(
    transactionId: string,
    category: LedgerCategory,
    payload: Record<string, unknown>,
  ): Promise<LedgerRecord> {
    await mkdir(dirname(this.ledgerPath), { recursive: true });

    const previousHash = await this.getLastHash();
    const timestamp = new Date().toISOString();
    const normalizedPayload = JSON.stringify(payload);
    const hash = createHash('sha256')
      .update(
        `${previousHash}|${timestamp}|${transactionId}|${category}|${normalizedPayload}`,
      )
      .digest('hex');

    const record: LedgerRecord = {
      timestamp,
      transactionId,
      category,
      payload,
      previousHash,
      hash,
    };

    await appendFile(this.ledgerPath, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  async readAll(): Promise<LedgerRecord[]> {
    try {
      const raw = await readFile(this.ledgerPath, 'utf8');
      const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      return lines
        .map((line) => {
          try {
            return JSON.parse(line) as LedgerRecord;
          } catch {
            return null;
          }
        })
        .filter((item): item is LedgerRecord => Boolean(item));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }

      throw error;
    }
  }

  verifyChain(records: LedgerRecord[]): {
    valid: boolean;
    brokenAtIndex: number | null;
  } {
    let expectedPreviousHash = 'GENESIS';

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (record.previousHash !== expectedPreviousHash) {
        return { valid: false, brokenAtIndex: index };
      }

      const computedHash = createHash('sha256')
        .update(
          `${record.previousHash}|${record.timestamp}|${record.transactionId}|${record.category}|${JSON.stringify(record.payload)}`,
        )
        .digest('hex');

      if (computedHash !== record.hash) {
        return { valid: false, brokenAtIndex: index };
      }

      expectedPreviousHash = record.hash;
    }

    return { valid: true, brokenAtIndex: null };
  }

  async buildFinancialTransparencyReport(filters?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{
    generatedAt: string;
    totalRecords: number;
    integrity: {
      valid: boolean;
      brokenAtIndex: number | null;
    };
    byCategory: Record<string, number>;
    lastHash: string;
    records: Array<LedgerRecord & { index: number }>;
  }> {
    const allRecords = await this.readAll();
    const startDate = filters?.startDate ? new Date(filters.startDate) : null;
    const endDate = filters?.endDate ? new Date(filters.endDate) : null;
    const limit = Math.max(1, Math.min(filters?.limit ?? 200, 2000));

    const filtered = allRecords.filter((record) => {
      const ts = new Date(record.timestamp);
      if (Number.isNaN(ts.getTime())) {
        return false;
      }
      if (startDate && ts < startDate) {
        return false;
      }
      if (endDate && ts > endDate) {
        return false;
      }

      return true;
    });

    const integrity = this.verifyChain(allRecords);
    const byCategory = filtered.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1;
      return acc;
    }, {});

    const startIndex = slicedOffset(filtered.length, limit);
    const sliced = filtered.slice(-limit).map((record, idx) => ({
      ...record,
      index: startIndex + idx,
    }));

    return {
      generatedAt: new Date().toISOString(),
      totalRecords: filtered.length,
      integrity,
      byCategory,
      lastHash: allRecords[allRecords.length - 1]?.hash ?? 'GENESIS',
      records: sliced,
    };
  }

  private async getLastHash(): Promise<string> {
    try {
      const raw = await readFile(this.ledgerPath, 'utf8');
      const lines = raw.trim().split('\n');

      if (lines.length === 0 || !lines[lines.length - 1]) {
        return 'GENESIS';
      }

      const last = JSON.parse(lines[lines.length - 1]) as Partial<LedgerRecord>;
      return last.hash ?? 'GENESIS';
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return 'GENESIS';
      }

      throw error;
    }
  }
}

function slicedOffset(total: number, limit: number): number {
  return total > limit ? total - limit : 0;
}
