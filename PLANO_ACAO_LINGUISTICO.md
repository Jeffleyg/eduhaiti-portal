# 🛠️ PLANO DE AÇÃO: CORREÇÃO DE INCONSISTÊNCIA LINGUÍSTICA

**Status**: Pronto para implementação  
**Prioridade**: 🔴 CRÍTICA  
**Tempo estimado**: 5-6 horas  

---

## FASE 1: ROTAS FRONTEND (2-3 horas) - CRÍTICA

### 1.1 Alterar Rotas na App.jsx

**Arquivo**: `apps/frontend/src/App.jsx`  
**Linhas**: 57-104

#### Mapeamento de Mudanças

| Rota Atual | Nova Rota | Justificativa |
|-----------|-----------|---|
| `/familia` | `/family` | Inglês padrão |
| `/pagamento-escolaridade` | `/tuition-payment` | Inglês padrão |
| `/professor` | `/teacher` | Inglês padrão |
| `/professor/notes` | `/teacher/grades` | Remover francês |
| `/professor/presence` | `/teacher/attendance` | Remover francês |
| `/professor/ressources` | `/teacher/resources` | Remover francês |
| `/professor/tarefas` | `/teacher/assignments` | Remover português |
| `/student/resultats` | `/student/grades` | Remover francês |
| `/student/horaire` | `/student/schedule` | Remover francês |
| `/student/ressources` | `/student/resources` | Remover francês |
| `/student/tarefas` | `/student/assignments` | Remover português |

#### Mudanças Necessárias

**ANTES:**
```jsx
<Route path="/familia" element={<FamilyPortal />} />
<Route path="/pagamento-escolaridade" element={<GuardianTuitionPayment />} />

<Route element={<ProtectedRoute role="professor" />}>
  <Route path="/professor" element={<AppShell role="professor" />}>
    <Route path="notes" element={<ProfessorGrades />} />
    <Route path="presence" element={<ProfessorAttendance />} />
    <Route path="ressources" element={<ProfessorResources />} />
    <Route path="tarefas" element={<ProfessorAssignments />} />
  </Route>
</Route>

<Route element={<ProtectedRoute role="student" />}>
  <Route path="/student" element={<AppShell role="student" />}>
    <Route path="resultats" element={<StudentResults />} />
    <Route path="horaire" element={<StudentSchedule />} />
    <Route path="ressources" element={<StudentResources />} />
    <Route path="tarefas" element={<StudentAssignments />} />
  </Route>
</Route>
```

**DEPOIS:**
```jsx
<Route path="/family" element={<FamilyPortal />} />
<Route path="/tuition-payment" element={<GuardianTuitionPayment />} />

<Route element={<ProtectedRoute role="teacher" />}>
  <Route path="/teacher" element={<AppShell role="teacher" />}>
    <Route path="grades" element={<TeacherGrades />} />
    <Route path="attendance" element={<TeacherAttendance />} />
    <Route path="resources" element={<TeacherResources />} />
    <Route path="assignments" element={<TeacherAssignments />} />
  </Route>
</Route>

<Route element={<ProtectedRoute role="student" />}>
  <Route path="/student" element={<AppShell role="student" />}>
    <Route path="grades" element={<StudentGrades />} />
    <Route path="schedule" element={<StudentSchedule />} />
    <Route path="resources" element={<StudentResources />} />
    <Route path="assignments" element={<StudentAssignments />} />
  </Route>
</Route>
```

### 1.2 Atualizar Importações e Nomes de Componentes

**Necessário renomear os seguintes componentes**:

```jsx
// Mudar de:
import { ProfessorDashboard, ProfessorGrades, ProfessorAttendance, ... } from "./modules/professor"

// Para:
import { TeacherDashboard, TeacherGrades, TeacherAttendance, ... } from "./modules/teacher"

// Renomear também:
<AppShell role="professor" />  → <AppShell role="teacher" />
```

**Ou manter nomes antigos e criar aliases:**

```jsx
// Em modules/professor/index.js
export { ProfessorDashboard as TeacherDashboard }
export { ProfessorGrades as TeacherGrades }
// ... etc
```

---

## FASE 2: STRINGS HARDCODED (1 hora) - ALTO

### 2.1 Remover Fallbacks em Português

**Arquivo**: `apps/frontend/src/components/CreateStudentModal.jsx`

**ANTES:**
```jsx
placeholder={t('enterEmail') || 'Ex: aluno@escola.ht'}
hint={t('classHint') || 'Turma em que o aluno será matriculado'}
{t('createStudentAction') || 'Criar Aluno'}
```

**DEPOIS:**
```jsx
placeholder={t('enterEmail') || 'E.g. student@school.ht'}
hint={t('classHint') || 'Class in which the student will be enrolled'}
{t('createStudentAction') || 'Create Student'}
```

### 2.2 Alterar DataTablePaginated.jsx

**ANTES:**
```jsx
previousLabel={t("previous") ?? "Anterior"}
continueLabel={t("continue") ?? "Continuar"}
```

**DEPOIS:**
```jsx
previousLabel={t("previous") ?? "Previous"}
continueLabel={t("continue") ?? "Continue"}
```

### 2.3 Alterar LoadMoreList.jsx

**ANTES:**
```jsx
const nextLabel = continueLabel ?? t("continue") ?? "Continuar"
const prevLabel = previousLabel ?? t("previous") ?? "Anterior"
```

**DEPOIS:**
```jsx
const nextLabel = continueLabel ?? t("continue") ?? "Continue"
const prevLabel = previousLabel ?? t("previous") ?? "Previous"
```

### 2.4 Alterar FormDialog.jsx

**ANTES:**
```jsx
submitText = 'Salvar'
cancelText = 'Cancelar'
```

**DEPOIS:**
```jsx
submitText = 'Save'
cancelText = 'Cancel'
```

### 2.5 Alterar EmptyState.jsx

**ANTES:**
```jsx
function EmptyState({ actionLabel = "Criar" }) {
```

**DEPOIS:**
```jsx
function EmptyState({ actionLabel = "Create" }) {
```

### 2.6 Alterar ListItemCard.jsx

**ANTES:**
```jsx
const defaultActions = [
  { label: "Editar", onClick: handleEdit },
  { label: "Deletar", onClick: handleDelete }
]
```

**DEPOIS:**
```jsx
const defaultActions = [
  { label: "Edit", onClick: handleEdit },
  { label: "Delete", onClick: handleDelete }
]
```

### 2.7 Alterar AdminClasses.jsx

**ANTES:**
```jsx
<strong>Alunos:</strong> {cls.students?.length || 0}
```

**DEPOIS:**
```jsx
<strong>{t('students', 'Students')}:</strong> {cls.students?.length || 0}
```

---

## FASE 3: CONSOLE MESSAGES (15 minutos) - MÉDIO

### 3.1 Alterar Console.error em Português

**Arquivo**: `apps/frontend/src/components/CreateStudentModal.jsx` (linha 121)

**ANTES:**
```jsx
console.error('Erro ao criar aluno:', error)
```

**DEPOIS:**
```jsx
console.error('Failed to create student:', error)
```

### 3.2 Alterar Console em LanguageSelector.jsx

**ANTES:**
```jsx
console.log(`Idioma alterado para: ${LANGUAGE_MAP[languageCode]?.nativeName}`)
console.error("Erro ao alterar idioma:", error)
```

**DEPOIS:**
```jsx
console.log(`Language changed to: ${LANGUAGE_MAP[languageCode]?.nativeName}`)
console.error("Failed to change language:", error)
```

---

## FASE 4: ANALYTICS ROUTES (30 minutos) - MÉDIO

### 4.1 Alterar Backend Routes

**Arquivo**: `apps/backend/src/analytics/analytics.controller.ts` (linhas 32, 39)

**ANTES:**
```typescript
@Get('dashboard/impacto-diaspora')
@Get('dashboard/alerta-precoce')
```

**DEPOIS:**
```typescript
@Get('dashboard/diaspora-impact')
@Get('dashboard/early-alert')
```

---

## FASE 5: COMENTÁRIOS E DOCUMENTAÇÃO (1 hora) - BAIXO

### 5.1 Alterar JSDoc em Português

**Arquivo**: `apps/frontend/src/components/ListItemCard.jsx`

**ANTES:**
```jsx
/**
 * @param {Array} props.actions - Array de ações [{label: "Editar", onClick: fn}, ...] (optional)
 * @param {Function} props.onEdit - Shortcut para ação Editar (optional)
 */
```

**DEPOIS:**
```jsx
/**
 * @param {Array} props.actions - Array of actions [{label: "Edit", onClick: fn}, ...] (optional)
 * @param {Function} props.onEdit - Shortcut for Edit action (optional)
 */
```

### 5.2 Alterar Comentários em CreateStudentModal.jsx

**ANTES:**
```jsx
/**
 * Zod Schema para validação de Aluno
 */
```

**DEPOIS:**
```jsx
/**
 * Zod Schema for Student validation
 */
```

### 5.3 Alterar Comentários em ProfileCard.jsx

**ANTES:**
```jsx
{/* Matrícula se for estudante */}
{/* Dados Institucionais - Estudante */}
```

**DEPOIS:**
```jsx
{/* Enrollment if student */}
{/* Institutional Data - Student */}
```

### 5.4 Alterar Comentários em PermissionCodeManager.jsx

**ANTES:**
```jsx
{showForm ? 'Cancelar' : '+ Gerar Código'}
```

**DEPOIS:**
```jsx
{showForm ? 'Cancel' : '+ Generate Code'}
```

---

## FASE 6: VALIDAÇÃO E TESTES (1-2 horas)

### 6.1 Testar Rotas Frontend

```bash
# Verificar se todas as novas rotas funcionam
- [ ] /family → FamilyPortal funciona?
- [ ] /tuition-payment → GuardianTuitionPayment funciona?
- [ ] /teacher → AppShell teacher funciona?
- [ ] /teacher/grades → TeacherGrades funciona?
- [ ] /teacher/attendance → TeacherAttendance funciona?
- [ ] /teacher/resources → TeacherResources funciona?
- [ ] /student/grades → StudentGrades funciona?
- [ ] /student/schedule → StudentSchedule funciona?
```

### 6.2 Testar i18n

```bash
# Verificar se as strings agora usam i18n
- [ ] Selecionar português (pt.json)
- [ ] Selecionar francês (fr.json)
- [ ] Selecionar crioulo (ht.json)
- [ ] Labels de botões mudam?
- [ ] Placeholders mudam?
- [ ] Tooltips mudam?
```

### 6.3 Testar Console (DevTools)

```bash
# Abrir DevTools (F12) e verificar
- [ ] Console está em inglês?
- [ ] Nenhuma mensagem em português?
- [ ] Erros aparecem em inglês?
```

### 6.4 Build e Deploy

```bash
# Frontend
npm run build          # Deve compilar sem erros
npm run preview        # Testar produção localmente

# Backend
npm run build          # Deve compilar sem erros
npm run start          # Testar localmente
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Frontend
- [ ] App.jsx rotas atualizadas (20 min)
- [ ] Componentes importados corretamente (10 min)
- [ ] CreateStudentModal fallbacks corrigidos (5 min)
- [ ] DataTablePaginated fallbacks corrigidos (5 min)
- [ ] LoadMoreList fallbacks corrigidos (5 min)
- [ ] FormDialog fallbacks corrigidos (5 min)
- [ ] EmptyState fallback corrigido (5 min)
- [ ] ListItemCard labels corrigidos (5 min)
- [ ] AdminClasses labels corrigidos (5 min)
- [ ] Console messages corrigidos (5 min)
- [ ] LanguageSelector console corrigido (5 min)
- [ ] JSDoc comments traduzidos (10 min)
- [ ] Comentários em português traduzidos (15 min)
- [ ] Build e teste (15 min)

### Backend
- [ ] Analytics rotas renomeadas (5 min)
- [ ] Imports atualizados (5 min)
- [ ] Build e teste (10 min)

### Validação
- [ ] Rotas testadas (20 min)
- [ ] i18n testado (15 min)
- [ ] Console verificado (10 min)
- [ ] Funcionalidade completa (30 min)

---

## 🔗 IMPACTO EM OUTRAS PARTES DO PROJETO

### Componentes que usam /professor
```
- Sidebar.jsx → Atualizar link para /teacher
- AppShell.jsx → Atualizar logic para teacher role
- ProtectedRoute.jsx → Verificar se impactado
```

### Componentes que usam /student
```
- Sidebar.jsx → Verificar se impactado
- AppShell.jsx → Verificar se impactado
```

### Componentes que usam /familia
```
- Landing.jsx → Atualizar link
- Sidebar.jsx → Atualizar link
```

---

## ⚠️ POSSÍVEIS PROBLEMAS

### 1. Links em Sidebar podem quebrar
**Solução**: Procurar por todos os hardcodes de paths

### 2. Bookmarks do usuário quebram
**Solução**: Adicionar redirect (opcional, para UX)

```jsx
// Opcional: Redirecionar rotas antigas
<Route path="/professor/*" element={<Navigate to="/teacher" replace />} />
<Route path="/familia/*" element={<Navigate to="/family" replace />} />
```

### 3. Backend pode não reconhecer novo role "teacher"
**Solução**: Backend já usa enum Role com TEACHER

```prisma
enum Role {
  OWNER
  ADMIN
  TEACHER    // ✓ Já existe
  STUDENT
}
```

---

## 📝 REFERENCIAS

- **App.jsx**: [Link padrão]
- **Locales**: `apps/frontend/src/locales/`
- **Backend enums**: `apps/backend/prisma/schema.prisma`
- **Diagnostic completo**: `DIAGNOSTIC_LINGUISTICO_COMPLETO.md`

---

## 🎯 RESULTADO ESPERADO

Após implementação:

### ✅ Frontend
```
- Todas as rotas em INGLÊS
- Strings hardcoded em INGLÊS
- Console messages em INGLÊS
- i18n funcionando perfeitamente
- PT/FR/HT traduzido corretamente
```

### ✅ Backend
```
- Rotas analytics em INGLÊS
- Controllers em INGLÊS
- Services em INGLÊS
- 100% consistência
```

### ✅ Experiência do Usuário
```
- Linguagem selecionada respeita i18n
- UI muda ao trocar idioma
- Console é consistente
- Projeto é manutenível
```

---

**Estimativa Total**: 5-6 horas  
**Complexidade**: Baixa (busca e substituição majoritariamente)  
**Risco**: Muito baixo (mudanças não afetam lógica)

Pronto para implementação! 🚀
