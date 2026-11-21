import autoTable from "jspdf-autotable"
import { drawSummaryBoxes, finishReportPdf, rangeLabel, startReportPdf, TABLE_STYLE } from "./pdfReport.js"

export const percent = (rate) => (rate === null || rate === undefined ? "–" : `${Math.round(rate * 100)} %`)

export function attendancePeriodLabel(period, t) {
  return rangeLabel(period ?? {}, t, {
    range: "financePeriodRange",
    from: "financePeriodFrom",
    until: "financePeriodUntil",
    all: "attendancePeriodAll",
  })
}

/**
 * Printable attendance report: totals, one row per class (school-wide only)
 * and one row per student, lowest attendance first.
 */
export function buildAttendanceReportPdf(report, { scopeLabel, t }) {
  const doc = startReportPdf({
    school: report.school,
    title: t("attendanceReportTitle"),
    subtitle: `${scopeLabel} · ${attendancePeriodLabel(report.period, t)}`,
    generatedAt: report.generatedAt,
    generatedLabel: (date) => t("financeReportGenerated", { date }),
  })

  const { totals } = report
  drawSummaryBoxes(doc, [
    [t("attendanceRateLabel"), percent(totals.rate), t("attendanceRecordsCount", { count: totals.records })],
    [t("attendanceAbsences"), String(totals.absent), ""],
    [t("attendanceLates"), String(totals.late), ""],
    [t("attendanceStudentsFollowed"), String(totals.students), ""],
  ])

  let startY = 80
  if (report.classes.length > 1) {
    autoTable(doc, {
      ...TABLE_STYLE,
      startY,
      head: [[t("dashboardClass"), t("attendanceTeacher"), t("attendanceStudentsCol"), t("attendanceRecordsCol"), t("attendanceAbsentCol"), t("attendanceRateLabel")]],
      body: report.classes.map((row) => [
        row.name,
        row.teacherName ?? "–",
        String(row.students),
        String(row.records),
        String(row.absent),
        row.records === 0 ? t("attendanceNoRollCall") : percent(row.rate),
      ]),
    })
    startY = doc.lastAutoTable.finalY + 8
  }

  autoTable(doc, {
    ...TABLE_STYLE,
    startY,
    head: [[t("financeColStudent"), t("financeColEnrollment"), t("dashboardClass"), t("attendancePresentCol"), t("attendanceLateCol"), t("attendanceExcusedCol"), t("attendanceAbsentCol"), t("attendanceRateLabel")]],
    body: report.students.map((row) => [
      row.name ?? "–",
      row.enrollmentNumber ?? "–",
      row.className ?? "–",
      String(row.present),
      String(row.late),
      String(row.excused),
      String(row.absent),
      percent(row.rate),
    ]),
  })

  return finishReportPdf(doc, t("attendanceReportFooter"))
}
