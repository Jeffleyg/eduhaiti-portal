/** Days, or weeks (Monday start) when the period is long, so bars stay readable. */
export function trendBuckets(daily) {
  if (daily.length <= 45) return daily.map((d) => ({ key: d.date, start: d.date, records: d.records, rate: d.rate }))
  const weeks = new Map()
  for (const d of daily) {
    const date = new Date(`${d.date}T00:00:00Z`)
    const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10)
    const bucket = weeks.get(monday) ?? { key: monday, start: monday, records: 0, attended: 0 }
    bucket.records += d.records
    bucket.attended += (d.rate ?? 0) * d.records
    weeks.set(monday, bucket)
  }
  return [...weeks.values()].map((w) => ({ ...w, rate: w.records ? w.attended / w.records : null, weekly: true }))
}
