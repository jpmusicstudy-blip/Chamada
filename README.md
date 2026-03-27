# EduGestão — Sistema de Gestão Escolar

Sistema web completo para gerenciar **alunos, presença, notas, atividades e aulas** das turmas CK 1–4 e CT 1–4.

---

## 🔗 Configurando o Supabase (passo a passo)

### 1. Crie uma conta e projeto gratuito
Acesse **[supabase.com](https://supabase.com)** → "Start your project" → crie uma conta → "New project".

### 2. Crie as tabelas no SQL Editor

No painel do Supabase, vá em **SQL Editor** → "New Query" → cole e execute o SQL abaixo:

```sql
-- ALUNOS
create table alunos (
  id bigserial primary key,
  nome text not null,
  matricula text,
  turma text not null
);

-- NOTAS
create table notas (
  id bigserial primary key,
  aluno_id bigint references alunos(id) on delete cascade,
  disciplina text not null,
  bimestre integer not null,
  nota numeric(4,1) not null,
  turma text
);

-- PRESENÇAS
create table presencas (
  id bigserial primary key,
  aluno_id bigint references alunos(id) on delete cascade,
  data date not null,
  status char(1) not null,
  justificativa text,
  turma text not null
);

-- ATIVIDADES
create table atividades (
  id bigserial primary key,
  titulo text not null,
  descricao text,
  disciplina text,
  data_entrega date,
  peso integer default 1,
  turma text not null
);

-- AULAS
create table aulas (
  id bigserial primary key,
  tipo text not null,
  disciplina text,
  conteudo text,
  data date not null,
  inicio time not null,
  fim time not null,
  turma text not null
);
```

### 3. Desabilite o RLS (Row Level Security) para uso interno

Ainda no **SQL Editor**, execute:

```sql
alter table alunos     disable row level security;
alter table notas      disable row level security;
alter table presencas  disable row level security;
alter table atividades disable row level security;
alter table aulas      disable row level security;
```

> ⚠ Para uso em produção / com múltiplos usuários, configure políticas RLS adequadas.

### 4. Pegue as credenciais do projeto

No painel do Supabase vá em **Project Settings → API**:

| Campo | Onde encontrar |
|---|---|
| **URL do Projeto** | "Project URL" — ex: `https://abcxyzabc.supabase.co` |
| **Anon Key** | "Project API Keys" → `anon` `public` |

### 5. Configure no EduGestão

Abra o sistema → clique em **⚙ Configurar** (canto inferior esquerdo) → cole a URL e a Anon Key → clique **Salvar & Conectar**.

✅ Se aparecer "Supabase conectado" em verde, está funcionando!  
❌ Se der erro, verifique se as tabelas foram criadas (passo 2) e se o RLS foi desabilitado (passo 3).

---

## 📁 Estrutura de arquivos

```
escola-gestao/
├── index.html   ← estrutura HTML + carrega Supabase via CDN
├── style.css    ← tema escuro, responsivo
├── app.js       ← lógica completa + integração Supabase real
└── README.md    ← este arquivo
```

---

## 📋 Funcionalidades

| Módulo | O que faz |
|---|---|
| **Alunos** | Adicionar, editar, remover, buscar — salvo no banco |
| **Presença** | Lançar P/F/J por data, justificativa, histórico |
| **Notas** | Por bimestre e disciplina, editar, remover |
| **Atividades** | Com peso, data de entrega, disciplina |
| **Aulas** | Regular (2h) e AE (1h), término automático, carga horária |
| **Desempenho** | Média, frequência, conceito A/B/C/D, score composto |
| **Dashboard** | Ranking, alertas de risco, estatísticas da turma |

---

## 🚀 Como abrir o sistema

Basta abrir o arquivo `index.html` em qualquer navegador moderno.  
Não precisa de servidor — funciona localmente ou hospedado em qualquer CDN estático (Netlify, Vercel, GitHub Pages).
