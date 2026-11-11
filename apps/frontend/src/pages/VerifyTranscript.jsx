import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { apiFetch } from "../lib/api.js"
import { sanitizeText } from "../lib/string.js"

/**
 * Public page opened by the QR code printed on a transcript. Anyone holding the document
 * (school, employer, university) can confirm it was issued by EduHaiti and what it says.
 */
export default function VerifyTranscript() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true, data: null, error: "" })

  useEffect(() => {
    let active = true
    apiFetch(`/public/scorecards/${encodeURIComponent(id)}/verify`)
      .then((data) => active && setState({ loading: false, data, error: "" }))
      .catch(() => active && setState({ loading: false, data: null, error: "not-found" }))
    return () => {
      active = false
    }
  }, [id])

  const { loading, data, error } = state
  const valid = Boolean(data?.valid)

  return (
    <div className="min-h-screen bg-sand px-4 py-10">
      <div className="mx-auto max-w-lg space-y-4 rounded-3xl border border-brand-navy/10 bg-white p-6 shadow-xl">
        <h1 className="font-display text-2xl text-brand-navy">Vérification du relevé de notes</h1>

        {loading ? <p className="text-sm text-brand-navy/70">Vérification en cours…</p> : null}

        {!loading && (error || !valid) ? (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Document introuvable ou non valide. Ce relevé n'a pas été émis par EduHaiti.
          </p>
        ) : null}

        {!loading && valid ? (
          <div className="space-y-2 text-sm text-brand-navy">
            <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800">
              Document authentique
            </p>
            <p>Élève : <strong>{sanitizeText(data.student?.name) || "-"}</strong></p>
            <p>Matricule : {sanitizeText(data.student?.enrollmentNumber) || "-"}</p>
            <p>Année académique : {sanitizeText(data.academicYear?.year) || "-"}</p>
            <p>Moyenne : {data.scorecard?.averageScore == null ? "-" : `${data.scorecard.averageScore}/20`}</p>
            <p>Décision : {data.scorecard?.passStatus ? "Admis(e)" : "Non admis(e)"}</p>
            <p className="break-all text-xs text-brand-navy/60">Empreinte : {data.verificationHash}</p>
          </div>
        ) : null}

        <Link to="/" className="outline-button inline-block">
          EduHaiti
        </Link>
      </div>
    </div>
  )
}
