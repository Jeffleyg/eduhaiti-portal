import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

function Landing() {
  const { t } = useTranslation()

  const professorFeatures = [
    { icon: LayoutDashboard, label: t("professorDashboard") },
    { icon: ClipboardCheck, label: t("professorAttendance") },
    { icon: GraduationCap, label: t("professorGrades") },
    { icon: UploadCloud, label: t("professorResources") },
  ]

  const studentFeatures = [
    { icon: BookOpen, label: t("studentResults") },
    { icon: CalendarDays, label: t("studentSchedule") },
    { icon: ClipboardCheck, label: t("studentHomework") },
    { icon: Mail, label: t("studentMessaging") },
  ]

  const metrics = [
    { value: "96%", label: t("metricAttendance") },
    { value: "248", label: t("metricGrades") },
    { value: "32", label: t("metricMessages") },
    { value: "18", label: t("metricTasks") },
  ]

  const systemHighlights = [
    { icon: Sparkles, title: t("systemTitle"), copy: t("systemCopy") },
    { icon: ShieldCheck, title: t("securityTitle"), copy: t("securityCopy") },
    { icon: Users, title: t("communityTitle"), copy: t("communityCopy") },
  ]

  return (
    <div className="relative min-h-screen bg-sand">
      <div className="pointer-events-none absolute inset-0 bg-atlas bg-grid opacity-70" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-navy text-sm font-semibold text-white shadow-lg shadow-brand-navy/20">
              EH
            </div>
            <div>
              <p className="font-display text-2xl text-brand-navy">{t("brand")}</p>
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand-red/70">
                {t("appSubtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="chip">{t("languageLabel")}</span>
            <Link className="outline-button" to="/login">
              {t("login")}
            </Link>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-12 pt-10">
          <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <span className="chip">{t("trust")}</span>
              <h1 className="text-4xl font-semibold leading-tight text-brand-navy md:text-5xl">
                {t("tagline")}
              </h1>
              <p className="max-w-xl text-lg text-brand-navy/80">{t("subtitle")}</p>
              <div className="flex flex-wrap gap-4">
                <Link className="primary-button" to="/login">
                  {t("cta")}
                </Link>
                <Link className="outline-button" to="/professor">
                  {t("secondaryCta")}
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {metrics.map((metric, index) => (
                  <div
                    key={metric.label}
                    className="glass-panel rounded-2xl px-4 py-3 text-left fade-rise"
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    <p className="text-2xl font-semibold text-brand-navy">{metric.value}</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-navy/60">
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel space-y-6 rounded-3xl p-6 shadow-xl">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-brand-navy/10 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-red/70">
                    {t("professorSpace")}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-brand-navy">{t("professorLabel")}</p>
                  <div className="mt-4 space-y-3">
                    {professorFeatures.map((item) => (
                      <div key={item.label} className="flex items-center gap-3 text-sm text-brand-navy/80">
                        <item.icon className="h-4 w-4 text-brand-red" />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-navy/10 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-sky/80">
                    {t("studentSpace")}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-brand-navy">{t("studentLabel")}</p>
                  <div className="mt-4 space-y-3">
                    {studentFeatures.map((item) => (
                      <div key={item.label} className="flex items-center gap-3 text-sm text-brand-navy/80">
                        <item.icon className="h-4 w-4 text-brand-sky" />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-brand-navy px-5 py-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
                  {t("metricsTitle")}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="flex items-center justify-between">
                      <span className="text-sm text-white/70">{metric.label}</span>
                      <span className="text-sm font-semibold">{metric.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            {systemHighlights.map((item, index) => (
              <div
                key={item.title}
                className="rounded-3xl border border-brand-navy/10 bg-mist/80 p-6 shadow-lg shadow-brand-navy/5 fade-rise"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <item.icon className="h-6 w-6 text-brand-navy" />
                <h3 className="mt-4 text-lg font-semibold text-brand-navy">{item.title}</h3>
                <p className="mt-2 text-sm text-brand-navy/70">{item.copy}</p>
              </div>
            ))}
          </section>
        </main>

        <footer className="mt-12 text-center text-xs font-medium uppercase tracking-[0.2em] text-brand-navy/50">
          {t("footer")}
        </footer>
      </div>
    </div>
  )
}

export default Landing
