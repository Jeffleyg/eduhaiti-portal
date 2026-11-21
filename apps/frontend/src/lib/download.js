/** Saves a Blob as a file in the browser. */
export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** File name from a Content-Disposition header, or `fallback`. */
export const fileNameFrom = (disposition, fallback) => /filename="([^"]+)"/.exec(disposition ?? "")?.[1] ?? fallback

const ymd = (date) => date.toISOString().slice(0, 10)

/** Date range (YYYY-MM-DD, UTC) for a period preset; the school year runs September to August. */
export function presetRange(preset, now = new Date()) {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  if (preset === "last30") return { startDate: ymd(new Date(now.getTime() - 29 * 86400000)), endDate: ymd(now) }
  if (preset === "month") return { startDate: ymd(new Date(Date.UTC(year, month, 1))), endDate: ymd(new Date(Date.UTC(year, month + 1, 0))) }
  if (preset === "previousMonth") return { startDate: ymd(new Date(Date.UTC(year, month - 1, 1))), endDate: ymd(new Date(Date.UTC(year, month, 0))) }
  if (preset === "schoolYear") {
    const start = month >= 8 ? year : year - 1
    return { startDate: `${start}-09-01`, endDate: `${start + 1}-08-31` }
  }
  return { startDate: "", endDate: "" }
}
