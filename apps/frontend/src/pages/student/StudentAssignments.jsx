import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import SectionCard from "../../components/SectionCard";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import Feedback from "../../components/Feedback";

export default function StudentAssignments() {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const token = localStorage.getItem("token");
      const data = await apiFetch("/assignments", { token });
      setAssignments(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      console.error("Erro ao carregar tarefas:", err);
      setFeedback({
        type: "error",
        message: t("common.errorLoading", "Erè pandan chajman done yo / Erreur lors du chargement"),
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (dueDate) => {
    if (!dueDate) return <Badge variant="neutral">{t("assignments.noDueDate", "San dat limit")}</Badge>;
    const isPast = new Date(dueDate) < new Date();
    return isPast ? (
      <Badge variant="danger">{t("assignments.expired", "Ekspire / Expiré")}</Badge>
    ) : (
      <Badge variant="success">{t("assignments.open", "Ouvè / Ouvert")}</Badge>
    );
  };

  if (loading) {
    return <LoadingState message={t("common.loading", "Chaje...")} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {t("assignments.title", "Devwa ak Travay / Devoirs et Travaux")}
          </h1>
          <p className="text-sm text-slate-500">
            {t("assignments.subtitle", "Lis travay pwofesè yo mande pou remèt")}
          </p>
        </div>
        <Button variant="outline" onClick={fetchAssignments}>
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

      {assignments.length === 0 ? (
        <EmptyState
          title={t("assignments.emptyTitle", "Pa gen okenn devwa aktif")}
          description={t("assignments.emptyDesc", "Tout travay yo ajou oswa pwofesè yo poko pibliye devwa.")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((item) => (
            <SectionCard key={item.id} className="flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-indigo-50 text-indigo-700">
                    {item.discipline?.name || item.subject || t("common.discipline", "Matyè")}
                  </span>
                  {getStatusBadge(item.dueDate)}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-600 line-clamp-3 mb-4">{item.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {item.dueDate
                    ? `${t("assignments.dueDate", "Dat limit")}: ${new Date(item.dueDate).toLocaleDateString()}`
                    : t("assignments.noDueDate", "San dat limit")}
                </span>
                {item.fileUrl && (
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline font-medium"
                  >
                    {t("common.downloadFile", "Telechaje fichye")}
                  </a>
                )}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}