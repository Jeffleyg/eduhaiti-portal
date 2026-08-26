import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/api.js'

function SchoolFeatures({ schoolId, token }) {
  const [features, setFeatures] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadFeatures()
  }, [schoolId, token])

  const loadFeatures = async () => {
    setLoading(true)
    try {
      const data = await apiFetch(`/owner/schools/${schoolId}/features`, { token })
      setFeatures(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (feature) => {
    if (!features || typeof features !== 'object') return

    setSaving(true)
    try {
      const updated = await apiFetch(`/owner/schools/${schoolId}/features`, {
        method: 'PATCH',
        token,
        body: {
          [feature]: !features[feature],
        },
      })
      setFeatures(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>{t("loadingResources")}</p>

  const featuresList = [
    { key: 'enableFamilyAccess', label: `👨‍👩‍👧‍👦 ${t("familyAccessTitle")}`, icon: '👨‍👩‍👧' },
    { key: 'enablePayment', label: `💳 ${t("paymentMethods")}`, icon: '💳' },
    { key: 'enableGamification', label: `🎮 ${t("gamificationTitle")}`, icon: '🎮' },
    { key: 'enableForums', label: `💬 ${t("forumsTitle")}`, icon: '💬' },
    { key: 'enableLessons', label: `📖 ${t("lessonPlansTitle")}`, icon: '📖' },
    { key: 'enableInventory', label: `📦 ${t("inventoryTitle")}`, icon: '📦' },
    { key: 'enableFinance', label: `💰 ${t("financeControlTitle")}`, icon: '💰' },
    { key: 'enableSync', label: '🔄 Sincronização', icon: '🔄' },
  ]

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-brand-navy text-sm">Recursos da Escola</h4>
      {error && <p className="text-xs text-brand-red">{error}</p>}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
        {featuresList.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleToggle(key)}
            disabled={saving}
            className={`rounded-lg p-2 text-xs font-semibold transition-colors ${
              features?.[key]
                ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            {icon} {label.split(' ')[1]}
          </button>
        ))}
      </div>
    </div>
  )
}

export default SchoolFeatures
