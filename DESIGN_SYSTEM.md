# 🎨 Design System - Padrões Visuais

## Visão Geral
Sistema de design profissional para Portal Educação com foco em:
- ✅ Consistência visual em todos os módulos
- ✅ Acessibilidade e usabilidade
- ✅ Responsividade mobile-first
- ✅ Hierarquia clara de informação

---

## 📐 PALETA DE CORES

### Cores Primárias
```css
/* Brand Colors */
--brand-navy: #0F2B5E          /* Principal */
--brand-red: #E63946            /* Ações destrutivas/primárias */
--brand-sand: #F5EFEA           /* Background neutro */

/* Estados */
--success: #10B981 (emerald)     /* Ações positivas */
--warning: #F59E0B (amber)       /* Atenção */
--danger: #EF4444 (red)          /* Erros */
--info: #3B82F6 (blue)           /* Informação */

/* Neutrals */
--gray-50: #F9FAFB
--gray-100: #F3F4F6
--gray-600: #4B5563
--gray-900: #111827
```

### Uso por Contexto
| Elemento | Cor | Exemplo |
|----------|-----|---------|
| Botão Primário (Salvar) | `--brand-red` | Ação principal |
| Botão Secundário | `--gray-600` + border | Ação alternativa |
| Status Ativo | `--success` | Aluno ativo |
| Status Pendente | `--warning` | Pagamento pendente |
| Status Vencido | `--danger` | Cobrança vencida |
| Card Selecionado | `blue-50` | Row selected |

---

## 🎯 COMPONENTES E PADRÕES

### 1. CARDS (ListItemCard)

#### Estrutura Padrão
```
┌─────────────────────────────────────────────┐
│ 👤 Aluno - João Silva          [ Ativo ]    │
│    Email: joao@school.edu                   │
│                                             │
│    📝 Matrícula: 12345                       │
│    🎓 Série: 3º Ano                         │
│                                             │
│    [ 3º Ano ] [ Masculino ]                 │
│                                             │
│    [ Editar ] [ Deletar ]                   │
└─────────────────────────────────────────────┘
```

#### Variações

**Tipo 1: Recurso Básico**
```jsx
<ListItemCard
  icon={<FileText size={20} className="text-blue-600" />}
  title="Matemática - Cap. 3"
  subtitle="2024-01-15"
  status="Ativo"
  statusColor="green"
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

**Tipo 2: Com Preview**
```jsx
<ListItemCard
  icon={<Users size={20} className="text-emerald-600" />}
  title="Turma 3A"
  subtitle="Professor: Sr. António"
  preview={
    <div className="grid grid-cols-3 gap-2">
      <div>
        <p className="text-xs text-gray-600">Alunos</p>
        <p className="font-bold">28</p>
      </div>
      <div>
        <p className="text-xs text-gray-600">Média</p>
        <p className="font-bold">14.3</p>
      </div>
      <div>
        <p className="text-xs text-gray-600">Presença</p>
        <p className="font-bold">94%</p>
      </div>
    </div>
  }
  tags={[
    { label: "3º Ano", color: "blue" },
    { label: "Matutino", color: "green" }
  ]}
/>
```

**Tipo 3: Com Status Colorido**
```jsx
<ListItemCard
  icon={<DollarSign size={20} className={charge.status === "overdue" ? "text-red-600" : "text-green-600"} />}
  title={`Cobrança #${charge.id}`}
  status={charge.status}
  statusColor={
    charge.status === "paid" ? "green" :
    charge.status === "overdue" ? "red" :
    "yellow"
  }
  preview={
    <div className="flex justify-between">
      <span>G$ {charge.amount}</span>
      <span>{charge.dueDate}</span>
    </div>
  }
/>
```

#### Responsividade
```
Desktop (1200px+): Card completo com ações visíveis
Tablet (768px):    Card com ações em menu "..."
Mobile (375px):    Card compacto, menu horizontal
```

---

### 2. TABELAS COM PAGINAÇÃO (DataTablePaginated)

#### Estrutura
```
Título: Notas (52)

┌─────────────────────────────────────────────────┐
│ Aluno              | Nota | Status              │
├─────────────────────────────────────────────────┤
│ João Silva         | 18   | Publicada           │
│ Maria Santos       | 14   | Publicada           │
│ Pedro Oliveira     | 16   | Rascunho            │
└─────────────────────────────────────────────────┘

Exibindo 1 a 10 de 52 registros

[ Anterior ] Página 1 de 6 [ Continuar ]
```

#### Padrão de Linhas
- **Header**: Background navy-600, texto branco, caps
- **Body**: Linha clara alternando com hover
- **Hover**: Background sand (fundo claro)
- **Seleção**: Border left 3px brand-navy

#### Estados Especiais
```
Carregando: SkeletonLoader com 10 linhas
Vazio: Mensagem centralizada "Nenhum dado disponível"
Erro: Mensagem de erro com botão retry
```

---

### 3. LISTAS COM PAGINAÇÃO (LoadMoreList)

#### Estrutura
```
Título: Turmas (8)

[ Turma 1 ]  [ Turma 2 ]  [ Turma 3 ]
[ Turma 4 ]  [ Turma 5 ]  [ Turma 6 ]

[ Anterior ] Página 1 de 2 [ Continuar ]

[ Turma 7 ]  [ Turma 8 ]
```

#### Regras de Layout
- **Desktop**: Grid 2-3 colunas
- **Tablet**: Grid 2 colunas
- **Mobile**: Grid 1 coluna

---

### 4. BOTÕES E AÇÕES

#### Tipos de Botão
```
┌─────────────────────────────────────────┐
│ PRIMARY (Vermelho)                      │
│ [ Salvar ] [ Criar ] [ Confirmar ]      │
│                                         │
│ SECONDARY (Borda)                       │
│ [ Cancelar ] [ Limpar ] [ Reset ]       │
│                                         │
│ DANGER (Vermelho escuro)                │
│ [ Deletar ] [ Remover ]                 │
│                                         │
│ GHOST (Sem fundo)                       │
│ [ Editar ] [ Ver ] [ Detalhes ]         │
│                                         │
│ LOADING (Com spinner)                   │
│ [ Salvando... ]                         │
└─────────────────────────────────────────┘
```

#### Ações em Cards
```
Até 2 botões:     Visíveis lado a lado
                  [ Editar ] [ Deletar ]

3+ botões:        Últimos em menu
                  [ Editar ] [ ... ]
                         └─ [ Deletar ]
                           [ Arquivar ]
```

---

### 5. BADGES E STATUS

#### Cores de Status
```
[ Ativo ]           → Green-100 / Green-700
[ Inativo ]         → Gray-100 / Gray-700
[ Pendente ]        → Amber-100 / Amber-700
[ Publicado ]       → Blue-100 / Blue-700
[ Rascunho ]        → Gray-100 / Gray-700
[ Vencido ]         → Red-100 / Red-700
[ Pago ]            → Green-100 / Green-700
```

#### Tamanhos
- **Small**: `px-2 py-0.5 text-xs` (cards, inline)
- **Medium**: `px-3 py-1 text-sm` (standalone)

---

### 6. LOADING STATES

#### SkeletonLoader Variações
```
Tipo: "list"
[ Skeleton Line 1 ]
[ Skeleton Line 2 ]
[ Skeleton Line 3 ]

Tipo: "dashboard"
[ Skeleton Card 1 ] [ Skeleton Card 2 ]
[ Skeleton Card 3 ] [ Skeleton Card 4 ]

Tipo: "table"
┌─────────┬─────────┬─────────┐
│ Skeleton Header Area     │
├─────────┼─────────┼─────────┤
│ Skeleton Row 1          │
│ Skeleton Row 2          │
└─────────┴─────────┴─────────┘
```

#### Duração
- Shimmer animation: 2 segundos
- Loop infinito até carregamento

---

## 📱 RESPONSIVIDADE

### Breakpoints
```css
Mobile: 375px - 639px
Tablet: 640px - 1023px
Desktop: 1024px+
Large: 1280px+
```

### Adaptações por Breakpoint

#### Cards (ListItemCard)
```
375px:   Compacto, ícone pequeno, sem preview
640px:   Normal, preview linha única
1024px+: Completo, preview multi-linha, ações visíveis
```

#### Tabelas (DataTablePaginated)
```
375px:   Horizontal scroll, 2 colunas
640px:   3-4 colunas, scroll se necessário
1024px+: Todas colunas, sem scroll
```

#### Grids (LoadMoreList)
```
375px:   1 coluna
640px:   2 colunas
1024px+: 2-3 colunas (configurável)
```

---

## ⌨️ ACESSIBILIDADE

### Princípios WCAG 2.1 AA

#### Contraste
- Texto preto/branco: Razão 4.5:1 mínimo
- UI components: Razão 3:1 mínimo

#### Navegação
- ✅ Tecla Tab: Ordena elementos logicamente
- ✅ Enter: Ativa botões
- ✅ Space: Toggle checkboxes
- ✅ Arrow Keys: Navegação em tabelas

#### Labels
- ✅ Todos os inputs têm `<label>`
- ✅ Ícones têm `title` ou `aria-label`
- ✅ Status badges têm `role="status"`

---

## 🌍 INTERNACIONALIZAÇÃO

### Estrutura i18n
```jsx
// Componentes usam sempre t() para textos
<button>{t("save")}</button>
<h3>{t("students")}</h3>
<span>{t("noData")}</span>
```

### Textos Comuns
```
common:
  save: "Salvar" / "Enregistrer" / "Sove"
  cancel: "Cancelar" / "Annuler" / "Anile"
  edit: "Editar" / "Modifier" / "Modifye"
  delete: "Deletar" / "Supprimer" / "Efase"
  previous: "Anterior" / "Precedent" / "Anvan"
  continue: "Continuar" / "Continuer" / "Kontinye"
  noData: "Nenhum dado" / "Aucune donnee" / "Okenn done"
```

---

## 🎬 ANIMAÇÕES

### Transições Padrão
```css
/* Rápido (200ms) */
.transition-fast { transition: all 200ms ease-in-out }

/* Médio (300ms) */
.transition { transition: all 300ms ease-in-out }

/* Lento (500ms) */
.transition-slow { transition: all 500ms ease-in-out }
```

### Efeitos
- **Hover**: Sombra + escala 1.02
- **Focus**: Outline 2px brand-navy
- **Ativo**: Cor alterada
- **Disabled**: Opacidade 0.5

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Ao criar novo componente:
- [ ] Usar `ListItemCard` para cards
- [ ] Usar `DataTablePaginated` para tabelas
- [ ] Aplicar cores corretas (brand-navy, brand-red, etc)
- [ ] Incluir loading state (SkeletonLoader)
- [ ] Incluir empty state com mensagem
- [ ] Aplicar i18n em todo texto
- [ ] Testar mobile (375px)
- [ ] Testar acessibilidade (Tab, Enter)
- [ ] Adicionar tooltips em ícones
- [ ] Documentar no arquivo .md

### Ao refatorar página existente:
- [ ] Substituir DataTable → DataTablePaginated
- [ ] Padronizar cards com ListItemCard
- [ ] Adicionar loading skeleton
- [ ] Adicionar contagem total
- [ ] Aplicar i18n
- [ ] Testar com muitos dados (50+)
- [ ] Validar responsividade
- [ ] Code review

---

## 🔗 REFERÊNCIAS

- Tailwind CSS: https://tailwindcss.com/docs
- Lucide Icons: https://lucide.dev/
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- React i18next: https://www.i18next.com/overview/getting-started

---

**Última atualização**: May 10, 2026
**Versão**: 1.0
**Mantido por**: Arquiteto de Solução
