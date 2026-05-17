import { Camera, Mail, User, Settings, Edit3 } from "lucide-react"
import { useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { sanitizeText, maskName } from "../lib/string.js"
import { apiAssetUrl } from "../lib/api.js"

function ProfileCard({ user, onPhotoUpload, loading, onEditClick, onSettingsClick }) {
  const { t } = useTranslation()
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const fileInputRef = useRef(null)

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewPhoto(reader.result)
      }
      reader.readAsDataURL(file)
      await onPhotoUpload(file)
      setPreviewPhoto(null)
    }
  }

  const getRoleBadgeColor = () => {
    switch (user?.role) {
      case "ADMIN":
        return "bg-brand-red/10 text-brand-red"
      case "TEACHER":
        return "bg-brand-sky/10 text-brand-sky"
      case "STUDENT":
        return "bg-emerald-100 text-emerald-700"
      default:
        return "bg-brand-navy/10 text-brand-navy"
    }
  }

  const getRoleLabel = () => {
    switch (user?.role) {
      case "ADMIN":
        return t("roleadmin")
      case "TEACHER":
        return t("roleprofessor")
      case "STUDENT":
        return t("rolestudent")
      default:
        return user?.role || "-"
    }
  }

  return (
    <div className="space-y-4">
      {/* Cartão Principal com Foto e Dados */}
      <div className="rounded-[2rem] border border-brand-navy/10 bg-gradient-to-br from-white via-white to-brand-navy/5 p-6 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.45)]">
        {/* Foto de Perfil */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-brand-navy to-brand-sky shadow-lg ring-1 ring-brand-navy/10">
              {previewPhoto ? (
                <img src={previewPhoto} alt={maskName(user?.name, user?.role === "STUDENT" ? "student" : user?.role === "TEACHER" ? "teacher" : "user")} className="h-full w-full object-cover" />
              ) : user?.profilePhoto ? (
                <img src={apiAssetUrl(user.profilePhoto)} alt={maskName(user?.name, user?.role === "STUDENT" ? "student" : user?.role === "TEACHER" ? "teacher" : "user")} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-navy to-brand-sky">
                  <User className="h-12 w-12 text-white/60" />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-brand-navy p-2 text-white transition-colors hover:bg-brand-navy/90 disabled:opacity-50"
              title={t("uploadPhoto")}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
              disabled={loading}
            />
          </div>

          {/* Info ao lado da foto */}
          <div className="flex-1 space-y-3">
            {/* Role Badge */}
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeColor()}`}>
              {getRoleLabel()}
            </span>

            {/* Nome em Caixa */}
            <div className="rounded-xl border border-brand-navy/10 bg-white/60 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/45 mb-1">
                {t("name")}
              </p>
              <p className="text-lg font-bold text-brand-navy break-words">
                {maskName(user?.name, user?.role === "STUDENT" ? "student" : user?.role === "TEACHER" ? "teacher" : "user")}
              </p>
            </div>

            {/* Email em Caixa */}
            <div className="rounded-xl border border-brand-navy/10 bg-white/60 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/45 mb-1 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {t("email")}
              </p>
              <p className="text-sm font-semibold text-brand-navy break-words">
                {sanitizeText(user?.email) || "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Matrícula se for estudante */}
        {user?.role === "STUDENT" && user?.enrollmentNumber ? (
          <div className="mt-4 rounded-xl border border-brand-navy/10 bg-white/60 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/45 mb-1">
              {t("enrollmentNumber")}
            </p>
            <p className="font-semibold text-brand-navy">{user.enrollmentNumber}</p>
          </div>
        ) : null}

        {/* Botões de Ação */}
        <div className="mt-6 flex gap-2 border-t border-brand-navy/10 pt-4">
          <button
            onClick={onEditClick}
            type="button"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-brand-navy/20 bg-white/80 px-3 py-2 text-sm font-semibold text-brand-navy transition-all hover:bg-white hover:border-brand-navy/40 hover:-translate-y-0.5"
            title={t("editProfile")}
          >
            <Edit3 className="h-4 w-4" />
            <span className="hidden sm:inline">{t("edit")}</span>
          </button>
          <button
            onClick={onSettingsClick}
            type="button"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-brand-navy/20 bg-white/80 px-3 py-2 text-sm font-semibold text-brand-navy transition-all hover:bg-white hover:border-brand-navy/40 hover:-translate-y-0.5"
            title={t("settings")}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{t("settings")}</span>
          </button>
        </div>
      </div>

      {/* Dados Institucionais - Estudante */}
      {user?.role === "STUDENT" && (
        <div className="rounded-2xl border border-brand-navy/10 bg-white/60 p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/45">
            {t("institutionalData")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-brand-navy/60">{t("status")}</p>
              <p className="font-semibold text-emerald-700">{t("active")}</p>
            </div>
            <div>
              <p className="text-xs text-brand-navy/60">{t("registrationDate")}</p>
              <p className="font-semibold text-brand-navy">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-navy/60">{t("academicStatus")}</p>
              <p className="font-semibold text-brand-navy">{t("regular")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileCard
