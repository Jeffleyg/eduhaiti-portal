# Estratégia de Implementação do Design System - EduHaiti Frontend

## 📊 Situação Atual

✅ **O que está bom:**
- Design System documentado com 6 componentes principais
- 34 componentes base implementados (85% cobertura)
- Componentes FormField, Button, Badge com acessibilidade parcial
- Responsividade e i18n bem integrados

❌ **Problemas críticos:**
- Sem biblioteca headless de componentes (sem Radix/Headless UI)
- Modais (CreateStudentModal/CreateTeacherModal) quebram padrões
- Acessibilidade apenas 60% conforme (WCAG 2.1 AA)
- Modal sem focus trap, aria-modal, fechamento com ESC
- Select e inputs nativos em formulários críticos
- Sem validação de formulário robusta (react-hook-form, Zod)
- Inputs diretos em vez de usar FormField wrapper

---

## 🎯 Recomendação: Usar Radix UI

### Por que Radix UI?

| Critério | Radix UI | Headless UI | Shadcn/ui |
|----------|----------|------------|-----------|
| **Acessibilidade WCAG AA** | ✅ Excelente | ✅ Bom | ✅ Excelente |
| **Focus Management** | ✅ Automático | ⚠️ Manual | ✅ Automático |
| **Keyboard Navigation** | ✅ Completo | ✅ Completo | ✅ Completo |
| **Curva Aprendizado** | ⚠️ Média | ✅ Baixa | ✅ Média |
| **Bundle Size** | 📦 30KB | 📦 5KB | 📦 ~2KB |
| **Customização com Tailwind** | ✅ Perfeito | ✅ Perfeito | ✅ 100% |
| **Comunidade** | ✅ Grande | ✅ Grande | ✅ Crescente |

**Escolha: Radix UI** porque:
1. Gerencia acessibilidade automaticamente
2. Combinação perfeita com Tailwind (sem conflitos)
3. Componentes unstyled = total controle visual
4. Suporta formulários complexos (Select, Combobox, Dialog)
5. Zero dependências de estilo

---

## 📦 Instalação Recomendada

```bash
# 1. Radix UI - componentes headless
npm install @radix-ui/react-dialog \
            @radix-ui/react-select \
            @radix-ui/react-checkbox \
            @radix-ui/react-radio-group \
            @radix-ui/react-tabs \
            @radix-ui/react-popover \
            @radix-ui/react-slot

# 2. Validação de formulário
npm install react-hook-form zod @hookform/resolvers

# 3. Utilidades
npm install class-variance-authority clsx tailwind-merge

# 4. Teste de acessibilidade
npm install --save-dev @testing-library/react axe-core jest-axe
```

---

## 🔄 Plano de Implementação (3 Fases)

### FASE 1: Fundação (Semana 1-2)
**Objetivo:** Criar biblioteca base acessível

```
Tasks:
1. Instalar Radix UI + validação
2. Criar 5 componentes base com Radix:
   - SelectField.jsx (Radix Select)
   - CheckboxField.jsx (Radix Checkbox)
   - RadioField.jsx (Radix Radio)
   - DialogField.jsx (Radix Dialog) ⬅️ MODAL
   - FileUploadField.jsx (customizado)

3. Melhorar Modal.jsx:
   - Integrar Radix Dialog
   - Adicionar focus trap (automático)
   - aria-modal, aria-labelledby
   - Fechar com ESC (automático)
   - Backdrop click (automático)

4. Criar hook useFormField():
   - Gerenciar estado de erro
   - Validação em tempo real
   - aria-invalid, aria-describedby automático
```

### FASE 2: Refatoração Crítica (Semana 3)
**Objetivo:** Aplicar em formulários existentes

```
Tasks:
1. Refatorar CreateStudentModal.jsx:
   - ✅ Trocar <input> por FormField
   - ✅ Trocar <select> por SelectField (Radix)
   - ✅ Integrar react-hook-form com Zod
   - ✅ Validação em tempo real
   - ✅ Mensagens de erro inline

2. Refatorar CreateTeacherModal.jsx:
   - Mesmo padrão que CreateStudentModal

3. Teste e validação:
   - Testar keyboard navigation (Tab, Shift+Tab)
   - Testar com screen reader (NVDA)
   - Validar WCAG AA compliance
```

### FASE 3: Expansão e Otimização (Semana 4)
**Objetivo:** Aplicar em todo o projeto

```
Tasks:
1. Refatorar componentes de formulário:
   - DataTable com Radix (se necessário)
   - PaginationControls com ARIA
   - FormWizard para cadastros multi-step

2. Teste e documentação:
   - Axe-core coverage
   - Atualizar DESIGN_SYSTEM.md com novos componentes
   - Criar Storybook para documentação visual

3. Performance:
   - Lazy load de Radix componentes
   - Tree-shaking de código não usado
```

---

## 🏗️ Estrutura de Componentes Proposta

```
src/components/
├── form/
│   ├── FormField.jsx          ✅ Existente (melhorar)
│   ├── SelectField.jsx        🆕 Com Radix Select
│   ├── CheckboxField.jsx      🆕 Com Radix Checkbox
│   ├── RadioField.jsx         🆕 Com Radix Radio
│   ├── FileUploadField.jsx    🆕 Com validação
│   ├── DateField.jsx          🆕 Com Radix PopoverPrimitive
│   ├── TimeField.jsx          🆕 Com Radix PopoverPrimitive
│   ├── TextAreaField.jsx      🆕 Wrapper de textarea
│   ├── ComboboxField.jsx      🆕 Com Radix Select (combobox mode)
│   └── useFormField.ts        🆕 Hook para integração
│
├── dialog/
│   ├── Modal.jsx              ✅ Existente (refatorar com Radix)
│   ├── AlertDialog.jsx        🆕 Com Radix AlertDialog
│   ├── ConfirmDialog.jsx      🆕 Com Radix Dialog
│   └── FormDialog.jsx         🆕 Combinação Dialog + Formulário
│
├── form-layout/
│   ├── Form.jsx               🆕 Wrapper com react-hook-form
│   ├── FormSection.jsx        🆕 Seção do formulário com heading
│   ├── FormActions.jsx        🆕 Botões padrão (Submit/Cancel)
│   └── FormWizard.jsx         🆕 Multi-step form
│
├── table/
│   ├── DataTable.jsx          ✅ Existente
│   ├── DataTablePaginated.jsx ✅ Existente
│   └── PaginationControls.jsx ✅ Existente (adicionar ARIA)
│
└── existing/
    ├── Button.jsx
    ├── Card.jsx
    ├── Badge.jsx
    ├── Alert.jsx
    └── ... (outros mantêm-se)
```

---

## 💻 Exemplos de Implementação

### Antes: CreateStudentModal sem padrão

```jsx
❌ const CreateStudentModal = () => {
  const [studentData, setStudentData] = useState({})
  
  return (
    <Modal>
      <input name="email" value={studentData.email} onChange={...} />
      <select name="classId" value={studentData.classId} onChange={...} />
      <button onClick={handleCreate}>Criar</button>
    </Modal>
  )
}
```

### Depois: Com Radix + react-hook-form + Zod

```jsx
✅ import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import FormDialog from '@/components/dialog/FormDialog'
import SelectField from '@/components/form/SelectField'

const createStudentSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(3, 'Mínimo 3 caracteres'),
  classId: z.string().nonempty('Selecione uma turma'),
})

const CreateStudentModal = ({ isOpen, onClose, classOptions }) => {
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(createStudentSchema),
  })

  return (
    <FormDialog 
      title="Criar Aluno"
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit(onCreateStudent)}
    >
      <FormField
        control={control}
        name="name"
        label="Nome"
        type="text"
      />
      <FormField
        control={control}
        name="email"
        label="Email"
        type="email"
      />
      <SelectField
        control={control}
        name="classId"
        label="Turma"
        options={classOptions}
      />
    </FormDialog>
  )
}
```

---

## ✅ Checklist de Conformidade WCAG 2.1 AA

### Após Implementação com Radix:

```
Criterion 1.4.3 (Contrast): ✅ Min 4.5:1
  └─ Tailwind cores já cumprem

Criterion 2.1.1 (Keyboard): ✅ Tab, Enter, Space, Arrow keys
  └─ Radix Dialog + Select gerenciam automaticamente

Criterion 2.1.2 (No Keyboard Trap): ✅ ESC fecha modal
  └─ Focus trap automático com Radix

Criterion 2.4.3 (Focus Order): ✅ Ordem lógica
  └─ Radix gerencia automaticamente

Criterion 3.2.1 (On Focus): ✅ Sem mudança de contexto
  └─ Componentes só atuam com Submit

Criterion 3.3.1 (Error Identification): ✅ Mensagem de erro clara
  └─ aria-invalid + aria-describedby

Criterion 3.3.4 (Error Prevention): ✅ Validação em tempo real
  └─ react-hook-form + Zod

Criterion 4.1.2 (Name, Role, State): ✅ Atributos ARIA corretos
  └─ Radix adiciona automaticamente
```

---

## 📋 Próximos Passos Imediatos

1. **Hoje:** Revisar strategy com equipa
2. **Amanhã:** Instalar Radix UI + dependências
3. **Dia 3:** Criar SelectField.jsx com exemplo
4. **Dia 4-5:** Refatorar CreateStudentModal
5. **Dia 6:** Testes e validação com axe-core
6. **Dia 7:** Documentação atualizada

---

## 📚 Recursos

- [Radix UI Docs](https://www.radix-ui.com/docs/primitives/overview/introduction)
- [react-hook-form](https://react-hook-form.com/)
- [Zod Schema Validation](https://zod.dev/)
- [WCAG 2.1 AA Checklist](https://www.w3.org/WAI/WCAG21/quickref/)
- [Tailwind CSS Accessibility](https://tailwindcss.com/docs/accessibility)

