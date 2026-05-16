# 🚀 Migration Guide - Updating Pages to New Components

## Overview

This guide shows how to migrate existing pages to use the new professional component library.

---

## Example 1: Form Page Migration

### BEFORE (Old Pattern)
```jsx
export default function StudentEdit() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    setLoading(true)
    try {
      // API call
      alert("Aluno atualizado!")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Editar Aluno</h1>
      
      {error && <div className="text-red-600 mb-4">{error}</div>}
      
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2">Nome</label>
        <input
          className="w-full rounded-2xl border border-brand-navy/10 px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do aluno"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2">Email</label>
        <input
          type="email"
          className="w-full rounded-2xl border border-brand-navy/10 px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
      </div>
      
      <div className="flex gap-2">
        <button
          className="rounded-2xl px-4 py-2 bg-brand-red text-white hover:brightness-95"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Salvando..." : "Salvar"}
        </button>
        <button className="rounded-2xl px-4 py-2 border border-brand-navy/10">
          Cancelar
        </button>
      </div>
    </div>
  )
}
```

### AFTER (New Pattern)
```jsx
import { Button, FormField, Alert, useToast } from "@/components"

export default function StudentEdit() {
  const [formData, setFormData] = useState({ name: "", email: "" })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = "Nome é obrigatório"
    if (!formData.email.trim()) newErrors.email = "Email é obrigatório"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email inválido"
    }
    return newErrors
  }

  const handleSave = async () => {
    const newErrors = validateForm()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      // API call
      showToast({
        type: "success",
        title: "Sucesso!",
        message: "Aluno atualizado com sucesso"
      })
    } catch (err) {
      showToast({
        type: "error",
        title: "Erro",
        message: err.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-responsive py-xl">
      <h1 className="text-headline mb-xl">Editar Aluno</h1>
      
      <div className="max-w-2xl space-y-lg">
        <FormField
          label="Nome"
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          placeholder="Nome completo do aluno"
          error={errors.name}
          required
        />
        
        <FormField
          label="Email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="email@escola.edu"
          hint="Usaremos para enviar notificações"
          error={errors.email}
          required
        />
        
        <div className="flex gap-lg pt-lg">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={loading}
          >
            Salvar Alterações
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

## Example 2: List Page Migration

### BEFORE (Old Pattern)
```jsx
export default function StudentsList() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      const response = await fetch("/api/students")
      setStudents(await response.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div>Carregando...</div>
  }

  if (students.length === 0) {
    return <div className="text-center py-8">Nenhum aluno</div>
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Alunos</h1>
      
      <div className="space-y-2">
        {students.map(student => (
          <div key={student.id} className="border rounded-2xl p-4">
            <h3 className="font-bold">{student.name}</h3>
            <p className="text-sm text-gray-600">{student.email}</p>
            <div className="mt-2 flex gap-2">
              <button className="rounded-2xl px-3 py-1 text-sm bg-brand-red text-white">
                Editar
              </button>
              <button className="rounded-2xl px-3 py-1 text-sm border">
                Deletar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### AFTER (New Pattern)
```jsx
import {
  EmptyState,
  ListItemCard,
  Button,
  Badge,
  SkeletonLoader,
  Card
} from "@/components"
import { Plus, Pencil, Trash2 } from "lucide-react"

export default function StudentsList() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      const response = await fetch("/api/students")
      setStudents(await response.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Loading state with skeleton
  if (loading) {
    return (
      <div className="container-responsive py-xl space-y-lg">
        <SkeletonLoader count={5} type="card" />
      </div>
    )
  }

  // Empty state with action
  if (students.length === 0) {
    return (
      <EmptyState
        title="Nenhum aluno cadastrado"
        description="Comece adicionando seu primeiro aluno ao sistema."
        action={() => navigate("/admin/students/new")}
        actionLabel="Adicionar Primeiro Aluno"
      />
    )
  }

  return (
    <div className="container-responsive py-xl">
      <div className="flex justify-between items-center mb-xl">
        <h1 className="text-headline">Alunos</h1>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => navigate("/admin/students/new")}
        >
          Novo Aluno
        </Button>
      </div>
      
      <div className="grid gap-lg">
        {students.map(student => (
          <ListItemCard
            key={student.id}
            title={student.name}
            subtitle={student.email}
            status={student.active ? "Ativo" : "Inativo"}
            statusColor={student.active ? "green" : "gray"}
            badge={<Badge variant="info">{student.class}</Badge>}
            onEdit={() => navigate(`/admin/students/${student.id}`)}
            onDelete={() => handleDeleteStudent(student.id)}
            onClick={() => navigate(`/admin/students/${student.id}`)}
          />
        ))}
      </div>
    </div>
  )
}
```

---

## Example 3: Dashboard Card Migration

### BEFORE
```jsx
<div className="grid grid-cols-3 gap-4 p-4">
  {[
    { label: "Alunos", value: "234" },
    { label: "Turmas", value: "12" },
    { label: "Presença", value: "94%" }
  ].map(stat => (
    <div key={stat.label} className="rounded-2xl border border-brand-navy/10 p-4 bg-white">
      <p className="text-sm text-gray-600">{stat.label}</p>
      <p className="text-2xl font-bold mt-2">{stat.value}</p>
    </div>
  ))}
</div>
```

### AFTER
```jsx
import { StatCard } from "@/components"
import { Users, BookOpen, BarChart3 } from "lucide-react"

<div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
  <StatCard
    icon={Users}
    label="Alunos"
    value="234"
    change={{ value: 12, trend: "up" }}
    onClick={() => navigate("/admin/students")}
  />
  <StatCard
    icon={BookOpen}
    label="Turmas"
    value="12"
    change={{ value: 2, trend: "up" }}
    onClick={() => navigate("/admin/classes")}
  />
  <StatCard
    icon={BarChart3}
    label="Presença"
    value="94%"
    change={{ value: 3, trend: "down" }}
    onClick={() => navigate("/admin/attendance")}
  />
</div>
```

---

## Migration Checklist

### For Each Page

- [ ] Replace inline `<div>` cards with `<Card>` component
- [ ] Replace `<input>` with `<FormField>` (maintains all props, auto-labeled)
- [ ] Replace `<button>` with `<Button>` (adds loading state, variants)
- [ ] Replace inline alerts/errors with `<Alert>` component
- [ ] Replace empty states with `<EmptyState>` component
- [ ] Use `<Badge>` for all status indicators
- [ ] Add `loading` state UI with `<SkeletonLoader>`
- [ ] Add proper `aria-label` to icon buttons
- [ ] Update responsive grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- [ ] Use `container-responsive` for page wrapper
- [ ] Use `space-y-lg` for vertical spacing
- [ ] Use `gap-lg` for grid/flex gaps

### Colors & Styling

- [ ] Replace hardcoded colors with Tailwind classes
- [ ] Use semantic color classes: `bg-success`, `text-danger`, etc.
- [ ] Replace `rounded-2xl` with `rounded-lg` or `rounded-md`
- [ ] Use consistent padding: `p-lg`, `px-lg`, `py-lg`
- [ ] Use consistent spacing: `mb-lg`, `mt-xl`, etc.

### Interactions

- [ ] Add `loading` state to buttons during API calls
- [ ] Use toast notifications instead of `alert()`
- [ ] Add confirmation dialogs for destructive actions
- [ ] Show error messages in form fields, not alerts
- [ ] Add disabled states for invalid forms

---

## Common Patterns

### Loading State
```jsx
const [loading, setLoading] = useState(false)

<Button loading={loading} onClick={handleSave}>
  Salvar
</Button>
```

### Error Handling
```jsx
const [errors, setErrors] = useState({})

<FormField error={errors.name} {...props} />
```

### Success Notification
```jsx
const { showToast } = useToast()

showToast({
  type: "success",
  title: "Sucesso!",
  message: "Ação realizada"
})
```

### Confirmation Dialog
```jsx
<Modal
  open={showConfirm}
  title="Confirmar exclusão"
  onClose={() => setShowConfirm(false)}
  actions={[
    { label: "Cancelar", onClick: () => setShowConfirm(false) },
    { label: "Deletar", variant: "danger", onClick: handleDelete }
  ]}
>
  Tem certeza que deseja deletar este item?
</Modal>
```

---

## Performance Tips

1. **Lazy load components**: Use React.lazy() for large modules
2. **Memoize expensive renders**: Wrap components with React.memo()
3. **Use useCallback**: Optimize onClick handlers
4. **Avoid inline objects**: Define styles outside component
5. **Use key prop**: Properly key lists to avoid re-renders

---

## Next Steps

1. Pick one page to migrate as a pilot
2. Review the COMPONENT_USAGE_GUIDE.md
3. Update the page following the checklist
4. Test all interactive elements
5. Verify mobile responsiveness
6. Check accessibility with browser tools
7. Get code review
8. Repeat for other pages

