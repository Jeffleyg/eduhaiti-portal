# 🚀 Guia de Implementação - Design System com Radix UI

## Pré-requisitos

- Node.js 18+ instalado
- Frontend EduHaiti rodando
- Conhecimento básico de React e Tailwind

---

## PASSO 1: Instalar Dependências

### 1.1 Radix UI Core

```bash
cd apps/frontend

# Componentes Radix UI essenciais
npm install @radix-ui/react-dialog \
            @radix-ui/react-select \
            @radix-ui/react-checkbox \
            @radix-ui/react-radio-group \
            @radix-ui/react-tabs \
            @radix-ui/react-popover \
            @radix-ui/react-slot \
            @radix-ui/react-separator

# Classe primitiva (para combinar classes Radix + Tailwind)
npm install class-variance-authority clsx tailwind-merge
```

### 1.2 Validação de Formulário

```bash
npm install react-hook-form zod @hookform/resolvers
```

### 1.3 Teste de Acessibilidade (Opcional, mas recomendado)

```bash
npm install --save-dev @testing-library/react axe-core jest-axe
```

---

## PASSO 2: Criar Estrutura de Pastas

```bash
# Se não existir já:
mkdir -p src/hooks
mkdir -p src/components/form
mkdir -p src/components/dialog

# Arquivos criados no projeto:
# ✅ src/components/form/SelectField.jsx         (NOVO)
# ✅ src/components/dialog/FormDialog.jsx         (NOVO)
# ✅ src/hooks/useFormField.js                    (NOVO)
```

---

## PASSO 3: Verificar Dependências Instaladas

```bash
npm list @radix-ui/react-select react-hook-form zod

# Output esperado:
# ├── @radix-ui/react-dialog@1.1.2
# ├── @radix-ui/react-select@2.1.2
# ├── react-hook-form@7.x.x
# └── zod@3.x.x
```

---

## PASSO 4: Testar SelectField

### 4.1 Criar arquivo de teste temporário

```jsx
// src/components/form/__tests__/SelectField.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import SelectField from '../SelectField'

const TestComponent = () => {
  const { control } = useForm()

  return (
    <SelectField
      control={control}
      name="testSelect"
      label="Teste"
      options={[
        { label: 'Opção 1', value: 'opt1' },
        { label: 'Opção 2', value: 'opt2' },
      ]}
    />
  )
}

test('SelectField renders and is keyboard accessible', async () => {
  const user = userEvent.setup()
  render(<TestComponent />)
  
  const trigger = screen.getByRole('button', { name: /teste/i })
  
  // Teste: abrir com Enter
  await user.click(trigger)
  const option1 = screen.getByText('Opção 1')
  expect(option1).toBeInTheDocument()
})
```

### 4.2 Rodar teste

```bash
npm test SelectField.test.jsx
```

---

## PASSO 5: Refatorar CreateStudentModal

### 5.1 Backup do arquivo original

```bash
cp src/components/modals/CreateStudentModal.jsx \
   src/components/modals/CreateStudentModal.jsx.backup
```

### 5.2 Implementar nova versão

Usar o exemplo em `REFACTORING_EXAMPLE_CreateStudentModal.jsx` como template.

**Mudanças principais:**
```jsx
// ❌ Antes
const [studentData, setStudentData] = useState({})
const [errors, setErrors] = useState({})

// ✅ Depois
const { control, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(createStudentSchema),
})
```

### 5.3 Validar em browser

1. Abrir DevTools (F12)
2. Console deve estar limpo (sem erros)
3. Tentar criar aluno com dados inválidos
4. Verificar se mensagens de erro aparecem

---

## PASSO 6: Testar Acessibilidade

### 6.1 Teste Manual (Recomendado primeiro)

```bash
# 1. Abrir o diálogo
# 2. Pressionar TAB - deve navegar entre campos
# 3. Pressionar SHIFT+TAB - deve ir para trás
# 4. Preencher campo inválido (ex: email sem @)
# 5. Pressionar ENTER para submeter
# 6. Verificar erro aparece com aria-invalid
# 7. Pressionar ESC - modal deve fechar
```

### 6.2 Teste com Axe Core (Automated)

```bash
# Instalar Axe DevTools no Chrome
# https://chrome.google.com/webstore/detail/axe-devtools/lhdoppojpmngadmnkpklempisson/

# 1. Abrir página no browser
# 2. Abrir CreateStudentModal
# 3. Clicar em Axe DevTools > Scan NOW
# 4. Resultado deve estar > 90% (WCAG AA)
```

### 6.3 Teste com Screen Reader

```bash
# Windows: Use NVDA (gratuito)
# https://www.nvaccess.org/

# macOS: Use VoiceOver (built-in)
# Cmd+F5 para ativar

# 1. Abrir diálogo
# 2. Screen reader deve ler: "Criar Aluno, diálogo"
# 3. Screen reader deve ler cada label antes do input
# 4. Erro deve ser anunciado como "inválido, mensagem de erro"
```

---

## PASSO 7: Refatorar Outros Modais

Aplicar mesmo padrão a:
- CreateTeacherModal
- CreateClassModal
- Qualquer outro modal com formulário

---

## ✅ Checklist de Conformidade

Antes de considerar "Done":

```
FORMULÁRIO:
  ☐ Todos os inputs têm <label>
  ☐ Validação funciona em tempo real
  ☐ Mensagens de erro são claras
  ☐ Campos obrigatórios marcados com *
  
ACESSIBILIDADE:
  ☐ Navegação com TAB funciona
  ☐ Navegação com SHIFT+TAB funciona
  ☐ ESC fecha modal
  ☐ Focus trap ativo (não sai do modal com TAB)
  ☐ Cores têm contraste > 4.5:1
  ☐ Nenhum erro ao usar screen reader
  
VISIBILIDADE:
  ☐ Erro com fundo vermelho suave
  ☐ Erro com ícone + mensagem
  ☐ Hint visível em cinza
  ☐ Loading spinner durante envio
  
CÓDIGO:
  ☐ Sem console errors
  ☐ Sem console warnings
  ☐ Espaçamento consistente (Tailwind)
  ☐ Sem `any` types em TypeScript
```

---

## 🐛 Troubleshooting

### Problema: "Cannot find module '@radix-ui/react-select'"

```bash
# Solução:
npm install @radix-ui/react-select
npm run dev  # Restart dev server
```

### Problema: SelectField não abre

```jsx
// Verificar se FormDialog está passando <Portal>
// Em SelectField.jsx, line ~70:
<Select.Portal>  // ✅ Necessário para renderizar acima do diálogo
  <Select.Content>
    ...
  </Select.Content>
</Select.Portal>
```

### Problema: Erro "zodResolver is not a function"

```bash
# Verificar importação
import { zodResolver } from '@hookform/resolvers/zod'  // ✅ Correto

# Se não funcionar:
npm install --save @hookform/resolvers@latest zod@latest
```

### Problema: Modal não fecha ao clicar X

```jsx
// Verificar que Dialog.Close está em DialogContent
<Dialog.Close asChild>
  <button onClick={onClose}>✕</button>
</Dialog.Close>
```

### Problema: Validação não dispara

```jsx
// Verificar mode do form
const { ... } = useForm({
  resolver: zodResolver(schema),
  mode: 'onBlur',  // ✅ Valida ao sair do campo
})
```

---

## 📚 Recursos e Documentação

- [Radix UI Dialog](https://www.radix-ui.com/docs/primitives/components/dialog)
- [Radix UI Select](https://www.radix-ui.com/docs/primitives/components/select)
- [react-hook-form Guide](https://react-hook-form.com/form-builder)
- [Zod Documentation](https://zod.dev/)
- [Tailwind + Radix Integration](https://www.radix-ui.com/docs/primitives/overview/styling)
- [WCAG 2.1 AA Checklist](https://www.w3.org/WAI/WCAG21/quickref/)

---

## ⏱️ Estimativa de Tempo

- PASSO 1-2: 15 minutos
- PASSO 3: 5 minutos
- PASSO 4-5: 45 minutos
- PASSO 6: 30 minutos
- PASSO 7: 2-3 horas (depende de quantos modais)

**Total: ~4-5 horas para primeira refatoração completa**

---

## 🎉 Próximos Passos

1. ✅ Implementar CreateStudentModal refatorado
2. ✅ Aplicar padrão a CreateTeacherModal
3. ⏳ Refatorar outros formulários
4. ⏳ Adicionar testes de acessibilidade no CI/CD
5. ⏳ Documentar componentes no Storybook

