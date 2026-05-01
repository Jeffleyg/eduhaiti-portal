import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import CorporateHeader from "../../components/CorporateHeader.jsx"
import ProfileCard from "../../components/ProfileCard.jsx"
import SkeletonLoader from "../../components/SkeletonLoader.jsx"
import LoadingState from "../../components/LoadingState.jsx"
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
  const [editMode, setEditMode] = useState(false)

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

  const handlePhotoUpload = async (file, preview) => {
    setSaving(true)
    setError("")
    setMessage("")

    try {
      const formData = new FormData()
      formData.append("profilePhoto", file)

      const response = await apiFetch("/users/profile-photo", {
        method: "POST",
        token,
        body: formData,
        isFormData: true,
      })

      if (response?.user) {
        setProfile(response.user)
        setMessage(t("photoUpdatedSuccess"))
      }
    } catch (err) {
      setError(err.message || t("errorUploadingPhoto"))
    } finally {
      setSaving(false)
    }
  }

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
      setEditMode(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-sand">
        <CorporateHeader />
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SkeletonLoader type="dashboard" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sand">
      <CorporateHeader />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {error ? <LoadingState error={error} type="banner" message={error} /> : null}
        {message ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sidebar com Perfil */}
          <div className="lg:col-span-1">
            <ProfileCard user={profile} onPhotoUpload={handlePhotoUpload} loading={saving} />

            {/* Quick Links */}
            <div className="mt-6 space-y-2 rounded-2xl border border-brand-navy/10 bg-white/50 p-4">
              <button className="block w-full rounded-lg px-4 py-2 text-left text-sm font-semibold text-brand-navy hover:bg-brand-navy/10 transition-colors">
                📊 {t("academicRecords")}
              </button>
              <button className="block w-full rounded-lg px-4 py-2 text-left text-sm font-semibold text-brand-navy hover:bg-brand-navy/10 transition-colors">
                📝 {t("documents")}
              </button>
              <button className="block w-full rounded-lg px-4 py-2 text-left text-sm font-semibold text-brand-navy hover:bg-brand-navy/10 transition-colors">
                💬 {t("messages")}
              </button>
            </div>
          </div>

          {/* Conteúdo Principal */}
          <div className="lg:col-span-2">
            {/* Dados Pessoais */}
            <div className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
              <div className="mb-6 flex items-center justify-between">
                <SectionHeader title={t("personalData")} />
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    editMode
                      ? "bg-brand-red/10 text-brand-red hover:bg-brand-red/20"
                      : "bg-brand-navy/10 text-brand-navy hover:bg-brand-navy/20"
                  }`}
                >
                  {editMode ? t("cancel") : t("edit")}
                </button>
              </div>

              <form onSubmit={submitProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                      {t("firstName")}
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={form.firstName || ""}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                      />
                    ) : (
                      <p className="mt-1 font-semibold text-brand-navy">{form.firstName || "-"}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                      {t("lastName")}
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={form.lastName || ""}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                      />
                    ) : (
                      <p className="mt-1 font-semibold text-brand-navy">{form.lastName || "-"}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                      {t("dateOfBirth")}
                    </label>
                    {editMode ? (
                      <input
                        type="date"
                        value={form.dateOfBirth || ""}
                        onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                      />
                    ) : (
                      <p className="mt-1 font-semibold text-brand-navy">
                        {form.dateOfBirth
                          ? new Date(form.dateOfBirth).toLocaleDateString()
                          : "-"}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                      {t("gender")}
                    </label>
                    {editMode ? (
                      <select
                        value={form.gender || ""}
                        onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                      >
                        <option value="">{t("selectGender")}</option>
                        <option value="MALE">{t("genderMale")}</option>
                        <option value="FEMALE">{t("genderFemale")}</option>
                        <option value="OTHER">{t("genderOther")}</option>
                      </select>
                    ) : (
                      <p className="mt-1 font-semibold text-brand-navy">{form.gender || "-"}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                      {t("address")}
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={form.address || ""}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                      />
                    ) : (
                      <p className="mt-1 font-semibold text-brand-navy">{form.address || "-"}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                      {t("fatherName")}
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={form.fatherName || ""}
                        onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                      />
                    ) : (
                      <p className="mt-1 font-semibold text-brand-navy">{form.fatherName || "-"}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                      {t("motherName")}
                    </label>
                    {editMode ? (
                      <input
                        type="text"
                        value={form.motherName || ""}
                        onChange={(e) => setForm({ ...form, motherName: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-brand-navy/10 bg-sand px-3 py-2 text-sm"
                      />
                    ) : (
                      <p className="mt-1 font-semibold text-brand-navy">{form.motherName || "-"}</p>
                    )}
                  </div>
                </div>

                {editMode && (
                  <div className="mt-6 flex gap-2 justify-end border-t border-brand-navy/10 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode(false)
                        loadProfile()
                      }}
                      className="outline-button"
                      disabled={saving}
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={saving}
                    >
                      {saving ? t("loading") : t("save")}
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Dados Institucionais */}
            <div className="mt-6 rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
              <SectionHeader title={t("institutionalData")} />

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                    {t("email")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-brand-navy">{profile?.email}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                    {t("role")}
                  </p>
                  <p className="mt-1 inline-block rounded-full bg-brand-navy/10 px-3 py-1 text-xs font-semibold text-brand-navy">
                    {t("role" + profile?.role)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                    {t("enrollmentNumber")}
                  </p>
                  <p className="mt-1 font-semibold text-brand-navy">
                    {profile?.enrollmentNumber || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                    {t("status")}
                  </p>
                  <p className="mt-1 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Ativo
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserProfile
