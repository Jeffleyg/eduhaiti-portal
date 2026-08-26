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
        return "bg-brand-red/10 text-brand-red border-brand-red/20"
      case "TEACHER":
        return "bg-sky-50 text-sky-700 border-sky-200"
      case "STUDENT":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      default:
        return "bg-brand-navy/10 text-brand-navy border-brand-navy/20"
    }
  }

  const getRoleLabel = () => {
    switch (user?.role) {
      case "ADMIN":
        return t("roleadmin") || "Admin"
      case "TEACHER":
        return t("roleprofessor") || "Professor"
      case "STUDENT":
        return t("rolestudent") || "Aluno"
      default:
        return user?.role || "-"
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-navy/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
          
          {/* Avatar com botão de upload integrado */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative group shrink-0">
              <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-brand-navy to-brand-sky shadow-sm ring-1 ring-brand-navy/10">
                {previewPhoto ? (
                  <img
                    src={previewPhoto}
                    alt={maskName(user?.name, user?.role === "STUDENT" ? "student" : user?.role === "TEACHER" ? "teacher" : "user")}
                    className="h-full w-full object-cover"
                  />
                ) : user?.profilePhoto ? (
                  <img
                    src={apiAssetUrl(user.profilePhoto)}
                    alt={maskName(user?.name, user?.role === "STUDENT" ? "student" : user?.role === "TEACHER" ? "teacher" : "user")}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-brand-navy">
                    <User className="h-7 w-7 text-white/80" />
                  </div>
                )}
              </div>

              {/* Botão de câmera sobreposto ao avatar */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title={t("uploadPhoto")}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-brand-navy shadow border border-brand-navy/15 hover:bg-sand transition-transform hover:scale-105 disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
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

            {/* Informações de Nome, Tag e E-mail */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-brand-navy truncate">
                  {loading ? (
                    <span className="inline-block h-5 w-28 bg-brand-navy/10 animate-pulse rounded" />
                  ) : (
                    maskName(user?.name, user?.role === "STUDENT" ? "student" : user?.role === "TEACHER" ? "teacher" : "user")
                  )}
                </h2>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeColor()}`}>
                  {getRoleLabel()}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-1.5 text-xs text-brand-navy/70 truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {loading ? (
                    <span className="inline-block h-3.5 w-36 bg-brand-navy/10 animate-pulse rounded" />
                  ) : (
                    sanitizeText(user?.email) || "-"
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Ações de Edição e Configurações */}
          <div className="flex items-center gap-1 self-end sm:self-center">
            {onEditClick && (
              <button
                onClick={onEditClick}
                type="button"
                disabled={loading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-navy/70 border border-transparent hover:border-brand-navy/10 hover:bg-sand transition-all disabled:opacity-50"
                title={t("editProfile")}
              >
                <Edit3 className="h-4 w-4" />
                <span className="sr-only">{t("edit")}</span>
              </button>
            )}
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                type="button"
                disabled={loading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-navy/70 border border-transparent hover:border-brand-navy/10 hover:bg-sand transition-all disabled:opacity-50"
                title={t("settings")}
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">{t("settings")}</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Dados institucionais (somente para alunos) */}
      {user?.role === "STUDENT" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-brand-navy/10 bg-white p-3 text-xs">
            <p className="text-brand-navy/60 font-medium">{t("status")}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-700">{t("active")}</p>
          </div>
          <div className="rounded-xl border border-brand-navy/10 bg-white p-3 text-xs">
            <p className="text-brand-navy/60 font-medium">{t("registrationDate")}</p>
            <p className="mt-1 text-sm font-semibold text-brand-navy">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
            </p>
          </div>
          <div className="rounded-xl border border-brand-navy/10 bg-white p-3 text-xs">
            <p className="text-brand-navy/60 font-medium">{t("academicStatus")}</p>
            <p className="mt-1 text-sm font-semibold text-brand-navy">{t("regular")}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileCard