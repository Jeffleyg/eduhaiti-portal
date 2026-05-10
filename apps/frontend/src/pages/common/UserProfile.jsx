import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import SectionHeader from "../../components/SectionHeader.jsx"
import ProfileCard from "../../components/ProfileCard.jsx"
import SkeletonLoader from "../../components/SkeletonLoader.jsx"
import LoadingState from "../../components/LoadingState.jsx"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch, apiUpload } from "../../lib/api.js"

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
  const { token, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [editMode, setEditMode] = useState(false)

  const quickActions = [
    {
      label: t("profileAcademicHistory"),
      description: t("profileAcademicHistoryDescription"),
      onClick: () => navigate("/student/resultats"),
    },
    {
      label: t("profileDocuments"),
      description: t("profileDocumentsDescription"),
      onClick: () => navigate("/student/ressources"),
    },
    {
      label: t("profileMessages"),
      description: t("profileMessagesDescription"),
      onClick: () => navigate("/student/messages"),
    },
  ]

  const getRoleLabel = (role) => {
    switch (role) {
      case "ADMIN":
        return t("roleadmin")
      case "TEACHER":
        return t("roleprofessor")
      case "STUDENT":
        return t("rolestudent")
      default:
        return role || "-"
    }
  }

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

  const handlePhotoUpload = async (file) => {
    setSaving(true)
    setError("")
    setMessage("")

    try {
      const formData = new FormData()
      formData.append("profilePhoto", file)

      const response = await apiUpload("/auth/profile-photo", {
        method: "POST",
        token,
        formData,
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
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <SkeletonLoader type="dashboard" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sand">
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
            <ProfileCard 
              user={profile} 
              onPhotoUpload={handlePhotoUpload} 
              loading={saving}
              onEditClick={() => setEditMode(!editMode)}
              onSettingsClick={() => navigate('/student/settings')}
            />

            {/* Quick Links */}
            {profile?.role === "STUDENT" ? (
              <div className="mt-6 space-y-3 rounded-3xl border border-brand-navy/10 bg-white/70 p-4 shadow-sm">
                <p className="px-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand-navy/45">
                  {t("profileQuickAccess")}
                </p>
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="group w-full rounded-2xl border border-brand-navy/10 bg-sand/60 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand-navy/20 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-brand-navy group-hover:text-brand-red">{action.label}</p>
                        <p className="mt-1 text-xs leading-5 text-brand-navy/60">{action.description}</p>
                      </div>
                      <span className="mt-0.5 text-brand-navy/30 transition-colors group-hover:text-brand-red">→</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Conteúdo Principal */}
          <div className="lg:col-span-2">
            {/* Dados Pessoais */}
            <div className="rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
              <div className="mb-6 flex items-center justify-between">
                <SectionHeader title={t("profilePersonalData")} subtitle={t("profilePersonalDataSubtitle")} />
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
                  <div className="mt-6 flex gap-3 justify-end border-t border-brand-navy/10 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode(false)
                        loadProfile()
                      }}
                      className="rounded-xl border border-brand-navy/20 bg-white/80 px-6 py-2.5 text-sm font-semibold text-brand-navy transition-all hover:bg-white hover:border-brand-navy/40"
                      disabled={saving}
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="submit"
                      className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-navy to-brand-navy/80 px-8 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                          {t("loading")}
                        </>
                      ) : (
                        t("save")
                      )}
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Dados Institucionais */}
            <div className="mt-6 rounded-3xl border border-brand-navy/10 bg-white/70 p-6">
              <SectionHeader title={t("profileInstitutionalData")} subtitle={t("profileInstitutionalDataSubtitle")} />

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
                    {getRoleLabel(profile?.role)}
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
                    {t("active")}
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
