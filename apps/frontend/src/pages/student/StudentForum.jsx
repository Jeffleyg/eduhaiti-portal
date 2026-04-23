import { useEffect, useState } from "react"
import { useAuth } from "../../context/AuthContext.jsx"
import { apiFetch } from "../../lib/api.js"
import SectionHeader from "../../components/SectionHeader.jsx"

function StudentForum() {
  const { token } = useAuth()
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState("")
  const [threads, setThreads] = useState([])
  const [selectedThreadId, setSelectedThreadId] = useState("")
  const [threadDetails, setThreadDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [newThread, setNewThread] = useState({ title: "", body: "" })
  const [newPost, setNewPost] = useState("")

  const loadThreads = async (classId) => {
    if (!classId) {
      setThreads([])
      return
    }

    try {
      const data = await apiFetch(`/forums/class/${classId}/threads`, { token })
      setThreads(data ?? [])
    } catch (err) {
      setError(err.message)
    }
  }

  const loadPosts = async (threadId) => {
    if (!threadId) {
      setThreadDetails(null)
      return
    }

    try {
      const data = await apiFetch(`/forums/threads/${threadId}/posts`, { token })
      setThreadDetails(data)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true)
      try {
        const classData = await apiFetch("/classes/my-classes", { token })
        setClasses(classData ?? [])
        if (classData?.length > 0) {
          setSelectedClass(classData[0].id)
          await loadThreads(classData[0].id)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    bootstrap()
  }, [token])

  const onClassChange = async (value) => {
    setSelectedClass(value)
    setSelectedThreadId("")
    setThreadDetails(null)
    await loadThreads(value)
  }

  const createThread = async (event) => {
    event.preventDefault()
    if (!selectedClass || !newThread.title.trim() || !newThread.body.trim()) {
      return
    }

    try {
      await apiFetch(`/forums/class/${selectedClass}/threads`, {
        method: "POST",
        token,
        body: {
          title: newThread.title,
          body: newThread.body,
        },
      })
      setNewThread({ title: "", body: "" })
      await loadThreads(selectedClass)
    } catch (err) {
      setError(err.message)
    }
  }

  const createPost = async (event) => {
    event.preventDefault()
    if (!selectedThreadId || !newPost.trim()) {
      return
    }

    try {
      await apiFetch(`/forums/threads/${selectedThreadId}/posts`, {
        method: "POST",
        token,
        body: { body: newPost },
      })
      setNewPost("")
      await loadPosts(selectedThreadId)
      await loadThreads(selectedClass)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return <div className="text-center text-brand-navy">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Forum de Discussao" subtitle="Participe dos debates da sua turma." />
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-6 space-y-4">
        <h3 className="font-semibold text-brand-navy">Turma</h3>
        <select
          value={selectedClass}
          onChange={(event) => onClassChange(event.target.value)}
          className="w-full rounded-xl border border-brand-navy/20 px-3 py-2"
        >
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-6 space-y-4">
        <h3 className="font-semibold text-brand-navy">Abrir topico</h3>
        <form className="space-y-3" onSubmit={createThread}>
          <input
            value={newThread.title}
            onChange={(event) => setNewThread((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Titulo do topico"
            className="w-full rounded-xl border border-brand-navy/20 px-3 py-2"
          />
          <textarea
            value={newThread.body}
            onChange={(event) => setNewThread((prev) => ({ ...prev, body: event.target.value }))}
            placeholder="Mensagem inicial"
            rows={3}
            className="w-full rounded-xl border border-brand-navy/20 px-3 py-2"
          />
          <button className="primary-button" type="submit">Publicar topico</button>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-brand-navy/10 bg-white p-4 space-y-3">
          <h3 className="font-semibold text-brand-navy">Topicos</h3>
          {threads.length > 0 ? (
            threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => {
                  setSelectedThreadId(thread.id)
                  loadPosts(thread.id)
                }}
                className={`w-full rounded-xl border px-3 py-2 text-left ${
                  selectedThreadId === thread.id ? "border-brand-red bg-brand-red/5" : "border-brand-navy/10"
                }`}
              >
                <p className="font-semibold text-brand-navy">{thread.title}</p>
                <p className="text-xs text-brand-navy/60">{thread.postsCount} respostas</p>
              </button>
            ))
          ) : (
            <p className="text-sm text-brand-navy/60">Sem topicos nesta turma.</p>
          )}
        </div>

        <div className="rounded-2xl border border-brand-navy/10 bg-white p-4 space-y-3">
          <h3 className="font-semibold text-brand-navy">Discussao</h3>
          {threadDetails ? (
            <>
              <div className="rounded-xl border border-brand-navy/10 bg-sand p-3">
                <p className="font-semibold text-brand-navy">{threadDetails.thread.title}</p>
                <p className="text-sm text-brand-navy/70 mt-1">{threadDetails.thread.body}</p>
              </div>

              <div className="space-y-2">
                {threadDetails.posts.length > 0 ? (
                  threadDetails.posts.map((post) => (
                    <div key={post.id} className="rounded-xl border border-brand-navy/10 p-3">
                      <p className="text-xs text-brand-navy/60">{post.createdBy?.name ?? "Usuario"}</p>
                      <p className="text-sm text-brand-navy">{post.body}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-brand-navy/60">Sem respostas ainda.</p>
                )}
              </div>

              <form className="space-y-2" onSubmit={createPost}>
                <textarea
                  value={newPost}
                  onChange={(event) => setNewPost(event.target.value)}
                  rows={2}
                  placeholder="Responder ao topico"
                  className="w-full rounded-xl border border-brand-navy/20 px-3 py-2"
                />
                <button type="submit" className="primary-button">Enviar resposta</button>
              </form>
            </>
          ) : (
            <p className="text-sm text-brand-navy/60">Selecione um topico para ver a discussao.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export default StudentForum
