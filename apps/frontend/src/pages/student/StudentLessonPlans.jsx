import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import SectionCard from "../../components/SectionCard";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import Feedback from "../../components/Feedback";
import Button from "../../components/Button";

export default function StudentLessonPlans() {
  const { t } = useTranslation();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const token = localStorage.getItem("token");
      const data = await apiFetch("/lessons", { token });
      setLessons(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      console.error("Erro ao carregar planos de aula:", err);
      setFeedback({
        type: "error",
        message: t("common.errorLoading", "Erè pandan chajman done yo"),
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState message={t("common.loading", "Chaje...")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {t("lessons.title", "Plan Kou ak Leson / Plans de Cours")}
          </h1>
          <p className="text-sm text-slate-500">
            {t("lessons.subtitle", "Kontni ak pwogramasyon kou pwofesè yo prepare")}
          </p>
        </div>
        <Button variant="outline" onClick={fetchLessons}>
          {t("common.refresh", "Rafrechi")}
        </Button>
      </div>

      {feedback && (
        <Feedback
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback(null)}
        />
      )}

      {lessons.length === 0 ? (
        <EmptyState
          title={t("lessons.emptyTitle", "Pa gen plan kou pibliye")}
          description={t("lessons.emptyDesc", "Pwofesè yo poko pibliye plan leson pou peryòd sa a.")}
        />
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson) => (
            <SectionCard key={lesson.id} className="p-5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    {lesson.discipline?.name || lesson.subject || t("common.discipline", "Matyè")}
                  </span>
                  <h3 className="text-lg font-bold text-slate-800 mt-1">{lesson.title}</h3>
                </div>
                {lesson.date && (
                  <span className="text-xs text-slate-400">
                    {new Date(lesson.date).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{lesson.content || lesson.objectives}</p>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}