# 🎨 EduHaiti UI Component Library - Guia de Uso

## 📦 Importação de Componentes

Todos os componentes podem ser importados do arquivo `components/index.js`:

```jsx
import { 
  Button, 
  FormField, 
  Card, 
  Badge, 
  Alert, 
  EmptyState,
  Tabs,
  Accordion
} from "@/components"
```

---

## 🔘 Button Component

### Uso Básico
```jsx
<Button>Click me</Button>
```

### Variantes Disponíveis
```jsx
// Primário (vermelho)
<Button variant="primary">Salvar</Button>

// Secundário (cinza)
<Button variant="secondary">Cancelar</Button>

// Outline (bordas)
<Button variant="outline">Editar</Button>

// Ghost (transparente)
<Button variant="ghost">Link</Button>

// Danger (vermelho alerta)
<Button variant="danger">Deletar</Button>

// Success (verde)
<Button variant="success">Confirmar</Button>
```

### Tamanhos
```jsx
<Button size="sm">Pequeno</Button>
<Button size="md">Médio (padrão)</Button>
<Button size="lg">Grande</Button>
```

### Com Ícones
```jsx
import { Plus, Trash2 } from "lucide-react"

<Button icon={Plus}>Adicionar</Button>
<Button variant="danger" icon={Trash2}>Deletar</Button>
```

### Estados
```jsx
// Carregando
<Button loading>Salvando...</Button>

// Desabilitado
<Button disabled>Desabilitado</Button>

// Full width
<Button fullWidth>Enviar</Button>
```

---

## 📝 FormField Component

Substitui completamente inputs, textareas, selects inconsistentes.

### Text Input
```jsx
<FormField
  label="Email"
  name="email"
  type="email"
  value={email}
  onChange={handleChange}
  placeholder="seu@email.com"
  required
  error={errors.email}
  hint="Usaremos para enviar notificações"
/>
```

### Textarea
```jsx
<FormField
  label="Descrição"
  type="textarea"
  name="description"
  value={description}
  onChange={handleChange}
  rows={5}
  error={errors.description}
/>
```

### Select
```jsx
<FormField
  label="Classe"
  type="select"
  name="classId"
  value={classId}
  onChange={handleChange}
  options={[
    { value: "1", label: "3º Ano A" },
    { value: "2", label: "3º Ano B" },
  ]}
  required
/>
```

### Checkbox
```jsx
<FormField
  label="Concordo com os termos"
  type="checkbox"
  name="terms"
  value={terms}
  onChange={handleChange}
  required
/>
```

### Radio Group
```jsx
<FormField
  label="Gênero"
  type="radio"
  name="gender"
  value={gender}
  onChange={handleChange}
  options={[
    { value: "M", label: "Masculino" },
    { value: "F", label: "Feminino" },
    { value: "O", label: "Outro" },
  ]}
/>
```

---

## 🎫 Badge Component

Para status e indicadores.

```jsx
<Badge variant="success">Ativo</Badge>
<Badge variant="warning">Pendente</Badge>
<Badge variant="danger">Vencido</Badge>
<Badge variant="info">Novo</Badge>
<Badge variant="primary">Especial</Badge>
```

### Com Ícones
```jsx
import { CheckCircle } from "lucide-react"

<Badge variant="success" icon={CheckCircle}>
  Aprovado
</Badge>
```

### Tamanhos
```jsx
<Badge size="sm">Pequeno</Badge>
<Badge size="md">Médio</Badge>
<Badge size="lg">Grande</Badge>
```

---

## 💳 Card Component

Para containers e listas.

```jsx
// Básico
<Card>
  Conteúdo do card
</Card>

// Com header e footer
<Card
  header={<h3>Título</h3>}
  footer={<Button>Ação</Button>}
>
  Conteúdo
</Card>

// Variantes
<Card variant="default">Padrão</Card>
<Card variant="elevated">Elevado (sombra)</Card>
<Card variant="flat">Sem sombra</Card>
<Card variant="hover">Interativo</Card>
<Card variant="bordered">Com borda</Card>

// Clicável
<Card
  clickable
  onClick={() => navigate(`/student/${id}`)}
>
  Clique para abrir
</Card>
```

---

## 🚨 Alert Component

Para mensagens e notificações inline.

```jsx
// Info
<Alert variant="info">Informação importante</Alert>

// Success
<Alert variant="success" title="Sucesso!">
  Ação realizada com sucesso
</Alert>

// Warning
<Alert variant="warning">Cuidado com esta ação</Alert>

// Danger/Error
<Alert variant="danger" title="Erro">
  Algo deu errado
</Alert>

// Dismissible
<Alert
  variant="success"
  closeable
  onClose={() => setShowAlert(false)}
>
  Você pode fechar este alerta
</Alert>
```

---

## 📭 EmptyState Component

Quando não há dados.

```jsx
import { Users } from "lucide-react"

<EmptyState
  icon={Users}
  title="Nenhum aluno"
  description="Ainda não há alunos nesta turma."
  action={() => navigate("/admin/students/new")}
  actionLabel="Adicionar Aluno"
/>
```

---

## 📊 Tabs & Accordion

### Tabs
```jsx
import { Tabs } from "@/components"

<Tabs
  defaultTab={0}
  onTabChange={(index) => console.log(index)}
  tabs={[
    {
      label: "Atividades",
      icon: <Activity size={20} />,
      content: <div>Atividades aqui</div>,
    },
    {
      label: "Tarefas",
      icon: <CheckSquare size={20} />,
      content: <div>Tarefas aqui</div>,
    },
  ]}
/>
```

### Accordion
```jsx
import { Accordion } from "@/components"

<Accordion
  items={[
    {
      id: "1",
      title: "Como funciona?",
      content: <p>Explicação aqui</p>,
    },
    {
      id: "2",
      title: "Preciso de ajuda",
      content: <p>Ajuda aqui</p>,
    },
  ]}
  defaultOpen={["1"]}
/>
```

---

## 🔔 Toast/Notification

```jsx
import { ToastContainer, useToast } from "@/components"

// No App.jsx, uma vez:
<ToastContainer />

// Em componentes:
function MyComponent() {
  const { toasts, showToast, removeToast } = useToast()

  return (
    <div>
      <button onClick={() => showToast({
        type: "success",
        title: "Sucesso!",
        message: "Alterações salvas",
        duration: 3000,
      })}>
        Show Toast
      </button>

      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

// Método rápido (alternativo):
import { toast } from "@/components"

toast.success("Alterado com sucesso!")
toast.error("Ocorreu um erro")
toast.warning("Atenção!")
toast.info("Informação")
```

---

## 📐 Utility Components

### Tooltip
```jsx
import { Tooltip } from "@/components"

<Tooltip content="Clique para editar" position="top">
  <button>?</button>
</Tooltip>
```

### Progress
```jsx
import { Progress } from "@/components"

<Progress value={75} max={100} label="Progresso" />
```

### Divider
```jsx
import { Divider } from "@/components"

<Divider />
<Divider label="OU" />
```

### Spinner
```jsx
import { Spinner } from "@/components"

<Spinner size="md" label="Carregando..." />
```

---

## 🎯 Tailwind Classes

Todas as classes customizadas estão disponíveis:

### Buttons
```html
<button class="btn btn-primary">Primário</button>
<button class="btn btn-secondary">Secundário</button>
<button class="btn btn-outline">Outline</button>
<button class="btn btn-ghost">Ghost</button>
<button class="btn btn-sm">Pequeno</button>
<button class="btn btn-lg">Grande</button>
<button class="btn btn-icon">Ícone</button>
```

### Forms
```html
<input class="form-field" />
<label class="form-label">Label</label>
<div class="form-error">Erro</div>
<div class="form-hint">Dica</div>
```

### Cards & Containers
```html
<div class="card">Card padrão</div>
<div class="card-elevated">Card elevado</div>
<div class="card-flat">Card flat</div>
<div class="card-hover">Card hover</div>
```

### Badges
```html
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-danger">Danger</span>
<span class="badge badge-info">Info</span>
<span class="badge badge-primary">Primary</span>
```

### Alerts
```html
<div class="alert alert-success">Success</div>
<div class="alert alert-warning">Warning</div>
<div class="alert alert-danger">Danger</div>
<div class="alert alert-info">Info</div>
```

### Typography
```html
<h1 class="text-headline">Headline</h1>
<h2 class="text-subheadline">Subheadline</h2>
<h3 class="text-title">Title</h3>
<p class="text-body">Body text</p>
<small class="text-caption">Caption</small>
```

### States
```html
<div class="state-active">Ativo</div>
<div class="state-inactive">Inativo</div>
<div class="state-pending">Pendente</div>
<div class="state-error">Erro</div>
```

---

## 🎨 Design Tokens

### Colors
```css
--brand-navy: #0F2B5E       /* Principal */
--brand-red: #E63946        /* Ações */
--success: #10B981          /* Sucesso */
--warning: #F59E0B          /* Atenção */
--danger: #EF4444           /* Erro */
--info: #3B82F6             /* Info */
```

### Spacing
```css
xs: 4px
sm: 8px
md: 12px
lg: 16px
xl: 24px
2xl: 32px
3xl: 48px
4xl: 64px
```

### Border Radius
```css
sm: 4px
base: 8px
md: 12px
lg: 16px
xl: 20px
2xl: 24px
full: 9999px
```

### Transitions
```css
--transition-fast: 150ms
--transition-normal: 300ms
--transition-slow: 500ms
```

---

## ✅ Checklist de Implementação

- [ ] Substituir todos `<button>` por componente `<Button>`
- [ ] Substituir todos `<input>`, `<textarea>`, `<select>` por `<FormField>`
- [ ] Usar `<Card>` para containers de conteúdo
- [ ] Usar `<Badge>` para status
- [ ] Usar `<Alert>` para mensagens inline
- [ ] Usar `<EmptyState>` quando não há dados
- [ ] Adicionar `<ToastContainer>` no App.jsx
- [ ] Usar `toast.success/error/warning/info` para notificações
- [ ] Verificar ARIA labels em elementos interativos
- [ ] Testar responsividade em mobile/tablet

---

## 🚀 Next Steps

1. **Executar**: npm install (para garantir dependências)
2. **Testar**: Verificar se todos os componentes renderizam
3. **Migrar**: Atualizar páginas antigas para usar novos componentes
4. **Validar**: Testar acessibilidade com ferramentas
5. **Documentar**: Criar stories ou exemplos adicionais

