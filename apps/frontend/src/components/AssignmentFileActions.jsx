import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Download, Eye, FileText } from "lucide-react"
import { apiFetchBlob } from "../lib/api"
import { useAuth } from "../context/AuthContext.jsx"
import Button from "./Button"

/** Gives the browser time to read the object URL before it is released. */
const RELEASE_DELAY_MS = 60_000

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName || "file"
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), RELEASE_DELAY_MS)
}

/**
 * "View" and "Download" for an assignment document. Files are private, so they
 * are fetched with the user's token (a plain link would be refused).
 */
export default function AssignmentFileActions({ path, fileName, label }) {
  const { t } = useTranslation()
  const { token } = useAuth()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const run = async (mode) => {
    // Open the tab during the click, otherwise popup blockers stop it
    const viewer = mode === "view" ? window.open("", "_blank") : null
    setBusy(mode)
    setError(null)
    try {
      const blob = await apiFetchBlob(path, { token })
      if (viewer) {
        const url = URL.createObjectURL(blob)
        viewer.location.href = url
        setTimeout(() => URL.revokeObjectURL(url), RELEASE_DELAY_MS)
      } else {
        // download asked, or the browser blocked the new tab
        saveBlob(blob, fileName)
      }
    } catch (err) {
      viewer?.close()
      setError(err.message || t("fileOpenError"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-slate-700">
          <FileText size={14} aria-hidden="true" />
          {label && <span className="font-medium">{label}:</span>}
          <span className="break-all">{fileName || t("fileUnnamed")}</span>
        </span>
        <Button size="sm" variant="outline" icon={Eye} disabled={busy !== null} onClick={() => run("view")}>
          {busy === "view" ? t("loading") : t("viewFile")}
        </Button>
        <Button size="sm" variant="outline" icon={Download} disabled={busy !== null} onClick={() => run("download")}>
          {busy === "download" ? t("loading") : t("download")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
