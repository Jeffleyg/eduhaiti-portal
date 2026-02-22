import SectionHeader from "../../components/SectionHeader.jsx"
import { studentHomework } from "../../data/mockData.js"
import { useTranslation } from "react-i18next"

function StudentHomework() {
  const { t } = useTranslation()

  return (
    <div>
      <SectionHeader title={t("navHomework")} subtitle={t("homeworkSubtitle")} />
      <div className="space-y-3">
        {studentHomework.map((item) => (
          <div
            key={`${item.title}-${item.due}`}
            className="flex items-center justify-between rounded-2xl border border-brand-navy/10 bg-white px-4 py-4"
          >
            <div>
              <p className="font-semibold text-brand-navy">{item.title}</p>
              <p className="text-sm text-brand-navy/60">{item.status}</p>
            </div>
            <span className="text-sm text-brand-navy/70">{item.due}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default StudentHomework
