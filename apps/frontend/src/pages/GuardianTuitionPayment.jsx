import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../lib/string.js"
import { apiFetch } from "../lib/api.js"
import LoadMoreList from "../components/LoadMoreList.jsx"

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>\"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }

    return replacements[character] ?? character
  })

const buildIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `pay-${Date.now()}-${Math.random().toString(16).slice(2)}`

function GuardianTuitionPayment() {
  const { t } = useTranslation()
  const [enrollmentNumber, setEnrollmentNumber] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [studentInfo, setStudentInfo] = useState(null)
  const [charges, setCharges] = useState([])
  const [confirmPaymentDetails, setConfirmPaymentDetails] = useState(false)

  const [paymentForm, setPaymentForm] = useState({
    provider: "moncash",
    accountNumber: "",
    amountHtg: "",
    tuitionPaymentId: "",
    guardianName: "",
    guardianPhone: "",
  })

  const providers = [
    { id: "moncash", label: t("provider_moncash") },
    { id: "natcash", label: t("provider_natcash") },
    { id: "pix", label: t("provider_pix") },
    { id: "card", label: t("provider_card") },
    { id: "zelle", label: t("provider_zelle") },
    { id: "paypal", label: t("provider_paypal") },
    { id: "picpay", label: t("provider_picpay") },
    { id: "tap_tap_send", label: t("provider_taptapsend") },
    { id: "wise", label: t("provider_wise") },
    { id: "boleto", label: t("provider_boleto") },
  ]

  const totalPending = useMemo(
    () => charges.reduce((sum, item) => sum + Number(item.amount ?? 0), 0),
    [charges],
  )

  const loadPending = async (event) => {
    event.preventDefault()
    setLookupLoading(true)
    setError("")
    setMessage("")

    try {
      const data = await apiFetch(`/finance/tuition/${encodeURIComponent(enrollmentNumber.trim())}/pending`)
      setStudentInfo(data.student)
      setCharges(data.charges ?? [])
      setMessage(t("tuitionChargesLoaded"))
    } catch (err) {
      setError(err.message)
      setStudentInfo(null)
      setCharges([])
    } finally {
      setLookupLoading(false)
    }
  }

  const payTuition = async (event) => {
    event.preventDefault()
    setPayLoading(true)
    setError("")
    setMessage("")

    try {
      const idempotencyKey = buildIdempotencyKey()
      const result = await apiFetch("/finance/tuition/pay", {
        method: "POST",
        body: {
          provider: paymentForm.provider,
          accountNumber: paymentForm.accountNumber,
          studentEnrollmentNumber: enrollmentNumber.trim(),
          idempotencyKey,
          amountHtg: Number(paymentForm.amountHtg),
          tuitionPaymentId: paymentForm.tuitionPaymentId || undefined,
          guardianName: paymentForm.guardianName || undefined,
          guardianPhone: paymentForm.guardianPhone || undefined,
        },
      })

      setMessage(t("paymentConfirmedReceipt", { receiptNumber: result.receiptNumber }))
      setPaymentForm((prev) => ({ ...prev, amountHtg: "", tuitionPaymentId: "" }))
      setConfirmPaymentDetails(false)
      const refreshed = await apiFetch(`/finance/tuition/${encodeURIComponent(enrollmentNumber.trim())}/pending`)
      setStudentInfo(refreshed.student)
      setCharges(refreshed.charges ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setPayLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-sand px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-brand-navy/10 bg-white/80 p-6 shadow-xl shadow-brand-navy/10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-brand-navy">{t("tuitionPaymentTitle")}</h1>
            <p className="mt-1 text-sm text-brand-navy/70">{t("tuitionPaymentSubtitle")}</p>
          </div>
          <Link to="/" className="outline-button">
            {t("back")}
          </Link>
        </div>

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950">
          <h2 className="font-semibold">{t("securePaymentTitle")}</h2>
          <p className="mt-1">{t("securePaymentCopy")}</p>
          <ul className="mt-3 grid gap-2 text-xs md:grid-cols-3">
            <li className="rounded-xl bg-white/80 px-3 py-2">{t("securePaymentItemOne")}</li>
            <li className="rounded-xl bg-white/80 px-3 py-2">{t("securePaymentItemTwo")}</li>
            <li className="rounded-xl bg-white/80 px-3 py-2">{t("securePaymentItemThree")}</li>
          </ul>
        </section>

        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
          <h2 className="text-base font-semibold text-brand-navy">{t("lookupChargesTitle")}</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={loadPending}>
            <input
              value={enrollmentNumber}
              onChange={(event) => setEnrollmentNumber(event.target.value)}
              placeholder={t("enrollmentPlaceholderPayment")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              autoComplete="off"
              inputMode="numeric"
              required
            />
            <button className="primary-button" disabled={lookupLoading} type="submit">
              {lookupLoading ? t("loading") : t("consultCharges")}
            </button>
          </form>

          {studentInfo ? (
            <div className="mt-4 rounded-2xl border border-brand-navy/10 bg-sand p-3">
              <p className="text-sm text-brand-navy">
                {t("studentLabel")}: <strong>{maskName(studentInfo.name, "student")}</strong>
              </p>
              <p className="text-xs text-brand-navy/70">{t("enrollmentLabel")}: {studentInfo.enrollmentNumber}</p>
              <p className="text-xs text-brand-navy/70">{t("pendingTotalLabel")}: {totalPending.toFixed(2)} HTG</p>
            </div>
          ) : null}

          {charges.length > 0 ? (
            <div className="mt-3">
              <LoadMoreList
                items={charges}
                initialLimit={3}
                step={3}
                renderItem={(charge) => (
                  <div key={charge.id} className="rounded-xl border border-brand-navy/10 bg-white p-3">
                    <p className="text-sm text-brand-navy">{Number(charge.amount).toFixed(2)} HTG</p>
                    <p className="text-xs text-brand-navy/60">{t("status")}: {charge.status}</p>
                    <p className="text-xs text-brand-navy/60">
                      {t("dueDate")}: {new Date(charge.dueDate).toLocaleDateString()}
                    </p>
                    {charge.description ? <p className="text-xs text-brand-navy/60">{charge.description}</p> : null}
                  </div>
                )}
              />
            </div>
          ) : studentInfo ? (
            <p className="mt-3 text-xs text-brand-navy/60">{t("noPendingCharges")}</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
          <h2 className="text-base font-semibold text-brand-navy">{t("paySectionTitle")}</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={payTuition}>
            <select
              value={paymentForm.provider}
              onChange={(event) => setPaymentForm((prev) => ({ ...prev, provider: event.target.value }))}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>

            <input
              value={paymentForm.accountNumber}
              onChange={(event) =>
                setPaymentForm((prev) => ({ ...prev, accountNumber: event.target.value }))
              }
              placeholder={t("accountNumberPlaceholder")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              autoComplete="off"
              required
            />

            <input
              type="number"
              min="1"
              step="0.01"
              value={paymentForm.amountHtg}
              onChange={(event) => setPaymentForm((prev) => ({ ...prev, amountHtg: event.target.value }))}
              placeholder={t("amountPlaceholder")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              inputMode="decimal"
              required
            />

            {paymentForm.provider === "card" ? (
              <>
                <input
                  value={paymentForm.cardNumber || ""}
                  onChange={(event) => setPaymentForm((prev) => ({ ...prev, cardNumber: event.target.value }))}
                  placeholder={t("cardNumberPlaceholder")}
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                  autoComplete="off"
                />
                <input
                  value={paymentForm.cardExpiry || ""}
                  onChange={(event) => setPaymentForm((prev) => ({ ...prev, cardExpiry: event.target.value }))}
                  placeholder={t("cardExpiryPlaceholder")}
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                  autoComplete="off"
                />
                <input
                  value={paymentForm.cardCvv || ""}
                  onChange={(event) => setPaymentForm((prev) => ({ ...prev, cardCvv: event.target.value }))}
                  placeholder={t("cardCvvPlaceholder")}
                  className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                  autoComplete="off"
                />
              </>
            ) : null}

            <select
              value={paymentForm.tuitionPaymentId}
              onChange={(event) =>
                setPaymentForm((prev) => ({ ...prev, tuitionPaymentId: event.target.value }))
              }
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
            >
              <option value="">{t("linkChargeOptional")}</option>
              {charges.map((charge) => (
                <option key={charge.id} value={charge.id}>
                  {Number(charge.amount).toFixed(2)} HTG - {charge.status}
                </option>
              ))}
            </select>

            <input
              value={paymentForm.guardianName}
              onChange={(event) =>
                setPaymentForm((prev) => ({ ...prev, guardianName: event.target.value }))
              }
              placeholder={t("guardianNamePlaceholderPayment")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              autoComplete="name"
            />

            <input
              value={paymentForm.guardianPhone}
              onChange={(event) =>
                setPaymentForm((prev) => ({ ...prev, guardianPhone: event.target.value }))
              }
              placeholder={t("guardianPhonePlaceholderPayment")}
              className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
              autoComplete="tel"
            />

            <label className="flex items-start gap-2 rounded-2xl border border-brand-navy/10 bg-sand p-3 text-sm text-brand-navy md:col-span-2">
              <input
                type="checkbox"
                checked={confirmPaymentDetails}
                onChange={(event) => setConfirmPaymentDetails(event.target.checked)}
                className="mt-1"
              />
              <span>{t("confirmPaymentDetails")}</span>
            </label>

            <button
              className="primary-button md:col-span-2"
              disabled={payLoading || !enrollmentNumber.trim() || !confirmPaymentDetails}
              type="submit"
            >
              {payLoading ? t("processingPayment") : t("payTuition")}
            </button>

            <button
              type="button"
              onClick={() => {
                const invoice = {
                  id: `INV-${Date.now()}`,
                  student: studentInfo,
                  items: charges.length
                    ? charges
                    : [{ description: t("invoiceDefaultItem"), amount: Number(paymentForm.amountHtg || totalPending || 0) }],
                  total: Number(paymentForm.amountHtg || totalPending || 0),
                  date: new Date().toLocaleString(),
                }

                const windowRef = window.open("", "_blank", "noopener,noreferrer")
                if (!windowRef) {
                  setError(t("popupBlocked"))
                  return
                }

                const html = `
                  <html>
                    <head><title>${t("invoiceTitle")} ${escapeHtml(invoice.id)}</title></head>
                    <body>
                      <h2>${t("invoiceTitle")} ${escapeHtml(invoice.id)}</h2>
                          <p>${t("studentLabel")}: ${escapeHtml(maskName(invoice.student?.name, "student") || "-")}</p>
                            <p>${t("enrollmentLabel")}: ${escapeHtml(invoice.student?.enrollmentNumber || "-")}</p>
                      <table border="1" cellpadding="8" cellspacing="0">
                        <thead>
                          <tr>
                            <th>${t("invoiceItemDescription")}</th>
                            <th>${t("invoiceItemAmount")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${invoice.items
                            .map(
                              (item) =>
                                `<tr><td>${escapeHtml(item.description || t("invoiceDefaultItem"))}</td><td>${Number(item.amount).toFixed(2)} HTG</td></tr>`,
                            )
                            .join("")}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td><strong>${t("total")}</strong></td>
                            <td><strong>${Number(invoice.total).toFixed(2)} HTG</strong></td>
                          </tr>
                        </tfoot>
                      </table>
                      <p>${t("generatedAt")}: ${escapeHtml(invoice.date)}</p>
                    </body>
                  </html>`

                windowRef.document.write(html)
                windowRef.document.close()
              }}
              className="outline-button md:col-span-2"
            >
              {t("generateInvoiceReceipt")}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

export default GuardianTuitionPayment