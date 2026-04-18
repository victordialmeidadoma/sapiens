-- ============================================================
-- SAPIENS · TCE-MA — Schema do banco de dados (Supabase)
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- ── PERFIS DE USUÁRIO ────────────────────────────────────────
-- Extende a tabela auth.users do Supabase
create table if not exists perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  perfil      text not null default 'colaborador' check (perfil in ('admin', 'colaborador')),
  ativo       boolean default true,
  created_at  timestamptz default now()
);

-- ── PROCESSOS ────────────────────────────────────────────────
create table if not exists processos (
  id          bigint primary key generated always as identity,
  proc        text not null,
  et          text,
  sit         text,
  ex          text,
  ass         text,
  mun         text,
  tipo_ente   text,
  gestor      text,
  natureza    text,
  especie     text,
  relator     text,
  resp        text,
  resp_int    text,
  cit         text,
  pz          text,
  pr          text,
  pi          text,
  pp          text,
  obs         text,
  ac          text,
  mt          text,
  md          text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── HISTÓRICO ────────────────────────────────────────────────
create table if not exists historico (
  id           bigint primary key generated always as identity,
  processo_id  bigint not null references processos(id) on delete cascade,
  tipo         text,
  data         text,
  descricao    text,
  tce          boolean default false,
  created_at   timestamptz default now()
);

-- ── ANEXOS ───────────────────────────────────────────────────
create table if not exists anexos (
  id            bigint primary key generated always as identity,
  processo_id   bigint not null references processos(id) on delete cascade,
  nome          text,
  tamanho       bigint,
  mimetype      text,
  storage_path  text,
  created_at    timestamptz default now()
);

-- ── MUNICÍPIOS ───────────────────────────────────────────────
create table if not exists municipios (
  id          bigint primary key generated always as identity,
  nome        text not null,
  tipo        text default 'Prefeitura',
  estado      text default 'Maranhao',
  logo        text,
  obs         text,
  created_at  timestamptz default now()
);

-- ── MANDATOS ─────────────────────────────────────────────────
create table if not exists mandatos (
  id            bigint primary key generated always as identity,
  municipio_id  bigint not null references municipios(id) on delete cascade,
  gestor        text,
  inicio        text,
  fim           text,
  escopo        text,
  contratocom   text,
  status        text default 'Ativo'
);

-- ── CONTATOS ─────────────────────────────────────────────────
create table if not exists contatos (
  id            bigint primary key generated always as identity,
  municipio_id  bigint not null references municipios(id) on delete cascade,
  nome          text,
  cargo         text,
  tel           text,
  email         text
);

-- ── DEMANDAS ─────────────────────────────────────────────────
create table if not exists demandas (
  id            bigint primary key generated always as identity,
  municipio_id  bigint not null references municipios(id) on delete cascade,
  tipo          text,
  data          text,
  descricao     text,
  status        text default 'Em andamento',
  procvinc      text,
  created_at    timestamptz default now()
);

-- ── GESTORES ─────────────────────────────────────────────────
create table if not exists gestores (
  id            bigint primary key generated always as identity,
  nome          text not null,
  cargo         text,
  municipio     text,
  tel           text,
  email         text,
  contrato_tipo text,
  inicio        text,
  status        text default 'Ativo',
  obs           text,
  created_at    timestamptz default now()
);

-- ── RLS (Row Level Security) ──────────────────────────────────
-- Usando service role key nas API routes, não precisamos de RLS complexo.
-- Habilitamos RLS mas permitimos tudo via service role.
alter table perfis      enable row level security;
alter table processos   enable row level security;
alter table historico   enable row level security;
alter table anexos      enable row level security;
alter table municipios  enable row level security;
alter table mandatos    enable row level security;
alter table contatos    enable row level security;
alter table demandas    enable row level security;
alter table gestores    enable row level security;

-- Policies: service role tem acesso total (API routes usam service role)
-- Usuários autenticados podem ler (o controle de admin/colaborador fica na API)
create policy "service role full access" on perfis      for all using (true);
create policy "service role full access" on processos   for all using (true);
create policy "service role full access" on historico   for all using (true);
create policy "service role full access" on anexos      for all using (true);
create policy "service role full access" on municipios  for all using (true);
create policy "service role full access" on mandatos    for all using (true);
create policy "service role full access" on contatos    for all using (true);
create policy "service role full access" on demandas    for all using (true);
create policy "service role full access" on gestores    for all using (true);

-- ── TRIGGER: updated_at automático ───────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger processos_updated_at
  before update on processos
  for each row execute function update_updated_at();

-- ── TRIGGER: criar perfil ao criar usuário ────────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into perfis (id, nome, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    coalesce(new.raw_user_meta_data->>'perfil', 'colaborador')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── STORAGE: bucket para anexos ───────────────────────────────
-- Execute depois de criar o bucket "anexos" no Supabase Storage
-- insert into storage.buckets (id, name, public) values ('anexos', 'anexos', false);

-- ============================================================
-- INSTRUÇÕES:
-- 1. Cole este SQL no Supabase Dashboard > SQL Editor > New query
-- 2. Execute com "Run"
-- 3. Vá em Authentication > Users > Add user
--    Email: admin@sapiens.com | Senha: admin123
--    Em user metadata coloque: {"nome": "Administrador", "perfil": "admin"}
-- 4. Crie o bucket "anexos" em Storage > New bucket (private)
-- ============================================================
