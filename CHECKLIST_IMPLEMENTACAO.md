# ✅ CHECKLIST DE IMPLEMENTAÇÃO
## Portal Educação - Refatoração & Profissionalização

---

## 🎯 PRÉ-REQUISITOS

### Antes de Começar
- [ ] Ler README_FINAL.md (5 minutos)
- [ ] Ler ARCHITECTURE_ANALYSIS.md (15 minutos)
- [ ] Entender componentes DataTablePaginated.jsx (10 minutos)
- [ ] Entender componentes ListItemCard.jsx (10 minutos)
- [ ] Revisar DESIGN_SYSTEM.md (10 minutos)
- [ ] Criar branch: `git checkout -b refactor/professional-ui`

**Tempo Total**: ~50 minutos

---

## 🔴 FASE 1: CRÍTICA (3-5 dias)

### 1. ProfessorGrades.jsx
**Prioridade**: 🔴 CRÍTICA (muitos professores usam)

#### Status Atual
- [ ] Abrir arquivo: `apps/frontend/src/pages/professor/ProfessorGrades.jsx`
- [ ] Verificar: Usa DataTable?
- [ ] Verificar: Quantas colunas tem?
- [ ] Verificar: Como filtra/ordena?

#### Refatoração
- [ ] Copiar estrutura de DataTablePaginated.jsx
- [ ] Importar: `import DataTablePaginated from "@/components/DataTablePaginated"`
- [ ] Remover: Código antigo do DataTable
- [ ] Adicionar: columns array (nome, código, nota, status)
- [ ] Adicionar: loading state
- [ ] Testar: Com 50+ alunos

#### Translation Keys
- [ ] Adicionar a pt.json: `"gradesTable"`, `"studentName"`, `"grade"`, `"status"`
- [ ] Adicionar a fr.json: mesmos nomes (francês)
- [ ] Adicionar a ht.json: mesmos nomes (crioulo)

#### QA
- [ ] Testar: Desktop (1920x1080)
- [ ] Testar: Tablet (1024x768)
- [ ] Testar: Mobile (375x667)
- [ ] Testar: Mudança de idioma
- [ ] Testar: 150+ registros (performance)
- [ ] Commit: `git commit -m "refactor(professor): modernize grades table"`

---

### 2. StudentSchedule.jsx
**Prioridade**: 🔴 CRÍTICA (todos estudantes usam)

#### Status Atual
- [ ] Abrir arquivo: `apps/frontend/src/pages/student/StudentSchedule.jsx`
- [ ] Verificar: Como exibe horários?
- [ ] Verificar: Quantas colunas tem?

#### Refatoração
- [ ] Usar DataTablePaginated para exibir cronograma
- [ ] Importar: `import DataTablePaginated from "@/components/DataTablePaginated"`
- [ ] Adicionar: Coluna "Classe" + "Horário" + "Professor" + "Sala"
- [ ] Adicionar: Filtro por dia da semana (opcional)
- [ ] Testar: Com 20+ horários

#### Translation Keys
- [ ] Adicionar: `"scheduleTable"`, `"class"`, `"time"`, `"teacher"`, `"room"`
- [ ] Sincronizar com pt/fr/ht.json

#### QA
- [ ] Testar: Todos os dias da semana
- [ ] Testar: Mudança de idioma
- [ ] Testar: Mobile (melhor legibilidade)
- [ ] Commit: `git commit -m "refactor(student): modernize schedule view"`

---

### 3. AdminFinanceControl.jsx
**Prioridade**: 🔴 CRÍTICA (gestão de dinheiro)

#### Status Atual
- [ ] Abrir arquivo: `apps/frontend/src/pages/admin/AdminFinanceControl.jsx`
- [ ] Verificar: Como exibe cobranças/pagamentos?
- [ ] Verificar: Quantas colunas tem?

#### Refatoração - Opção A: Cards (Melhor UX)
- [ ] Usar ListItemCard para cada cobrança
- [ ] Mostrar: Aluno | Classe | Valor | Status
- [ ] Preview expandido com: Datas, histórico, observações
- [ ] Ações: Edit, Delete, Mark as Paid

#### Refatoração - Opção B: Tabela (Mais Dados)
- [ ] Usar DataTablePaginated
- [ ] Colunas: Aluno, Classe, Valor, Data, Status
- [ ] Ações ao clicar: View/Edit

**Recomendação**: Começar com Cards (ListItemCard) - melhor visual

#### Translation Keys
- [ ] Adicionar: `"financeTable"`, `"student"`, `"class"`, `"amount"`, `"markAsPaid"`
- [ ] Sincronizar

#### QA
- [ ] Testar: Com 100+ cobranças
- [ ] Testar: Filtro por status (Pago/Pendente/Vencido)
- [ ] Testar: Mudança de idioma
- [ ] Commit: `git commit -m "refactor(admin): modernize finance control"`

---

## 🟠 FASE 2: ALTA PRIORIDADE (3-5 dias)

### 4. ProfessorMessages.jsx
- [ ] Abrir arquivo
- [ ] Aplicar padrão: ListItemCard + LoadMoreList
- [ ] Mostrar: De quem | Assunto | Data | Status (Lida/Não lida)
- [ ] Ação: Click expande preview
- [ ] Traduzir todas as strings
- [ ] QA em 3 resoluções

### 5. StudentMessages.jsx
- [ ] Mesmo padrão de ProfessorMessages
- [ ] Adicionar: Badge de não lidas
- [ ] Ações: Arquivar, Favoritar, Responder
- [ ] Testar com 30+ mensagens

### 6. Forums.jsx (TODO: Listar todas subcategorias)
- [ ] Aplicar ListItemCard + LoadMoreList
- [ ] Mostrar: Tópico | Autor | Respostas | Última atividade
- [ ] Cores diferentes por categoria
- [ ] Click expande preview do tópico

### 7. AdminClasses.jsx
- [ ] Revisar estrutura existente
- [ ] Padronizar com ListItemCard se for cards
- [ ] Ou com DataTablePaginated se for tabela
- [ ] Adicionar: Filtro por série/curso

### 8. StudentResults.jsx
- [ ] Usar DataTablePaginated
- [ ] Colunas: Disciplina | Nota | Status (Aprovado/Reprovado)
- [ ] Adicionar: Gráfico simples (opcional)
- [ ] Testar com 20+ disciplinas

---

## 🟡 FASE 3: MÉDIA PRIORIDADE (3-5 dias)

### 9. StudentResources.jsx
- [ ] Aplicar ListItemCard
- [ ] Mostrar: Título | Professor | Tipo (PDF, Video, Link)
- [ ] Preview: Descrição + Download link
- [ ] Status: Novo/Baixado/Assistido

### 10. ProfessorResources.jsx
- [ ] ListItemCard para recurso criado
- [ ] Ações: Edit, Delete, View Downloads
- [ ] Mostrar: Data criação | Downloads | Status (Publicado/Rascunho)

### 11. StudentAssignments.jsx
- [ ] ListItemCard por tarefa
- [ ] Mostrar: Título | Profesor | Data limite | Status (Pendente/Entregue)
- [ ] Preview: Descrição + Archivos para enviar
- [ ] Badge cor vermelha se vencido

### 12. StudentLessonPlans.jsx
- [ ] ListItemCard por aula
- [ ] Mostrar: Disciplina | Data | Professor
- [ ] Preview: Conteúdo + Arquivos

### 13. ProfessorLessonPlans.jsx
- [ ] Listar planos criados (ListItemCard)
- [ ] Ações: Edit, Preview, Publish/Unpublish
- [ ] Mostrar status na badge

---

## 🟢 FASE 4: BAIXA PRIORIDADE (2-3 dias)

### 14. Outras Páginas de Listas
- [ ] Listar todas as páginas com tables/listas
- [ ] Aplicar padrão apropriado
- [ ] Adicionar i18n

---

## 📋 TEMPLATE PARA CADA REFATORAÇÃO

### Passo 1: Preparar
```bash
git checkout -b refactor/[page-name]
```

### Passo 2: Importar Componente
```jsx
// Se for lista de items
import ListItemCard from "@/components/ListItemCard";
import { LoadMoreList } from "@/components/LoadMoreList";

// Se for tabela com dados
import DataTablePaginated from "@/components/DataTablePaginated";
```

### Passo 3: Adicionar i18n
```jsx
import { useTranslation } from "react-i18next";

export function MyComponent() {
  const { t } = useTranslation();
  // Usar t("key") em lugar de strings hardcoded
}
```

### Passo 4: Adicionar Translation Keys
Editar:
- `apps/frontend/src/locales/pt.json`
- `apps/frontend/src/locales/fr.json`
- `apps/frontend/src/locales/ht.json`

Template:
```json
{
  "myPageTitle": "Meu Título",
  "myPageSubtitle": "Subtítulo",
  "myTableHeader": "Cabeçalho Tabela",
  "editAction": "Editar",
  "deleteAction": "Deletar"
}
```

### Passo 5: Testar
```bash
npm run build
npm run dev
```

Checklist de teste:
- [ ] Desktop: UI ok?
- [ ] Mobile: UI responsivo?
- [ ] Idioma: Português mostra?
- [ ] Idioma: Francês mostra?
- [ ] Idioma: Crioulo mostra?
- [ ] Dados: Carregam corretamente?
- [ ] Paginação: Funciona? (se aplicável)
- [ ] Ações: Botões funcionam?

### Passo 6: Commit
```bash
git add .
git commit -m "refactor(module): modernize [component-name]"
git push origin refactor/[page-name]
```

### Passo 7: PR
- [ ] Descrever mudanças no PR
- [ ] Adicionar screenshots (antes/depois)
- [ ] Pedir code review
- [ ] Esperar aprovação

### Passo 8: Merge
- [ ] Code review aprovado?
- [ ] CI/CD passou?
- [ ] Merge para main
- [ ] Deploy para staging

---

## 🧪 TESTE FINAL ANTES DE COMMIT

### Checklist QA

#### 1. Build
```bash
npm run build
# ✅ Sem erros?
# ✅ Tamanho do build aceitável?
```

#### 2. Desenvolvimento
```bash
npm run dev
# ✅ Sem warnings no console?
# ✅ Sem erros de importação?
```

#### 3. Funcional
- [ ] Componente renderiza?
- [ ] Dados carregam?
- [ ] Loading state mostra?
- [ ] Erro state mostra?
- [ ] Ações (edit/delete) funcionam?

#### 4. Responsive
- [ ] Desktop (1920x1080): OK?
- [ ] Tablet (1024x768): OK?
- [ ] Mobile (375x667): OK?

#### 5. i18n
- [ ] Português: Texto correto?
- [ ] Francês: Texto correto?
- [ ] Crioulo: Texto correto?
- [ ] Mudança automática por browser locale?

#### 6. Acessibilidade
- [ ] Botões com ARIA labels?
- [ ] Links navegáveis com Tab?
- [ ] Cores com contraste suficiente?

#### 7. Performance
- [ ] Carrega em <2 segundos?
- [ ] Com 100+ itens ainda rápido?
- [ ] Scroll suave?

---

## 📊 TRACKING DE PROGRESSO

### Semana 1 (Sprint 1)
```
[_] ProfessorGrades    (2 dias)
[_] StudentSchedule    (2 dias)
[_] AdminFinanceControl (1 dia)
```
**Meta**: 60% da Fase 1 pronta

### Semana 2 (Sprint 1)
```
[_] ProfessorMessages  (1 dia)
[_] StudentMessages    (1 dia)
[_] Forums             (2 dias)
[_] AdminClasses       (1 dia)
[_] StudentResults     (1 dia)
```
**Meta**: 100% Fase 1 + 70% Fase 2 pronta

### Semana 3 (Sprint 2)
```
[_] StudentResources   (1 dia)
[_] ProfessorResources (1 dia)
[_] StudentAssignments (1 dia)
[_] Outras páginas     (2 dias)
[_] QA Completa        (2 dias)
```
**Meta**: 100% Fase 2-3 + QA pronta | Deploy para staging

### Semana 4 (Sprint 2)
```
[_] Testes de Produção (1 dia)
[_] Feedback Usuários  (2 dias)
[_] Fixes Críticos     (2 dias)
[_] Deploy Produção    (1 dia)
```
**Meta**: Sistema em produção com +80% das páginas modernizadas

---

## 🎯 DEFINIÇÃO DE "PRONTO"

Um componente/página está **PRONTO** quando:

- ✅ Código refatorado com novo componente
- ✅ Todos strings hardcoded removidos
- ✅ i18n keys adicionadas a pt/fr/ht.json
- ✅ npm run build executa sem erros
- ✅ Funciona em desktop/tablet/mobile
- ✅ Todos idiomas funcionam
- ✅ Loading states implementados
- ✅ Erro states implementados
- ✅ Estados vazios implementados
- ✅ QA validou (3+ resoluções)
- ✅ Code review passou
- ✅ Commit com mensagem clara
- ✅ PR merged para main

---

## 🚨 SITUAÇÕES COMUNS & SOLUÇÕES

### Problema: "npm run build falha"
```
Solução:
1. npm install (se adicionou dependências)
2. npm run build
3. Se persiste, verificar imports
   - DataTablePaginated está em ./components/?
   - i18n está em ./i18n.js?
4. Checar console: que arquivo falhou?
```

### Problema: "Componente não renderiza"
```
Solução:
1. Abrir browser dev tools (F12)
2. Console: há erros vermelhos?
3. Se sim, copiar erro para ChatGPT
4. Verificar: prop obrigatória está passando?
   - DataTablePaginated precisa: columns, rows
   - ListItemCard precisa: title, content
```

### Problema: "Tradução não aparece"
```
Solução:
1. Verificar pt.json: key existe?
2. Verificar fr.json: key existe?
3. Verificar ht.json: key existe?
4. Componente tem useTranslation()?
   - const { t } = useTranslation();
5. String usa t("key") e não string direta?
6. Se simples: fazer npm run dev reload (Ctrl+Shift+R)
```

### Problema: "Mobile fica fora da tela"
```
Solução:
1. Verificar viewport meta tag (deve estar em index.html)
2. Verificar: tailwind classes responsive?
   - md: para tablet
   - lg: para desktop
3. Testar com DevTools mobile mode (F12 → Toggle device)
```

### Problema: "Componente fica lento com 100+ dados"
```
Solução:
1. Usar DataTablePaginated (paginação automática)
2. Ou ListItemCard + LoadMoreList
3. Não renderizar todos de uma vez
4. Verificar: há loop desnecessário?
5. Profile com React DevTools
```

---

## 📚 REFERÊNCIAS RÁPIDAS

### Arquivos de Componentes
- **DataTablePaginated**: `apps/frontend/src/components/DataTablePaginated.jsx`
- **ListItemCard**: `apps/frontend/src/components/ListItemCard.jsx`
- **LoadMoreList**: `apps/frontend/src/components/LoadMoreList.jsx` (já existe)

### Arquivos de Tradução
- **Português**: `apps/frontend/src/locales/pt.json`
- **Francês**: `apps/frontend/src/locales/fr.json`
- **Crioulo**: `apps/frontend/src/locales/ht.json`

### Documentação
- **Arquitetura**: `ARCHITECTURE_ANALYSIS.md`
- **Guia**: `REFACTORING_GUIDE.md`
- **Design**: `DESIGN_SYSTEM.md`
- **Resumo**: `IMPLEMENTATION_SUMMARY.md` + `README_FINAL.md`

### Comandos Úteis
```bash
# Build de produção
npm run build

# Dev com reload automático
npm run dev

# Lint (verificar código)
npm run lint

# Type check
npm run typecheck

# Teste
npm run test
```

---

## ✅ ÚLTIMO CHECKLIST ANTES DE COMEÇAR

- [ ] Branch criada: `refactor/professional-ui`
- [ ] Documentação lida (todos 4 arquivos)
- [ ] Componentes DataTablePaginated e ListItemCard entendidos
- [ ] Primeiro arquivo escolhido (recomendado: ProfessorGrades)
- [ ] VsCode aberto no projeto
- [ ] Terminal pronto: `npm run dev`
- [ ] Git status limpo: `git status` (nada modificado)

**Status**: 🟢 **PRONTO PARA COMEÇAR**

---

**Criado em**: May 10, 2026
**Versão**: 1.0
**Mantido por**: Arquiteto de Solução

