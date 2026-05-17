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
    <div>
      {/* Compact dashboard-like card */}
      <div className="module-card compact card-compact rounded-xl border border-brand-navy/8 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-12 gap-3 items-center">
          <div className="col-span-3">
            <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-brand-navy to-brand-sky ring-1 ring-brand-navy/8">
              {previewPhoto ? (
                <img src={previewPhoto} alt={maskName(user?.name, user?.role === "STUDENT" ? "student" : user?.role === "TEACHER" ? "teacher" : "user")} className="h-full w-full object-cover" />
              ) : user?.profilePhoto ? (
                <img src={apiAssetUrl(user.profilePhoto)} alt={maskName(user?.name, user?.role === "STUDENT" ? "student" : user?.role === "TEACHER" ? "teacher" : "user")} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-brand-navy">
                  <User className="h-6 w-6 text-white/80" />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
              disabled={loading}
            />
          </div>

          <div className="col-span-6">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-brand-navy">
                {loading ? <span className="skeleton h-5 w-32 rounded" /> : maskName(user?.name, user?.role === "STUDENT" ? "student" : user?.role === "TEACHER" ? "teacher" : "user")}
              </h2>
              <span className={`badge ${getRoleBadgeColor()} text-xs py-0.5 px-2`}>{getRoleLabel()}</span>
            </div>
            <p className="text-xs text-brand-navy/75">{loading ? <span className="skeleton h-4 w-40 rounded" /> : sanitizeText(user?.email) || "-"}</p>
          </div>

          <div className="col-span-3 flex items-center justify-end gap-2">
            <button
              onClick={onEditClick}
              type="button"
              disabled={loading}
              className="rounded-full p-2 text-brand-navy/80 hover:bg-brand-navy/5 transition-colors disabled:opacity-50"
              title={t("editProfile")}
            >
              <Edit3 className="h-4 w-4" />
              <span className="sr-only">{t("edit")}</span>
            </button>
            <button
              onClick={onSettingsClick}
              type="button"
              disabled={loading}
              className="rounded-full p-2 text-brand-navy/80 hover:bg-brand-navy/5 transition-colors disabled:opacity-50"
              title={t("settings")}
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">{t("settings")}</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="rounded-full p-2 text-brand-navy/80 hover:bg-brand-navy/5 transition-colors disabled:opacity-50"
              title={t("uploadPhoto")}
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Institutional data inline for dashboard compactness */}
      {user?.role === "STUDENT" && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-brand-navy/8 bg-white/95 px-3 py-2 text-xs text-brand-navy/85">
            <p className="font-semibold">{t("status")}</p>
            <p className="text-emerald-700 text-sm">{t("active")}</p>
          </div>
          <div className="rounded-xl border border-brand-navy/8 bg-white/95 px-3 py-2 text-xs text-brand-navy/85">
            <p className="font-semibold">{t("registrationDate")}</p>
            <p className="text-sm">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</p>
          </div>
          <div className="rounded-xl border border-brand-navy/8 bg-white/95 px-3 py-2 text-xs text-brand-navy/85">
            <p className="font-semibold">{t("academicStatus")}</p>
            <p className="text-sm">{t("regular")}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileCard
