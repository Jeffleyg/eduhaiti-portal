# 🇭🇹 EduHaiti - Portal Éducatif

O **EduHaiti** é uma plataforma digital de gestão escolar focada na eficiência pedagógica e na transparência académica. Este portal permite que professores façam a gestão completa de suas turmas e que alunos acompanhem seu progresso em tempo real.

## 🛠️ Stack Tecnológica
- **Frontend:** React.js (Vite), Tailwind CSS, Lucide Icons.
- **Backend:** NestJS, JWT Auth, Prisma ORM.
- **Database:** Supabase PostgreSQL.

## 📋 Funcionalidades Principais

### 👨‍🏫 Espace Professeur
- **Tableau de Bord:** Visão geral da turma e médias.
- **Feuille d'Appel:** Registro digital de presença.
- **Gestion des Notes:** Edição e publicação de boletins.
- **Ressources:** Upload de materiais (PDF/PPT).

### 👨‍🎓 Espace Élève
- **Mes Résultats:** Consulta de notas e status de aprovação.
- **Horaire:** Agenda semanal de aulas.
- **Devoirs:** Acesso e submissão de tarefas.
- **Messagerie:** Comunicação direta com a escola.

---
*Développé pour l'avenir de l'éducation en Haïti.*

## 📦 Estrutura do Monorepo
```
apps/
	backend/    # NestJS + Prisma
	frontend/   # React + Vite + Tailwind
packages/
```

## 🚀 Como Rodar (Dev)
### 0) Configurar Supabase
1. Crie um projeto no Supabase.
2. Copie a connection string direta para `DIRECT_URL`.
3. Copie a connection string do pooler ou uma URL compatível com Prisma para `DATABASE_URL`.
4. Ajuste `apps/backend/.env` com essas variáveis antes de rodar as migrations.

### 1) Banco + Apps com Docker
```bash
docker compose up
```

### 2) Rodar localmente (sem Docker)
```bash
# backend
cd apps/backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run start:dev

# frontend
cd ../frontend
npm install
npm run dev
```

## 🔐 Autenticacao (MVP)
- Fluxo de login com codigo enviado por email (modo dev retorna `devCode`).
- Endpoints principais: `/api/auth/request-code`, `/api/auth/verify-code`, `/api/auth/me`.

## 🌍 Idiomas
- Francais (FR) e Kreyol Ayisyen (HT) ja configurados no frontend.
