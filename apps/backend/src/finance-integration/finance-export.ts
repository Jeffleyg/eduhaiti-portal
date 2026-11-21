import { PaymentStatus } from '@prisma/client';
import { csvDocument, csvFormat, ExportLanguage, isoDay } from '../common/csv';

export type PaymentExportRow = {
  id: string;
  receiptNumber: string | null;
  studentName: string | null;
  enrollmentNumber: string | null;
  amountHtg: number;
  status: PaymentStatus;
  dueDate: Date;
  paidDate: Date | null;
  description: string | null;
  createdAt: Date;
};

const HEADERS: Record<ExportLanguage, string[]> = {
  fr: [
    'Reçu',
    'Élève',
    'Matricule',
    'Montant (HTG)',
    'Statut',
    'Échéance',
    'Payé le',
    'Description',
    'Créé le',
    'ID paiement',
  ],
  ht: [
    'Resi',
    'Elèv',
    'Matrikil',
    'Montan (HTG)',
    'Estati',
    'Dat limit',
    'Peye le',
    'Deskripsyon',
    'Kreye le',
    'ID peman',
  ],
  pt: [
    'Recibo',
    'Aluno',
    'Matrícula',
    'Valor (HTG)',
    'Situação',
    'Vencimento',
    'Pago em',
    'Descrição',
    'Criado em',
    'ID do pagamento',
  ],
  en: [
    'Receipt',
    'Student',
    'Enrollment',
    'Amount (HTG)',
    'Status',
    'Due date',
    'Paid on',
    'Description',
    'Created on',
    'Payment ID',
  ],
};

const STATUS: Record<ExportLanguage, Record<PaymentStatus, string>> = {
  fr: {
    PENDING: 'En attente',
    PARTIAL: 'Partiel',
    PAID: 'Payé',
    OVERDUE: 'En retard',
  },
  ht: {
    PENDING: 'An atant',
    PARTIAL: 'Pasyèl',
    PAID: 'Peye',
    OVERDUE: 'An reta',
  },
  pt: {
    PENDING: 'Pendente',
    PARTIAL: 'Parcial',
    PAID: 'Pago',
    OVERDUE: 'Atrasado',
  },
  en: {
    PENDING: 'Pending',
    PARTIAL: 'Partial',
    PAID: 'Paid',
    OVERDUE: 'Overdue',
  },
};

const FILE_PREFIX: Record<ExportLanguage, string> = {
  fr: 'paiements',
  ht: 'peman',
  pt: 'pagamentos',
  en: 'payments',
};

export function exportFileName(language: ExportLanguage, now = new Date()) {
  return `${FILE_PREFIX[language]}-${now.toISOString().slice(0, 10)}.csv`;
}

/**
 * Spreadsheet-ready CSV: UTF-8 BOM (accents display correctly in Excel), and
 * the separator / decimal mark Excel expects for the language's region
 * (";" and "," for fr/ht/pt, "," and "." for en).
 */
export function buildPaymentsCsv(
  rows: PaymentExportRow[],
  language: ExportLanguage,
) {
  const { separator, decimal } = csvFormat(language);
  return csvDocument(
    HEADERS[language],
    rows.map((row) => [
      row.receiptNumber ?? '',
      row.studentName ?? '',
      row.enrollmentNumber ?? '',
      row.amountHtg.toFixed(2).replace('.', decimal),
      STATUS[language][row.status] ?? row.status,
      isoDay(row.dueDate),
      isoDay(row.paidDate),
      row.description ?? '',
      isoDay(row.createdAt),
      row.id,
    ]),
    separator,
  );
}
