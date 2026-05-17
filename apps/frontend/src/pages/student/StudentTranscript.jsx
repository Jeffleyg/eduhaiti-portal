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
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      let yPos = 15

      // En-tête professionnel
      doc.setFont("Helvetica", "bold")
      doc.setFontSize(18)
      doc.text("RELEVÉ DE NOTES", pageWidth / 2, yPos, { align: "center" })
      yPos += 8

      doc.setFont("Helvetica", "normal")
      doc.setFontSize(10)
      doc.text("Établissement d'Enseignement Superieur", pageWidth / 2, yPos, { align: "center" })
      yPos += 5

      // Ligne séparatrice
      doc.setDrawColor(20, 30, 80)
      doc.setLineWidth(0.8)
      doc.line(15, yPos, pageWidth - 15, yPos)
      yPos += 8

      // Informations générales
      doc.setFont("Helvetica", "bold")
      doc.setFontSize(11)
      doc.text("INFORMATIONS ÉTUDIANTE", 15, yPos)
      yPos += 6

      doc.setFont("Helvetica", "normal")
      doc.setFontSize(10)
      const studentInfo = [
        [`Nom et Prénom:`, `${maskName(user?.name ?? user?.email, "student")}`],
        [`Numéro d'Inscription:`, user?.enrollmentNumber ?? "-"],
        [`Année Académique:`, selectedYear?.year ?? "-"],
        [`Date d'Émission:`, new Date().toLocaleDateString("fr-FR")],
        [`ID Vérification:`, transcriptId],
      ]

      studentInfo.forEach(([label, value]) => {
        doc.text(label, 15, yPos)
        doc.text(value, 80, yPos)
        yPos += 5
      })

      yPos += 3

      // Résultats par discipline
      doc.setFont("Helvetica", "bold")
      doc.setFontSize(11)
      doc.text("RÉSULTATS PAR DISCIPLINE", 15, yPos)
      yPos += 6

      const tableRows = (report.grades ?? []).map((item) => {
        const score = Number(item.score ?? 0)
        const maxScore = Number(item.maxScore ?? 20)
        const percentage = ((score / maxScore) * 100).toFixed(1)
        const status = percentage >= 60 ? "Admis(e)" : "Non admis(e)"
        return [
          sanitizeText(item.discipline?.name ?? "-"),
          sanitizeText(item.class?.name ?? "-"),
          `${score}/${maxScore}`,
          `${percentage}%`,
          status,
        ]
      })

      autoTable(doc, {
        head: [["Discipline", "Classe", "Note", "%", "Statut"]],
        body: tableRows,
        startY: yPos,
        headStyles: {
          fillColor: [20, 30, 80],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
        },
        alternateRowStyles: {
          fillColor: [245, 248, 250],
        },
        margin: 15,
      })

      yPos = doc.lastAutoTable?.finalY ?? yPos + 50

      // Statistiques générales
      yPos += 5
      doc.setFont("Helvetica", "bold")
      doc.setFontSize(11)
      doc.text("STATISTIQUES GÉNÉRALES", 15, yPos)
      yPos += 6

      const totalScore = (report.grades ?? []).reduce((sum, g) => sum + Number(g.score ?? 0), 0)
      const totalMaxScore = (report.grades ?? []).reduce((sum, g) => sum + Number(g.maxScore ?? 20), 0)
      const overallPercentage = totalMaxScore > 0 ? ((totalScore / totalMaxScore) * 100).toFixed(1) : 0
      const meanScore = report.grades?.length > 0 ? (totalScore / report.grades.length).toFixed(2) : 0
      const passedCount = (report.grades ?? []).filter((g) => {
        const score = Number(g.score ?? 0)
        const maxScore = Number(g.maxScore ?? 20)
        return (score / maxScore) * 100 >= 60
      }).length

      doc.setFont("Helvetica", "normal")
      doc.setFontSize(10)
      const stats = [
        [`Total de disciplines:`, `${report.grades?.length ?? 0}`],
        [`Disciplines réussies:`, `${passedCount}`],
        [`Moyenne générale:`, `${meanScore}/20`],
        [`Taux de réussite:`, `${overallPercentage}%`],
      ]

      stats.forEach(([label, value]) => {
        doc.text(label, 15, yPos)
        doc.setFont("Helvetica", "bold")
        doc.text(value, 80, yPos)
        doc.setFont("Helvetica", "normal")
        yPos += 5
      })

      // Remarques
      yPos += 5
      doc.setFont("Helvetica", "bold")
      doc.text("REMARQUES", 15, yPos)
      yPos += 4
      doc.setFont("Helvetica", "normal")
      doc.setFontSize(9)
      const remarque =
        overallPercentage >= 75
          ? "Excellent rendement académique"
          : overallPercentage >= 60
            ? "Rendement académique satisfaisant"
            : "Rendement académique à améliorer"
      doc.text(remarque, 15, yPos, { maxWidth: pageWidth - 30 })

      // Pied de page avec QR Code
      yPos = pageHeight - 45
      
      // Génération du QR code
      const qrDataUrl = await QRCode.toDataURL(
        `${window.location.origin}/verify-transcript?id=${transcriptId}&student=${user?.id}&year=${selectedYearId}`,
        { width: 80 }
      )
      
      // Ajout du QR code au PDF
      doc.addImage(qrDataUrl, "PNG", pageWidth - 40, yPos - 10, 25, 25)
      
      doc.setFont("Helvetica", "bold")
      doc.setFontSize(9)
      doc.text("Vérifier:", pageWidth - 40, yPos + 20)
      
      doc.setFont("Helvetica", "italic")
      doc.setFontSize(8)
      doc.setDrawColor(200)
      doc.line(15, yPos - 5, pageWidth - 50, yPos - 5)
      doc.text("Ce document est généré automatiquement et a valeur de relevé officiel.", 15, yPos, { maxWidth: pageWidth - 50 })
      doc.text(`ID Vérification: ${transcriptId}`, 15, yPos + 5, { maxWidth: pageWidth - 50 })
      doc.text(`Signature numérique: ${new Date().toLocaleString("fr-FR")}`, 15, yPos + 10, { maxWidth: pageWidth - 50 })

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
      <SectionHeader title="Relevé de Notes Académique" subtitle="Historique complet de votre parcours académique" />

      {error ? <div className="rounded-2xl border border-brand-red/20 bg-brand-red/5 p-3 text-sm text-brand-red">{error}</div> : null}

      {/* Sélection année et actions */}
      <div className="module-card compact p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <select
          value={selectedYearId}
          onChange={(event) => handleYearChange(event.target.value)}
          className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
        >
          <option value="">Sélectionner une année académique</option>
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
            Imprimer
          </button>
          <button
            onClick={generateProfessionalPdf}
            disabled={!selectedYearId}
            className="flex items-center gap-2 rounded-2xl bg-brand-navy px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            PDF
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
        <h2 className="font-bold text-brand-navy mb-3">RÉSULTATS PAR DISCIPLINE</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-brand-navy/20">
                <th className="px-3 py-2 text-left font-semibold text-brand-navy">Discipline</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-navy">Classe</th>
                <th className="px-3 py-2 text-center font-semibold text-brand-navy">Note</th>
                <th className="px-3 py-2 text-center font-semibold text-brand-navy">%</th>
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
