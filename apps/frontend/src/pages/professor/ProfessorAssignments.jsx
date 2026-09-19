import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import SectionCard from "../../components/SectionCard";
import Button from "../../components/Button";
import Badge from "../../components/Badge";
import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import Feedback from "../../components/Feedback";

export default function ProfessorAssignments() {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    classId: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const token = localStorage.getItem("token");

      const [assignmentsRes, classesRes] = await Promise.all([
        apiFetch("/assignments", { token }).catch(() => []),
        apiFetch("/classes", { token }).catch(() => []),
      ]);

      setAssignments(Array.isArray(assignmentsRes) ? assignmentsRes : assignmentsRes?.data || []);
      setClasses(Array.isArray(classesRes) ? classesRes : classesRes?.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados do professor:", err);
      setFeedback({
        type: "error",
        message: t("common.errorLoading", "Erè pandan chajman done yo"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.classId) {
      setFeedback({
        type: "error",
        message: t("assignments.validationError", "Tanpri ranpli tout chan obligatwa yo"),
      });
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      const payload = {
        title: formData.title,
        description: formData.description,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        classId: formData.classId,
      };

      await apiFetch("/assignments", {
        method: "POST",
        token,
        body: payload,
      });

      setFeedback({
        type: "success",
        message: t("assignments.createSuccess", "Devwa pibliye avèk siksè!"),
      });
      setShowModal(false);
      setFormData({ title: "", description: "", dueDate: "", classId: "" });
      loadData();
    } catch (err) {
      console.error("Erro ao criar tarefa:", err);
      setFeedback({
        type: "error",
        message: err.message || t("assignments.createError", "Erè pandan kreyasyon devwa a"),
      });
    } finally {
      setSubmitting(false);
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
            {t("assignments.teacherTitle", "Jesyon Devwa ak Travay / Gestion des Devoirs")}
          </h1>
          <p className="text-sm text-slate-500">
            {t("assignments.teacherSubtitle", "Kreye ak kontwole travay ou bay elèv yo")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            {t("common.refresh", "Rafrechi")}
          </Button>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            {t("assignments.newAssignment", "+ Nouvo Devwa")}
          </Button>
        </div>
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
          title={t("assignments.teacherEmptyTitle", "Ou poko kreye okenn devwa")}
          description={t("assignments.teacherEmptyDesc", "Klike sou bouton anwo a pou pibliye yon devwa pou elèv yo.")}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((item) => (
            <SectionCard key={item.id} className="flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700">
                    {item.class?.name || t("common.class", "Klas")}
                  </span>
                  <Badge variant={new Date(item.dueDate) < new Date() ? "danger" : "success"}>
                    {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : t("assignments.noDueDate", "San dat")}
                  </Badge>
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-600 line-clamp-3 mb-4">{item.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>ID: {item.id.slice(0, 8)}...</span>
                <span>{item.class?.gradeLevel || ""}</span>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {/* Modal de Criação Simples */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-800">
              {t("assignments.createModalTitle", "Kreye yon Nouvo Devwa")}
            </h2>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("assignments.selectClass", "Klas")} *
                </label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  required
                >
                  <option value="">-- {t("common.select", "Chwazi yon klas")} --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.academicYear || ""})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("assignments.formTitle", "Tit devwa a")} *
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Devoir de Mathématiques #1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("assignments.formDueDate", "Dat limit pou remèt")}
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t("assignments.formDesc", "Deskripsyon ak Enstriksyon")}
                </label>
                <textarea
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enstriksyon pou elèv yo..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>
                  {t("common.cancel", "Anile")}
                </Button>
                <Button variant="primary" type="submit" disabled={submitting}>
                  {submitting ? t("common.saving", "Ap anrejistre...") : t("common.publish", "Pibliye")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}