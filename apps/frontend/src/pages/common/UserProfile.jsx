import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"

const emptyForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  address: "",
  gender: "",
  fatherName: "",
  motherName: "",
}

function formatDateInput(value) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

function UserProfile() {
  const { t } = useTranslation()
  const { token, user, refreshProfile } = useAuth()

  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadProfile = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await apiFetch("/auth/me", { token })
      setProfile(data)
      setForm({
        firstName: data?.firstName ?? "",
        lastName: data?.lastName ?? "",
        dateOfBirth: formatDateInput(data?.dateOfBirth),
        address: data?.address ?? "",
        gender: data?.gender ?? "",
        fatherName: data?.fatherName ?? "",
        motherName: data?.motherName ?? "",
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    loadProfile()
  }, [token])

  const submitProfile = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError("")
    setMessage("")

    try {
      await apiFetch("/auth/me", {
        method: "PUT",
        token,
        body: {
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth || undefined,
          address: form.address,
          gender: form.gender || undefined,
          fatherName: form.fatherName,
          motherName: form.motherName,
        },
      })
      setMessage(t("profileSaved"))
      await refreshProfile()
      await loadProfile()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-brand-navy/60">{t("loading")}</p>
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t("profileTitle")} subtitle={t("profileSubtitle")} />

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-brand-navy/50">{t("email")}</p>
            <p className="text-sm text-brand-navy">{profile?.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-brand-navy/50">{t("role")}</p>
            <p className="text-sm text-brand-navy">{t(`role${(profile?.role ?? user?.role ?? "").toLowerCase()}`)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-brand-navy/50">{t("enrollmentNumber")}</p>
            <p className="text-sm text-brand-navy">{profile?.enrollmentNumber ?? "-"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submitProfile}>
          <input
            value={form.firstName}
            onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))}
            placeholder={t("firstName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <input
            value={form.lastName}
            onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))}
            placeholder={t("lastName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <select
            value={form.gender}
            onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          >
            <option value="">{t("gender")}</option>
            <option value="MALE">{t("genderMale")}</option>
            <option value="FEMALE">{t("genderFemale")}</option>
            <option value="OTHER">{t("genderOther")}</option>
          </select>
          <input
            value={form.address}
            onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
            placeholder={t("address")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={form.fatherName}
            onChange={(event) => setForm((prev) => ({ ...prev, fatherName: event.target.value }))}
            placeholder={t("fatherName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <input
            value={form.motherName}
            onChange={(event) => setForm((prev) => ({ ...prev, motherName: event.target.value }))}
            placeholder={t("motherName")}
            className="rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
          />
          <button className="primary-button md:col-span-2" type="submit" disabled={saving}>
            {saving ? t("loading") : t("saveProfile")}
          </button>
        </form>
      </section>
    </div>
  )
}

export default UserProfile
