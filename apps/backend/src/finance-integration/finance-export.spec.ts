import { describe, expect, it } from '@jest/globals';
import { buildPaymentsCsv, exportFileName } from './finance-export';
import { csvCell, normalizeExportLanguage } from '../common/csv';

describe('finance export helpers', () => {
  it('normalises the language and names the file', () => {
    expect(normalizeExportLanguage('ht')).toBe('ht');
    expect(normalizeExportLanguage('PT-br')).toBe('pt');
    expect(normalizeExportLanguage('de')).toBe('fr');
    expect(normalizeExportLanguage(undefined)).toBe('fr');
    expect(exportFileName('en', new Date('2026-11-21T12:00:00Z'))).toBe(
      'payments-2026-11-21.csv',
    );
    expect(exportFileName('ht').startsWith('peman-')).toBe(true);
  });

  it('quotes only when needed and blocks spreadsheet formulas', () => {
    expect(csvCell('plain', ';')).toBe('plain');
    expect(csvCell(null, ';')).toBe('');
    expect(csvCell(undefined, ';')).toBe('');
    expect(csvCell('a;b', ';')).toBe('"a;b"');
    expect(csvCell('a,b', ';')).toBe('a,b');
    expect(csvCell('a,b', ',')).toBe('"a,b"');
    expect(csvCell('say "hi"', ';')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak', ';')).toBe('"line\nbreak"');
    expect(csvCell('=HYPERLINK("http://evil")', ';')).toBe(
      '"\'=HYPERLINK(""http://evil"")"',
    );
    for (const start of ['+', '-', '@', '\t']) {
      expect(csvCell(`${start}1`, ';').startsWith("'")).toBe(true);
    }
  });

  it('writes Haitian Creole headers and statuses', () => {
    const csv = buildPaymentsCsv(
      [
        {
          id: 'p',
          receiptNumber: 'R',
          studentName: 'Jean',
          enrollmentNumber: 'E',
          amountHtg: 1500.5,
          status: 'OVERDUE',
          dueDate: new Date('2026-10-01T00:00:00Z'),
          paidDate: null,
          description: null,
          createdAt: new Date('2026-09-01T00:00:00Z'),
        },
      ],
      'ht',
    );
    const [header, row] = csv.slice(1).split('\r\n');
    expect(header.split(';')[0]).toBe('Resi');
    expect(row).toBe('R;Jean;E;1500,50;An reta;2026-10-01;;;2026-09-01;p');
  });
});
