import { csvDocument, csvFormat, ExportLanguage } from '../common/csv';

export type AttendanceStudentRow = {
  name: string | null;
  enrollmentNumber: string | null;
  className: string | null;
  records: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  rate: number | null;
};

const HEADERS: Record<ExportLanguage, string[]> = {
  fr: [
    'Élève',
    'Matricule',
    'Classe',
    'Relevés',
    'Présent',
    'Retard',
    'Excusé',
    'Absent',
    'Taux de présence (%)',
  ],
  ht: [
    'Elèv',
    'Matrikil',
    'Klas',
    'Anrejistreman',
    'Prezan',
    'An reta',
    'Eskize',
    'Absan',
    'To prezans (%)',
  ],
  pt: [
    'Aluno',
    'Matrícula',
    'Turma',
    'Registros',
    'Presente',
    'Atraso',
    'Justificado',
    'Ausente',
    'Taxa de presença (%)',
  ],
  en: [
    'Student',
    'Enrollment',
    'Class',
    'Records',
    'Present',
    'Late',
    'Excused',
    'Absent',
    'Attendance rate (%)',
  ],
};

const FILE_PREFIX: Record<ExportLanguage, string> = {
  fr: 'presences',
  ht: 'prezans',
  pt: 'presencas',
  en: 'attendance',
};

export function attendanceFileName(language: ExportLanguage, now = new Date()) {
  return `${FILE_PREFIX[language]}-${now.toISOString().slice(0, 10)}.csv`;
}

/** One line per student and class, most absent students first. */
export function buildAttendanceCsv(
  rows: AttendanceStudentRow[],
  language: ExportLanguage,
) {
  const { separator, decimal } = csvFormat(language);
  return csvDocument(
    HEADERS[language],
    rows.map((row) => [
      row.name ?? '',
      row.enrollmentNumber ?? '',
      row.className ?? '',
      row.records,
      row.present,
      row.late,
      row.excused,
      row.absent,
      row.rate === null
        ? ''
        : (row.rate * 100).toFixed(1).replace('.', decimal),
    ]),
    separator,
  );
}
