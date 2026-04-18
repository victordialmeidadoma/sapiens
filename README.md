# SAPIENS · TCE-MA v4.0
### Next.js + Supabase — Sistema de Acompanhamento de Processos

---

## Stack
- **Next.js 14** (App Router) — frontend + API routes
- **Supabase** — banco PostgreSQL, autenticação, armazenamento de arquivos
- **Vercel** — hospedagem (deploy em 2 minutos)

---

## Deploy em 5 passos

### 1. Criar projeto no Supabase
1. Acesse **supabase.com** → New project
2. Anote as credenciais: **Project URL** e as duas **API Keys** (anon e service_role)

### 2. Criar o banco de dados
1. No painel do Supabase → **SQL Editor** → New query
2. Cole o conteúdo do arquivo `supabase/schema.sql`
3. Clique em **Run**

### 3. Criar o primeiro usuário (admin)
1. Supabase → **Authentication** → **Users** → **Add user**
2. Preencha:
   - Email: `admin@sapiens.com`
   - Password: `admin123`
   - Em **User Metadata** (JSON): `{"nome": "Administrador", "perfil": "admin"}`
3. Clique em **Create User**

### 4. Criar bucket para anexos
1. Supabase → **Storage** → **New bucket**
2. Nome: `anexos`
3. Marque como **Private**

### 5. Deploy no Vercel
1. Acesse **vercel.com** → New Project
2. Importe este repositório do GitHub
3. Adicione as variáveis de ambiente:

```
NEXT_PUBLIC_SUPABASE_URL     = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
SUPABASE_SERVICE_ROLE_KEY    = eyJ...
SUPABASE_STORAGE_BUCKET      = anexos
```

4. Clique em **Deploy**

Em ~2 minutos você recebe um link como `https://sapiens-tce-ma.vercel.app`

---

## Domínio próprio
No Vercel → Settings → Domains → adicione seu domínio e aponte o DNS.

---

## Rodando localmente (desenvolvimento)

```bash
# Instale Node.js 18+ em nodejs.org

# 1. Instale as dependências
npm install

# 2. Copie e preencha as variáveis
cp .env.local.example .env.local
# Edite .env.local com suas credenciais do Supabase

# 3. Rode o servidor
npm run dev

# Acesse: http://localhost:3000
```

---

## Migrar para AWS / Google Cloud
Esta aplicação é padrão Node.js. Para migrar:
- **AWS**: Elastic Beanstalk ou ECS com `npm run build && npm start`
- **Google Cloud**: Cloud Run com Dockerfile (Next.js gera imagem standalone)
- O banco Supabase continua o mesmo — só muda onde o Next.js roda

---

## Estrutura do projeto
```
sapiens-next/
├── app/
│   ├── page.js              ← Página principal (protegida)
│   ├── login/page.js        ← Tela de login
│   ├── layout.js            ← Layout raiz
│   ├── globals.css          ← Design system completo
│   └── api/                 ← API Routes (backend)
│       ├── processos/
│       ├── municipios/
│       ├── gestores/
│       ├── usuarios/
│       └── auth/
├── components/
│   └── DashboardClient.jsx  ← Interface completa (React)
├── lib/
│   ├── supabase/
│   │   ├── client.js        ← Client browser
│   │   ├── server.js        ← Client server (cookies)
│   │   └── admin.js         ← Service role (API routes)
│   └── auth.js              ← Helpers de autenticação
├── middleware.js             ← Proteção de rotas
├── supabase/
│   └── schema.sql           ← Schema completo do banco
└── .env.local.example       ← Template de variáveis
```

---

## Roadmap — próximas funcionalidades sugeridas
- **IA com RAG**: Supabase tem `pgvector` nativo — basta ativar e guardar embeddings dos processos
- **Geração de minutas**: API route chamando Claude/GPT com dados do processo
- **Notificações por email**: SendGrid ou Resend via API route agendada
- **Integração D.O.TCE**: Web scraping das publicações do TCE-MA

---

SAPIENS v4.0 · TCE-MA
