import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import SectionCard from "../../components/SectionCard";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import Feedback from "../../components/Feedback";

export default function StudentHomework() {
  const { t } = useTranslation();
  const [homeworks, setHomeworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetchHomework();
  }, []);

  const fetchHomework = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const token = localStorage.getItem("token");
      const data = await apiFetch("/assignments", { token });
      setHomeworks(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      console.error("Erro ao carregar deveres de casa:", err);
      setFeedback({
        type: "error",
        message: t("common.errorLoading", "Erè pandan chajman done yo / Erreur lors du chargement"),
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (dueDate) => {
    if (!dueDate) return <Badge variant="neutral">{t("homework.noDueDate", "San dat limit")}</Badge>;
    const isPast = new Date(dueDate) < new Date();
    return isPast ? (
      <Badge variant="danger">{t("homework.expired", "Ekspire / Expiré")}</Badge>
    ) : (
      <Badge variant="success">{t("homework.pending", "An kou / En cours")}</Badge>
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
            {t("homework.title", "Devwa ak Egzèsis / Devoirs et Exercices")}
          </h1>
          <p className="text-sm text-slate-500">
            {t("homework.subtitle", "Lis devwa ak travay pou remèt")}
          </p>
        </div>
        <Button variant="outline" onClick={fetchHomework}>
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

      {homeworks.length === 0 ? (
        <EmptyState
          title={t("homework.emptyTitle", "Pa gen devwa pou kounye a")}
          description={t("homework.emptyDesc", "Ou pa gen okenn travay oswa devwa an kou pou remèt.")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {homeworks.map((item) => (
            <SectionCard key={item.id} className="flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700">
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
                    ? `${t("homework.due", "Pou remèt")}: ${new Date(item.dueDate).toLocaleDateString()}`
                    : t("homework.noDate", "San dat")}
                </span>
                {item.attachmentUrl && (
                  <a
                    href={item.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline font-medium"
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