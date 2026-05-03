import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"

function ProfessorLessonPlans() {
  const { token } = useAuth()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState("")
  const [plans, setPlans] = useState([])
  const [repository, setRepository] = useState([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    date: "",
    title: "",
    objectives: "",
    content: "",
    methodology: "",
    tags: "",
    visibility: "SCHOOL",
  })
  const [message, setMessage] = useState("")

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const myClasses = await apiFetch("/classes/my-classes", { token })
        setClasses(myClasses ?? [])
        if ((myClasses ?? []).length) setSelectedClass(myClasses[0].id)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchClasses()
  }, [token])

  useEffect(() => {
    const loadPlans = async () => {
      if (!selectedClass) return setPlans([])
      try {
        const remote = await apiFetch(`/lessons?classId=${encodeURIComponent(selectedClass)}`, { token })
        setPlans(remote ?? [])
      } catch (err) {
        // fallback to localStorage
        const key = `lessonplans:${selectedClass}`
        const local = JSON.parse(localStorage.getItem(key) || "[]")
        setPlans(local)
      }
    }

    loadPlans()
  }, [selectedClass, token])

  useEffect(() => {
    const loadRepository = async () => {
      try {
        const remote = await apiFetch(`/lessons/repository${search ? `?q=${encodeURIComponent(search)}` : ""}`, { token })
        setRepository(remote ?? [])
      } catch (err) {
        console.error(err)
      }
    }

    loadRepository()
  }, [search, token])

  const submitPlan = async (ev) => {
    ev.preventDefault()
    setMessage("")
    const payload = {
      classId: selectedClass,
      date: form.date,
      title: form.title,
      objectives: form.objectives,
      content: form.content,
      methodology: form.methodology,
      visibility: form.visibility,
      tags: form.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    }

    try {
      await apiFetch("/lessons", { method: "POST", body: payload, token })
      setMessage("Plano de aula salvo com sucesso.")
      setForm({ date: "", title: "", objectives: "", content: "", methodology: "", tags: "", visibility: "SCHOOL" })
      // try to refresh
      const refreshed = await apiFetch(`/lessons?classId=${encodeURIComponent(selectedClass)}`, { token })
      setPlans(refreshed ?? [])
    } catch (err) {
      // persist locally
      const key = `lessonplans:${selectedClass}`
      const existing = JSON.parse(localStorage.getItem(key) || "[]")
      const newPlan = { id: `local-${Date.now()}`, ...payload }
      const updated = [newPlan, ...existing]
      localStorage.setItem(key, JSON.stringify(updated))
      setPlans(updated)
      setMessage("Plano salvo localmente (sem backend).")
    }
  }

  if (loading) return <div className="text-center text-brand-navy">Carregando...</div>

  return (
    <div className="space-y-6">
      <SectionHeader title="Planos de Aula" subtitle="Crie e agende planos de aula para suas turmas." />

      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
        <h3 className="font-semibold text-brand-navy">Novo plano de aula</h3>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={submitPlan}>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="rounded-2xl border px-3 py-2 bg-sand">
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} className="rounded-2xl border px-3 py-2 bg-sand" required />

          <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Título" className="rounded-2xl border px-3 py-2 bg-sand md:col-span-2" required />

          <textarea value={form.objectives} onChange={(e) => setForm((p) => ({ ...p, objectives: e.target.value }))} placeholder="Objetivos" rows={3} className="rounded-2xl border px-3 py-2 bg-sand md:col-span-2" />

          <textarea value={form.methodology} onChange={(e) => setForm((p) => ({ ...p, methodology: e.target.value }))} placeholder="Metodologia (ex: aprendizagem baseada em projetos)" rows={2} className="rounded-2xl border px-3 py-2 bg-sand md:col-span-2" />

          <textarea value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} placeholder="Conteúdo / Atividades" rows={4} className="rounded-2xl border px-3 py-2 bg-sand md:col-span-2" />

          <input value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="Tags separadas por virgula (ex: matematica, jogo, avaliacao)" className="rounded-2xl border px-3 py-2 bg-sand md:col-span-2" />

          <select value={form.visibility} onChange={(e) => setForm((p) => ({ ...p, visibility: e.target.value }))} className="rounded-2xl border px-3 py-2 bg-sand md:col-span-2">
            <option value="SCHOOL">Compartilhar com outros professores</option>
            <option value="CLASS">Apenas turma atual</option>
          </select>

          <button className="primary-button md:col-span-2" type="submit">Salvar plano</button>
        </form>
      </section>

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
        <h3 className="font-semibold text-brand-navy">Planos existentes</h3>
        <div className="mt-3 space-y-3">
          {plans.length ? (
            plans.map((p) => (
              <div key={p.id} className="rounded-xl border p-3">
                <p className="font-semibold">{p.title} <span className="text-xs text-brand-navy/60">{p.date}</span></p>
                {p.objectives ? <p className="text-sm">{p.objectives}</p> : null}
                {p.methodology ? <p className="text-xs text-brand-navy/70">Metodologia: {p.methodology}</p> : null}
                {p.content ? <p className="text-xs text-brand-navy/60">{p.content}</p> : null}
                {Array.isArray(p.tags) && p.tags.length ? <p className="text-xs text-brand-navy/60 mt-1">Tags: {p.tags.join(", ")}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-brand-navy/60">Nenhum plano encontrado.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-4">
        <h3 className="font-semibold text-brand-navy">Repositorio colaborativo de metodologias</h3>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por titulo, tags ou metodologia"
          className="mt-3 w-full rounded-2xl border px-3 py-2 bg-sand"
        />
        <div className="mt-3 space-y-2">
          {repository.length ? (
            repository.slice(0, 12).map((plan) => (
              <div key={plan.id} className="rounded-xl border p-3">
                <p className="font-semibold text-brand-navy">{plan.title}</p>
                <p className="text-xs text-brand-navy/70">Turma: {plan.class?.name ?? "-"} | Autor: {plan.createdBy?.name ?? "Professor"}</p>
                {plan.methodology ? <p className="text-sm mt-1">{plan.methodology}</p> : null}
                {Array.isArray(plan.tags) && plan.tags.length ? <p className="text-xs text-brand-navy/60">Tags: {plan.tags.join(", ")}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-brand-navy/60">Sem resultados no repositorio.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export default ProfessorLessonPlans
