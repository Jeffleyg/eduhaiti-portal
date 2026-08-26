import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useTranslation } from "react-i18next"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { sanitizeText, maskName } from "../../lib/string.js"
import * as QRCode from "qrcode"
import { Printer, Download } from "lucide-react"

function StudentTranscript() {
  const { t } = useTranslation()
  const { token, user } = useAuth()
  const [grades, setGrades] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [selectedYearId, setSelectedYearId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [report, setReport] = useState(null)
  const [transcriptId, setTranscriptId] = useState("")
  const [qrCodeUrl, setQrCodeUrl] = useState("")

  // Gerar um ID único para o histórico com checksum
  const generateTranscriptId = () => {
    const timestamp = new Date().getTime()
    const studentIdStr = user?.id ?? "unknown"
    const yearStr = selectedYearId ?? "current"
    const hash = btoa(`${studentIdStr}-${yearStr}-${timestamp}`).replace(/[^a-zA-Z0-9]/g, "").substring(0, 12)
    return `TR-${hash}-${new Date().getFullYear()}`
  }

  // Gerar QR code
  const generateQRCode = async (id) => {
    try {
      const url = await QRCode.toDataURL(
        `${window.location.origin}/verify-transcript?id=${id}&student=${user?.id}&year=${selectedYearId}`,
        { width: 200 }
      )
      setQrCodeUrl(url)
    } catch (err) {
      console.error("Erro ao gerar QR code:", err)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [myGrades, years] = await Promise.all([
          apiFetch("/grades/my-grades", { token }),
          apiFetch("/grades/my-academic-years", { token }),
        ])
        setGrades(myGrades ?? [])
        setAcademicYears(years ?? [])
        if (years?.length > 0) {
          const active = years.find((item) => item.isActive)
          const defaultYearId = active?.id ?? years[0].id
          setSelectedYearId(defaultYearId)
          const newTranscriptId = generateTranscriptId()
          setTranscriptId(newTranscriptId)
          await generateQRCode(newTranscriptId)
          const reportData = await apiFetch(`/grades/report/${defaultYearId}`, { token })
          setReport(reportData)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token])

  const handleYearChange = async (yearId) => {
    setSelectedYearId(yearId)
    const newTranscriptId = generateTranscriptId()
    setTranscriptId(newTranscriptId)
    await generateQRCode(newTranscriptId)
    try {
      const reportData = await apiFetch(`/grades/report/${yearId}`, { token })
      setReport(reportData)
      setError("")
    } catch (err) {
      setError(err.message)
    }
  }

  const generateProfessionalPdf = async () => {
    if (!selectedYearId || !report) {
      setError("Veuillez sélectionner une année académique")
      return
    }

    try {
      const selectedYear = academicYears.find((item) => item.id === selectedYearId)
      const doc = new jsPDF({ unit: "mm", format: "a4" })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 15
      const contentWidth = pageWidth - margin * 2

      // helper: fetch image url -> dataURL
      const toDataURL = async (url) => {
        try {
          const res = await fetch(url)
          const blob = await res.blob()
          return await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.readAsDataURL(blob)
          })
        } catch (e) {
          return null
        }
      }

      // Header: optional logo, school name, transcript title
      const logoUrl = user?.school?.logoUrl || user?.school?.logo || null
      if (logoUrl) {
        const logoData = await toDataURL(logoUrl)
        if (logoData) doc.addImage(logoData, "PNG", margin, 12, 28, 28)
      }

      doc.setFontSize(14)
      doc.setFont("Helvetica", "bold")
      const schoolName = user?.school?.name || t("schoolName")
      doc.text(schoolName, pageWidth / 2, 18, { align: "center" })

      doc.setFontSize(10)
      doc.setFont("Helvetica", "normal")
      const schoolAddr = user?.school?.address || t("schoolAddress")
      doc.text(schoolAddr, pageWidth / 2, 23, { align: "center" })

      doc.setDrawColor(20, 30, 80)
      doc.setLineWidth(0.7)
      doc.line(margin, 30, pageWidth - margin, 30)

      // Title
      doc.setFontSize(16)
      doc.setFont("Helvetica", "bold")
      doc.text(t("academicRecordHeader"), pageWidth / 2, 38, { align: "center" })

      // Student block (left) and optional photo (right)
      let y = 44
      const photoUrl = user?.photoUrl || user?.profilePhotoUrl || user?.avatarUrl || null
      const boxHeight = 34
      doc.setDrawColor(230)
      doc.rect(margin, y, contentWidth, boxHeight)

      const leftX = margin + 4
      let infoY = y + 7
      doc.setFontSize(10)
      doc.setFont("Helvetica", "bold")
      doc.text(t("studentInformation"), leftX, infoY)
      doc.setFont("Helvetica", "normal")
      infoY += 5
      doc.text(`${t("studentFullName")} ${maskName(user?.name ?? user?.email, "student")}`, leftX, infoY)
      infoY += 5
      doc.text(`${t("enrollmentNumber")} ${user?.enrollmentNumber ?? "-"}`, leftX, infoY)
      infoY += 5
      doc.text(`Date Naissance: ${user?.birthDate ? new Date(user.birthDate).toLocaleDateString() : "-"}`, leftX, infoY)

      if (photoUrl) {
        const photoData = await toDataURL(photoUrl)
        if (photoData) {
          doc.addImage(photoData, "JPEG", pageWidth - margin - 28, y + 4, 24, 28)
        }
      }

      y += boxHeight + 6

      // Build table rows with extra columns (Credits / Lettre / Statut)
      const letterGrade = (pct) => {
        if (pct >= 90) return "A"
        if (pct >= 80) return "B"
        if (pct >= 70) return "C"
        if (pct >= 60) return "D"
        return "F"
      }

      const gradeToPoints = (letter) => ({ A: 4, B: 3, C: 2, D: 1, F: 0 }[letter] ?? 0)

      const rows = (report.grades ?? []).map((item) => {
        const score = Number(item.score ?? 0)
        const max = Number(item.maxScore ?? 20)
        const pct = max > 0 ? (score / max) * 100 : 0
        const letter = letterGrade(pct)
        const credits = item.discipline?.credits ?? item.class?.credits ?? "-"
        const status = pct >= 60 ? "Admis(e)" : "Non admis(e)"
        return [
          sanitizeText(item.discipline?.code ?? item.discipline?.name ?? "-"),
          sanitizeText(item.discipline?.name ?? "-"),
          String(credits),
          `${score}/${max}`,
          `${pct.toFixed(1)}%`,
          letter,
          status,
        ]
      })

      // AutoTable (bulletin style): Matières | Moy/20 | Classe(min/max/moy) | Appréciations
      const bulletinRows = (report.grades ?? []).map((item) => {
        const score = Number(item.score ?? 0)
        const max = Number(item.maxScore ?? 20)
        const classMin = item.classStats?.min ?? item.class?.min ?? "-"
        const classMax = item.classStats?.max ?? item.class?.max ?? "-"
        const classAvg = item.classStats?.avg ?? item.class?.avg ?? "-"
        const appreciation = item.appreciation ?? item.comment ?? item.teacherComment ?? ""
        return [
          sanitizeText(item.discipline?.name ?? "-"),
          `${score}/${max}`,
          String(classMin),
          String(classMax),
          String(classAvg),
          sanitizeText(appreciation),
        ]
      })

      autoTable(doc, {
        head: [
          [
            { content: "Matières", rowSpan: 2 },
            { content: "Moy /20", rowSpan: 2 },
            { content: "Classe", colSpan: 3, styles: { halign: "center" } },
            { content: "Appréciations", rowSpan: 2 },
          ],
          ["Min", "Max", "Moy"],
        ],
        body: bulletinRows,
        startY: y,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [30, 60, 90], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 248, 250] },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 24 },
          2: { cellWidth: 18 },
          3: { cellWidth: 18 },
          4: { cellWidth: 18 },
          5: { cellWidth: 60 },
        },
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages()
          const page = doc.internal.getCurrentPageInfo().pageNumber
          doc.setFontSize(9)
          doc.setTextColor(120)
          doc.text(`Page ${page} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" })
        },
      })

      // Summary statistics below table
      let finalY = doc.lastAutoTable?.finalY ?? y + 10
      finalY += 6

      const totalScore = (report.grades ?? []).reduce((s, g) => s + Number(g.score ?? 0), 0)
      const totalMaxScore = (report.grades ?? []).reduce((s, g) => s + Number(g.maxScore ?? 20), 0)
      const overallPct = totalMaxScore > 0 ? ((totalScore / totalMaxScore) * 100).toFixed(1) : 0
      const mean = report.grades?.length > 0 ? (totalScore / report.grades.length).toFixed(2) : "0"

      // GPA calculation (simple average by letter points)
      const points = (report.grades ?? []).reduce((acc, g) => {
        const pct = (Number(g.score ?? 0) / Number(g.maxScore ?? 20)) * 100
        const letter = letterGrade(pct)
        return acc + gradeToPoints(letter)
      }, 0)
      const gpa = report.grades?.length > 0 ? (points / report.grades.length).toFixed(2) : "0.00"

      doc.setFontSize(10)
      doc.setFont("Helvetica", "bold")
      doc.text("STATISTIQUES GÉNÉRALES", margin, finalY)
      doc.setFont("Helvetica", "normal")
      finalY += 6
      doc.text(`Total disciplines: ${report.grades?.length ?? 0}`, margin, finalY)
      doc.text(`Moyenne générale: ${mean}/20`, margin + 70, finalY)
      finalY += 5
      doc.text(`Taux de réussite: ${overallPct}%`, margin, finalY)
      doc.text(`GPA estimé: ${gpa}`, margin + 70, finalY)

      // Remarks
      finalY += 8
      doc.setFont("Helvetica", "italic")
      const remarkText = overallPct >= 75 ? "Excellent rendement académique" : overallPct >= 60 ? "Rendement académique satisfaisant" : "Rendement académique à améliorer"
      doc.text(`Remarques: ${remarkText}`, margin, finalY, { maxWidth: contentWidth })

      // Signatures & Verification block at bottom
      const bottomY = pageHeight - 50
      doc.setDrawColor(200)
      doc.line(margin, bottomY - 6, pageWidth - margin, bottomY - 6)

      // QR code small
      const smallQr = await QRCode.toDataURL(`${window.location.origin}/verify-transcript?id=${transcriptId}&student=${user?.id}&year=${selectedYearId}`, { width: 100 })
      if (smallQr) doc.addImage(smallQr, "PNG", pageWidth - margin - 30, bottomY - 2, 26, 26)

      doc.setFont("Helvetica", "normal")
      doc.setFontSize(9)
      doc.text(`ID Vérification: ${transcriptId}`, margin, bottomY + 2)
      doc.text(`Émis le: ${new Date().toLocaleDateString()}`, margin + 70, bottomY + 2)

      // Signature lines
      doc.setFontSize(10)
      doc.text("Signature du Directeur:", margin, bottomY + 16)
      doc.line(margin, bottomY + 20, margin + 60, bottomY + 20)

      doc.text("Cachet de l'établissement:", margin + 80, bottomY + 16)
      doc.line(margin + 80, bottomY + 20, margin + 150, bottomY + 20)

      const filename = `Releve_de_Notes_${selectedYear?.year ?? "academique"}.pdf`
      doc.save(filename)
      setError("")
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return <div className="text-center text-brand-navy py-10">{t("loading")}</div>
  }

  const selectedYear = academicYears.find((item) => item.id === selectedYearId)
  const totalScore = (report?.grades ?? []).reduce((sum, g) => sum + Number(g.score ?? 0), 0)
  const totalMaxScore = (report?.grades ?? []).reduce((sum, g) => sum + Number(g.maxScore ?? 20), 0)
  const overallPercentage = totalMaxScore > 0 ? ((totalScore / totalMaxScore) * 100).toFixed(1) : 0
  const meanScore = report?.grades?.length > 0 ? (totalScore / report.grades.length).toFixed(2) : 0
  const passedCount = (report?.grades ?? []).filter((g) => {
    const score = Number(g.score ?? 0)
    const maxScore = Number(g.maxScore ?? 20)
    return (score / maxScore) * 100 >= 60
  }).length

  return (
    <div className="space-y-6">
      <SectionHeader title={t("transcriptTitle")} subtitle={t("transcriptSubtitle")}
      />

      {error ? <div className="rounded-2xl border border-brand-red/20 bg-brand-red/5 p-3 text-sm text-brand-red">{error}</div> : null}

      {/* Sélection année et actions */}
      <div className="module-card compact p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <select
          value={selectedYearId}
          onChange={(event) => handleYearChange(event.target.value)}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
        >
          <option value="">{t("transcriptSelectYear")}</option>
          {academicYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.year}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-2xl border border-brand-navy/20 bg-white px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-navy/5 transition-colors"
          >
            <Printer className="h-4 w-4" />
            {t("print")}
          </button>
          <button
            onClick={generateProfessionalPdf}
            disabled={!selectedYearId}
            className="flex items-center gap-2 rounded-2xl bg-brand-navy px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {t("pdf")}
          </button>
        </div>
      </div>

      {/* En-tête professionnel */}
      <div className="module-card compact p-4 bg-gradient-to-br from-brand-navy to-brand-navy/80 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">RELEVÉ DE NOTES</h1>
          <p className="mt-1 text-white/80">Année Académique {selectedYear?.year}</p>
        </div>
      </div>

      {/* Informations étudiante */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="module-card compact p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-navy/60">Informations Étudiante</p>
          <p className="mt-2 text-sm font-semibold text-brand-navy">{maskName(user?.name ?? user?.email, "student")}</p>
          <p className="text-xs text-brand-navy/75">N° d'Inscription: {user?.enrollmentNumber ?? "-"}</p>
          <p className="text-xs text-brand-navy/75 mt-1">Date d'Émission: {new Date().toLocaleDateString("fr-FR")}</p>
        </div>
        <div className="module-card compact p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-navy/60">Statistiques Générales</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-brand-navy/60">Disciplines</p>
              <p className="font-bold text-brand-navy">{report?.grades?.length ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-brand-navy/60">Réussies</p>
              <p className="font-bold text-emerald-700">{passedCount}</p>
            </div>
            <div>
              <p className="text-xs text-brand-navy/60">Moyenne Gén.</p>
              <p className="font-bold text-brand-navy">{meanScore}/20</p>
            </div>
            <div>
              <p className="text-xs text-brand-navy/60">Taux Réussite</p>
              <p className="font-bold text-brand-sky">{overallPercentage}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tableau des résultats */}
      <div className="module-card compact p-4">
        <h2 className="font-bold text-brand-navy mb-3">{t("resultsByDiscipline")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-brand-navy/20">
                <th className="px-3 py-2 text-left font-semibold text-brand-navy">{t("subject")}</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-navy">{t("className")}</th>
                <th className="px-3 py-2 text-center font-semibold text-brand-navy">{t("grade")}</th>
                <th className="px-3 py-2 text-center font-semibold text-brand-navy">{t("percentage")}</th>
                <th className="px-3 py-2 text-center font-semibold text-brand-navy">Statut</th>
              </tr>
            </thead>
            <tbody>
              {(report?.grades ?? []).map((grade, idx) => {
                const score = Number(grade.score ?? 0)
                const maxScore = Number(grade.maxScore ?? 20)
                const percentage = ((score / maxScore) * 100).toFixed(1)
                const isPass = percentage >= 60
                return (
                  <tr key={grade.id} className={idx % 2 === 0 ? "bg-white" : "bg-brand-navy/2"}>
                    <td className="px-3 py-2 text-brand-navy">{sanitizeText(grade.discipline?.name ?? "-")}</td>
                    <td className="px-3 py-2 text-brand-navy/75">{sanitizeText(grade.class?.name ?? "-")}</td>
                    <td className="px-3 py-2 text-center font-semibold text-brand-navy">
                      {score}/{maxScore}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-brand-navy">{percentage}%</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isPass ? "bg-emerald-100 text-emerald-700" : "bg-brand-red/10 text-brand-red"}`}>
                        {isPass ? "Admis(e)" : "Non admis(e)"}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remarques et observations */}
      <div className="module-card compact p-4 border-l-4 border-brand-navy">
        <h3 className="font-bold text-brand-navy mb-2">REMARQUES ACADÉMIQUES</h3>
        <p className="text-sm text-brand-navy/80">
          {overallPercentage >= 75
            ? "✓ Excellent rendement académique. Continuez vos efforts pour maintenir cette excellence."
            : overallPercentage >= 60
              ? "✓ Rendement académique satisfaisant. Un léger effort permettrait une meilleure progression."
              : "⚠ Rendement académique à améliorer. Nous vous encourageons à consulter les enseignants pour un suivi personnalisé."}
        </p>
      </div>

      {/* Vérification et QR Code */}
      {transcriptId && (
        <div className="module-card compact p-4 border-l-4 border-emerald-600 bg-emerald-50">
          <div className="grid gap-4 md:grid-cols-3 md:items-center">
            <div className="md:col-span-2">
              <h3 className="font-bold text-emerald-900 mb-2">🔒 VÉRIFIER L'AUTHENTICITÉ</h3>
              <p className="text-sm text-emerald-800 mb-2">
                Scannez le code QR ci-dessous pour vérifier l'authenticité de ce document académique officiel.
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-white/50 px-3 py-2 font-mono text-xs text-emerald-700">
                <span>ID:</span>
                <span className="font-bold">{transcriptId}</span>
              </div>
            </div>
            {qrCodeUrl && (
              <div className="flex justify-center md:justify-end">
                <img src={qrCodeUrl} alt="QR Code de vérification" className="h-32 w-32 border-2 border-emerald-600 rounded-lg p-1 bg-white" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Certification */}
      <div className="module-card compact p-4 bg-sand text-center">
        <p className="text-xs text-brand-navy/60">
          Ce document est généré automatiquement et a valeur de relevé officiel.
        </p>
        <p className="text-xs text-brand-navy/50 mt-1">
          Signature numérique: {new Date().toLocaleString("fr-FR")}
        </p>
      </div>
    </div>
  )
}

export default StudentTranscript
