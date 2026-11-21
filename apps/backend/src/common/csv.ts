/** Spreadsheet (CSV) helpers shared by every export. */

export const EXPORT_LANGUAGES = ['fr', 'ht', 'pt', 'en'] as const;
export type ExportLanguage = (typeof EXPORT_LANGUAGES)[number];

export function normalizeExportLanguage(value?: string): ExportLanguage {
  const short = (value ?? '').slice(0, 2).toLowerCase();
  return (EXPORT_LANGUAGES as readonly string[]).includes(short)
    ? (short as ExportLanguage)
    : 'fr';
}

/** Separator and decimal mark Excel expects in the language's region. */
export function csvFormat(language: ExportLanguage) {
  return language === 'en'
    ? { separator: ',', decimal: '.' }
    : { separator: ';', decimal: ',' };
}

/**
 * Quotes a cell and neutralises spreadsheet formulas (CSV injection): a value
 * starting with = + - @ or a control character is prefixed with an apostrophe.
 */
export function csvCell(
  value: string | number | null | undefined,
  separator: string,
): string {
  let raw = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(raw)) raw = `'${raw}`;
  const needsQuotes = /["\n\r]/.test(raw) || raw.includes(separator);
  return needsQuotes ? `"${raw.replace(/"/g, '""')}"` : raw;
}

// Byte order mark: makes Excel read the file as UTF-8 (accents).
const BOM = String.fromCharCode(0xfeff);

/** Full CSV document: BOM, header line, rows, Windows line endings. */
export function csvDocument(
  header: string[],
  rows: Array<Array<string | number | null | undefined>>,
  separator: string,
) {
  const lines = [header, ...rows].map((cells) =>
    cells.map((cell) => csvCell(cell, separator)).join(separator),
  );
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

export const isoDay = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : '';
