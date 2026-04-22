import { Injectable } from '@nestjs/common';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

interface LedgerRecord {
  timestamp: string;
  transactionId: string;
  category:
    | 'mobile-money'
    | 'diaspora-remittance'
    | 'did-key'
    | 'guardian-tuition';
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
    category:
      | 'mobile-money'
      | 'diaspora-remittance'
      | 'did-key'
      | 'guardian-tuition',
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
