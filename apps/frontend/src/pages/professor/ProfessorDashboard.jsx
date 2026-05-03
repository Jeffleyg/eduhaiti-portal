import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"
import StatCard from "../../components/StatCard.jsx"
import { useTranslation } from "react-i18next"
import { formatLastUpdated, readHomeCache, writeHomeCache } from "../../offline/sqliteCache"
import { useSurvivalMode } from "../../context/useSurvivalMode.js"
import { useSyncControl } from "../../context/useSyncControl.js"
import LoadMoreList from "../../components/LoadMoreList.jsx"

function ProfessorDashboard() {
  const { t, i18n } = useTranslation()
  const { token } = useAuth()
  const { disableBackgroundSync } = useSurvivalMode()
  const { syncRevision } = useSyncControl()
  const cached = readHomeCache("professor")
  const [stats, setStats] = useState(cached.data?.stats ?? {})
  const [recentMessages, setRecentMessages] = useState(cached.data?.recentMessages ?? [])
  const [classes, setClasses] = useState(cached.data?.classes ?? [])
  const [leaderboard, setLeaderboard] = useState(cached.data?.leaderboard ?? [])
  const [lastUpdatedAt, setLastUpdatedAt] = useState(cached.lastUpdatedAt)
  const [loading, setLoading] = useState(!cached.data)

  useEffect(() => {
    if (!token || disableBackgroundSync) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const [classesRes, messagesRes] = await Promise.all([
          apiFetch("/classes/my-classes", { token }),
          apiFetch("/messages/inbox", { token }),
        ])

        let leaderboardSnapshot = []
        if ((classesRes ?? []).length > 0) {
          const firstClassId = classesRes[0].id
          const gamificationRes = await apiFetch(`/gamification/class/${firstClassId}/leaderboard`, { token })
          leaderboardSnapshot = (gamificationRes?.leaderboard ?? []).slice(0, 5)
        }

        setClasses(classesRes ?? [])
        setRecentMessages((messagesRes ?? []).slice(0, 3))
        setLeaderboard(leaderboardSnapshot)
        const computedStats = {
          attendance: "96%",
          grades: classesRes && classesRes[0] ? "~24" : "0",
          messages: (messagesRes ?? []).length,
          tasks: "18",
        }

        setStats(computedStats)

        const updatedAt = writeHomeCache("professor", {
          classes: classesRes ?? [],
          recentMessages: (messagesRes ?? []).slice(0, 3),
          stats: computedStats,
          leaderboard: leaderboardSnapshot,
        })
        setLastUpdatedAt(updatedAt)
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token, disableBackgroundSync, syncRevision])

  if (loading) {
    return <div className="text-center text-brand-navy">{t("loading")}</div>
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t("navOverview")} subtitle={t("professorDashboardIntro")} />
      <div className="rounded-xl border border-brand-navy/10 bg-sand px-3 py-2 text-xs text-brand-navy/70">
        {t("lastUpdatedLabel")} {formatLastUpdated(lastUpdatedAt, i18n.resolvedLanguage || i18n.language)}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label={t("metricAttendance")} value={stats.attendance ?? "0"} />
        <StatCard label={t("metricGrades")} value={stats.grades ?? "0"} />
        <StatCard label={t("metricMessages")} value={stats.messages ?? "0"} />
        <StatCard label={t("metricTasks")} value={stats.tasks ?? "0"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
          <SectionHeader title={t("myClasses")} />
          <div className="space-y-3">
            {classes.length > 0 ? (
              <LoadMoreList
                items={classes}
                initialLimit={4}
                step={4}
                continueLabel={t("continue") || "Continuar"}
                renderItem={(cls) => (
                  <div key={cls.id} className="flex items-center justify-between rounded-2xl bg-sand px-4 py-3 text-sm">
                    <span className="font-semibold text-brand-navy">{cls.name}</span>
                    <span className="text-brand-navy/70">{cls.students?.length ?? 0} {t("students")}</span>
                  </div>
                )}
              />
            ) : (
              <p className="text-sm text-brand-navy/60">{t("noData")}</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
          <SectionHeader title={t("recentMessages")} />
          <div className="space-y-3">
            {recentMessages.length > 0 ? (
              recentMessages.map((message) => (
                <div key={message.id} className="flex items-center justify-between rounded-2xl bg-sand px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-brand-navy">{message.from?.name ?? message.from?.email}</p>
                    <p className="text-brand-navy/70">{message.subject}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-brand-navy/60">{t("noData")}</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-navy/10 bg-white p-5">
        <SectionHeader title="Gamificacao da Turma" subtitle="Ranking parcial de engajamento" />
        <div className="space-y-2">
          {leaderboard.length ? (
            leaderboard.map((entry, index) => (
              <div key={entry.student?.id ?? index} className="flex items-center justify-between rounded-xl border px-3 py-2">
                <div>
                  <p className="font-semibold text-brand-navy">{index + 1}. {entry.student?.name ?? entry.student?.email ?? "Aluno"}</p>
                  <p className="text-xs text-brand-navy/60">Presenca: {entry.attendanceRate ?? 0}% | Entregas antecipadas: {entry.earlySubmissions ?? 0}</p>
                </div>
                <span className="text-sm font-bold text-brand-red">{entry.points ?? 0} pts</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-brand-navy/60">Sem dados de gamificacao para a turma selecionada.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfessorDashboard
