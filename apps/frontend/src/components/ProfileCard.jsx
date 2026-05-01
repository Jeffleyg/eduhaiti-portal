import { Camera, Mail, User } from "lucide-react"
import { useState, useRef } from "react"
import { useTranslation } from "react-i18next"

function ProfileCard({ user, onPhotoUpload, loading }) {
  const { t } = useTranslation()
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const fileInputRef = useRef(null)

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewPhoto(reader.result)
        onPhotoUpload(file, reader.result)
      }
      reader.readAsDataURL(file)
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

  return (
    <div className="space-y-4">
      {/* Card com Foto */}
      <div className="rounded-3xl border border-brand-navy/10 bg-gradient-to-br from-brand-navy/5 to-transparent p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* Foto de Perfil */}
          <div className="relative">
            <div className="h-24 w-24 rounded-full border-4 border-brand-navy/10 bg-gradient-to-br from-brand-navy to-brand-sky overflow-hidden shadow-lg">
              {previewPhoto ? (
                <img src={previewPhoto} alt={user?.name} className="h-full w-full object-cover" />
              ) : user?.profilePhoto ? (
                <img src={user.profilePhoto} alt={user?.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-navy to-brand-sky">
                  <User className="h-12 w-12 text-white/60" />
                </div>
              )}
            </div>

            {/* Botão de Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-brand-navy p-2 text-white hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
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

          {/* Informações do Usuário */}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50">
                {t("name")}
              </p>
              <h2 className="text-2xl font-bold text-brand-navy">{user?.name}</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getRoleBadgeColor()}`}>
                {t("role" + user?.role)}
              </span>
              {user?.enrollmentNumber && (
                <span className="inline-block rounded-full bg-brand-navy/10 px-3 py-1 text-xs font-semibold text-brand-navy">
                  {user.enrollmentNumber}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-brand-navy/70">
              <Mail className="h-4 w-4" />
              {user?.email}
            </div>
          </div>
        </div>
      </div>

      {/* Dados Institucionais */}
      {user?.role === "STUDENT" && (
        <div className="rounded-2xl border border-brand-navy/10 bg-white/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-navy/50 mb-3">
            {t("institutionalData")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-brand-navy/60">{t("enrollmentNumber")}</p>
              <p className="font-semibold text-brand-navy">{user?.enrollmentNumber || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-brand-navy/60">{t("status")}</p>
              <p className="font-semibold text-emerald-700">Ativo</p>
            </div>
            <div>
              <p className="text-xs text-brand-navy/60">{t("registrationDate")}</p>
              <p className="font-semibold text-brand-navy">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-navy/60">{t("academicStatus")}</p>
              <p className="font-semibold text-brand-navy">Regular</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfileCard
