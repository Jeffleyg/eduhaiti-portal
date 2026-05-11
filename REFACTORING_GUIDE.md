# 🔧 GUIA PRÁTICO - Refatoração de Componentes

## Componentes Novos Criados

### 1. DataTablePaginated
**Localização**: `apps/frontend/src/components/DataTablePaginated.jsx`

**Substitui**: `DataTable` (sem paginação)

**Melhorias**:
- ✅ Paginação automática
- ✅ Indicador "Exibindo X de Y registros"
- ✅ SkeletonLoader durante carregamento
- ✅ Estado vazio customizável
- ✅ Click em linhas (opcional)

---

### 2. ListItemCard
**Localização**: `apps/frontend/src/components/ListItemCard.jsx`

**Uso**: Em LoadMoreList para renderizar cards profissionais

**Recursos**:
- ✅ Ícone + Título + Subtítulo
- ✅ Preview area customizável
- ✅ Status badge com cores
- ✅ Tags múltiplas
- ✅ Ações (editar, deletar, etc)
- ✅ Menu "mais ações" para > 2 ações
- ✅ Seleção visual

---

## 📋 EXEMPLOS DE IMPLEMENTAÇÃO

### PADRÃO 1: Tabela com Paginação

#### ❌ ANTES (Sem paginação)
```jsx
import DataTable from "../../components/DataTable.jsx"

function ProfessorGrades() {
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadGrades = async () => {
      try {
        const data = await apiFetch("/grades/class/123", { token })
        setGrades(data)
      } finally {
        setLoading(false)
      }
    }
    loadGrades()
  }, [])

  // ❌ PROBLEMA: DataTable carrega TODOS os 50+ registros!
  return (
    <DataTable
      columns={[
        { key: "studentName", label: "Aluno" },
        { key: "score", label: "Nota" }
      ]}
      rows={grades}
    />
  )
}
```

---

#### ✅ DEPOIS (Com paginação)
```jsx
import DataTablePaginated from "../../components/DataTablePaginated.jsx"
import { useTranslation } from "react-i18next"

function ProfessorGrades() {
  const { t } = useTranslation()
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const loadGrades = async () => {
      setLoading(true)
      try {
        const data = await apiFetch("/grades/class/123", { token })
        setGrades(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadGrades()
  }, [])

  // ✅ MELHORADO: Paginação, loading, contagem
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("grades")} ({grades.length})</h2>
      
      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <DataTablePaginated
        columns={[
          { key: "studentName", label: t("student") ?? "Aluno" },
          { key: "score", label: t("grade") ?? "Nota" }
        ]}
        rows={grades}
        itemsPerPage={10}
        totalCount={grades.length}
        loading={loading}
        emptyMessage={t("noGradesFound") ?? "Nenhuma nota encontrada"}
        onRowClick={(row) => console.log("Clicou em:", row)}
      />
    </div>
  )
}
```

**Resultado**: 
- 10 registros por página em vez de 50+ carregados
- Indicador: "Exibindo 1 a 10 de 52 registros"
- Skeleton loader durante carregamento
- SkeletonLoader para estado vazio

---

### PADRÃO 2: Cards com Paginação (LoadMoreList)

#### ❌ ANTES (Sem componente padrão)
```jsx
import LoadMoreList from "../../components/LoadMoreList.jsx"

function AdminUsers() {
  const [students, setStudents] = useState([])

  return (
    <LoadMoreList
      items={students}
      initialLimit={6}
      step={6}
      renderItem={(student) => (
        // ❌ PROBLEMA: Sem padrão visual, sem status, sem ações
        <div className="p-4 border rounded">
          <p>{student.name}</p>
          <p className="text-sm text-gray-600">{student.email}</p>
          {/* Faltam ações, status, etc */}
        </div>
      )}
    />
  )
}
```

---

#### ✅ DEPOIS (Com ListItemCard profissional)
```jsx
import LoadMoreList from "../../components/LoadMoreList.jsx"
import ListItemCard from "../../components/ListItemCard.jsx"
import { Users } from "lucide-react"

function AdminUsers() {
  const { t } = useTranslation()
  const [students, setStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState(null)

  const handleEditStudent = (studentId) => {
    // Abrir modal de edição
    navigateTo(`/admin/students/${studentId}/edit`)
  }

  const handleDeleteStudent = (studentId) => {
    if (window.confirm(t("confirmDeleteStudent"))) {
      deleteStudent(studentId)
    }
  }

  // ✅ MELHORADO: Card padrão profissional
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        {t("students")} ({students.length})
      </h2>

      <LoadMoreList
        items={students}
        initialLimit={6}
        step={6}
        renderItem={(student) => (
          <ListItemCard
            id={student.id}
            icon={<Users size={20} className="text-blue-600" />}
            title={student.name}
            subtitle={student.email}
            preview={
              <div className="space-y-1">
                <p>📝 Matrícula: {student.enrollmentNumber}</p>
                <p>🎓 Série: {student.series}</p>
              </div>
            }
            status={student.active ? "Ativo" : "Inativo"}
            statusColor={student.active ? "green" : "yellow"}
            tags={[
              { label: student.series, color: "blue" },
              { label: student.gender === "M" ? "Masculino" : "Feminino", color: "gray" }
            ]}
            onEdit={() => handleEditStudent(student.id)}
            onDelete={() => handleDeleteStudent(student.id)}
            onClick={() => setSelectedStudentId(student.id)}
            isSelected={selectedStudentId === student.id}
          />
        )}
      />
    </div>
  )
}
```

**Resultado**:
- Cards profissionais com ícone, título, preview
- Status badge colorida
- Tags para categorização
- Ações diretas (Editar, Deletar)
- Seleção visual
- Contagem total exibida
- Paginação automática

---

### PADRÃO 3: Tabela com Cards + Filtro

#### ✅ EXEMPLO: AdminFinanceControl Refatorado
```jsx
import { useState, useEffect } from "react"
import DataTablePaginated from "../../components/DataTablePaginated.jsx"
import ListItemCard from "../../components/ListItemCard.jsx"
import LoadMoreList from "../../components/LoadMoreList.jsx"
import { DollarSign, AlertCircle } from "lucide-react"

function AdminFinanceControl() {
  const { t } = useTranslation()
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState("list") // "list" | "table"
  const [filterStatus, setFilterStatus] = useState("all")

  // Carregar dados
  useEffect(() => {
    loadCharges()
  }, [])

  const loadCharges = async () => {
    setLoading(true)
    try {
      const data = await apiFetch("/finance/charges", { token })
      setCharges(data || [])
    } finally {
      setLoading(false)
    }
  }

  // Filtrar dados
  const filteredCharges = filterStatus === "all" 
    ? charges 
    : charges.filter(c => c.status === filterStatus)

  // ✅ MODO LISTA (Cards)
  if (viewMode === "list") {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {t("charges")} ({filteredCharges.length})
          </h2>
          <button
            onClick={() => setViewMode("table")}
            className="px-3 py-1 text-sm border rounded"
          >
            Ver como Tabela
          </button>
        </div>

        {/* Filtro */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded"
        >
          <option value="all">{t("all")}</option>
          <option value="pending">{t("pending")}</option>
          <option value="paid">{t("paid")}</option>
          <option value="overdue">{t("overdue")}</option>
        </select>

        {/* Lista com Cards */}
        <LoadMoreList
          items={filteredCharges}
          initialLimit={8}
          step={8}
          renderItem={(charge) => (
            <ListItemCard
              id={charge.id}
              icon={
                <DollarSign 
                  size={20} 
                  className={charge.status === "overdue" ? "text-red-600" : "text-green-600"}
                />
              }
              title={`Cobrança #${charge.id}`}
              subtitle={`Aluno: ${charge.studentName}`}
              preview={
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-brand-navy/70">Valor</p>
                    <p className="font-semibold">G$ {charge.amountHtg}</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-navy/70">Vencimento</p>
                    <p className="font-semibold">{charge.dueDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-navy/70">Dias Vencidos</p>
                    <p className="font-semibold">{charge.daysOverdue}</p>
                  </div>
                </div>
              }
              status={charge.status}
              statusColor={
                charge.status === "paid" ? "green" :
                charge.status === "overdue" ? "red" :
                "yellow"
              }
              tags={[
                { label: charge.paymentMethod, color: "blue" }
              ]}
              onEdit={() => handleEditCharge(charge.id)}
              onDelete={() => handleDeleteCharge(charge.id)}
            />
          )}
        />
      </div>
    )
  }

  // ✅ MODO TABELA (DataTablePaginated)
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {t("charges")} ({filteredCharges.length})
        </h2>
        <button
          onClick={() => setViewMode("list")}
          className="px-3 py-1 text-sm border rounded"
        >
          Ver como Cards
        </button>
      </div>

      {/* Filtro */}
      <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
        <option value="all">Tudo</option>
        <option value="pending">Pendente</option>
        <option value="paid">Pago</option>
        <option value="overdue">Vencido</option>
      </select>

      {/* Tabela com Paginação */}
      <DataTablePaginated
        columns={[
          { key: "id", label: "ID" },
          { key: "studentName", label: "Aluno" },
          { key: "amountHtg", label: "Valor (G$)" },
          { key: "dueDate", label: "Vencimento" },
          { key: "status", label: "Status" }
        ]}
        rows={filteredCharges}
        itemsPerPage={15}
        totalCount={filteredCharges.length}
        loading={loading}
      />
    </div>
  )
}
```

---

## 🎯 CHECKLIST DE REFATORAÇÃO

Use este checklist ao refatorar cada página:

### Para Páginas com TABELAS
- [ ] Importar `DataTablePaginated`
- [ ] Remover `DataTable`
- [ ] Adicionar props: `itemsPerPage`, `totalCount`, `loading`
- [ ] Adicionar estado de erro
- [ ] Testar com 50+ registros
- [ ] Validar i18n em labels vazios

### Para Páginas com LISTAS
- [ ] Importar `ListItemCard`
- [ ] Manter `LoadMoreList`
- [ ] Implementar `renderItem` com `ListItemCard`
- [ ] Adicionar `onEdit` e `onDelete`
- [ ] Adicionar preview significativo
- [ ] Adicionar status e tags
- [ ] Testar seleção

### Para Ambos
- [ ] Adicionar contagem total visível
- [ ] Adicionar loading skeleton
- [ ] Adicionar estado vazio customizado
- [ ] Aplicar i18n em todos os textos
- [ ] Testar responsividade mobile
- [ ] Testar com muitos dados (50-200 registros)

---

## 📊 PÁGINAS PARA REFATORAR (Prioridade)

### P0: CRÍTICO (Esta Sprint)
```
ProfessorGrades
  - Remover DataTable
  - Usar DataTablePaginated
  - Estado: 50+ alunos por turma

StudentSchedule
  - Remover DataTable
  - Usar DataTablePaginated
  - Estado: horários completos

AdminFinanceControl
  - Refatorar cobranças (cards ou tabela)
  - Adicionar filtros
```

### P1: IMPORTANTE (Próx. Sprint)
```
ProfessorMessages → Cards com LoadMoreList + ListItemCard
StudentMessages → Cards com LoadMoreList + ListItemCard
Forums → Cards com LoadMoreList + ListItemCard
AdminClasses → Verificar/padronizar
StudentResults → Verificar/padronizar
```

### P2: ENHANCEMENT (Sprint +2)
```
StudentResources
ProfessorResources
StudentAssignments
StudentLessonPlans
ProfessorLessonPlans
```

---

## ✅ VALIDAÇÃO PÓS-REFATORAÇÃO

Após refatorar cada página, validar:

```jsx
// 1. Contagem visível
Página: "10 Alunos" ou "10 de 120 registros"

// 2. Paginação funciona
"Anterior" → disabled em página 1
"Continuar" → disabled em última página

// 3. Loading skeleton aparece
Ao carregar dados, deve exibir SkeletonLoader

// 4. Estado vazio tratado
Se sem registros, mensagem customizada

// 5. Ações funcionam
Botões Editar/Deletar responsivos

// 6. i18n aplicado
Nenhum texto hardcoded em português
```

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Novos componentes criados (DataTablePaginated, ListItemCard)
2. 📌 Aplicar em ProfessorGrades (P0)
3. 📌 Aplicar em StudentSchedule (P0)
4. 📌 Aplicar em AdminFinanceControl (P0)
5. ✅ Validar e testar
6. 📌 Documentar no Design System
7. 📌 Aplicar em páginas P1
8. 📌 Code review e merge

---

**Tempo estimado**: 
- P0: 3-4 dias (refatoração + testes)
- P1: 2-3 dias
- P2: 2-3 dias

**Total**: ~1 sprint (5-10 dias)
