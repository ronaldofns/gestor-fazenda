-- 001_init.sql
-- Enable pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- Table: fazendas
create table if not exists fazendas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  logo_url text,
  created_at timestamptz default now()
);

-- Table: vacas (matrizes)
create table if not exists vacas (
  id uuid primary key default gen_random_uuid(),
  brinco text,
  raca text,
  data_nascimento date,
  fazenda_id uuid references fazendas(id) on delete set null,
  created_at timestamptz default now()
);

-- Table: bezerros
create table if not exists bezerros (
  id uuid primary key default gen_random_uuid(),
  brinco text,
  sexo text,
  data_nascimento date,
  mae_id uuid references vacas(id) on delete set null,
  peso_nascimento numeric,
  fazenda_id uuid references fazendas(id) on delete set null,
  created_at timestamptz default now()
);

-- Table: desmama
create table if not exists desmama (
  id uuid primary key default gen_random_uuid(),
  bezerro_id uuid references bezerros(id) on delete cascade,
  peso_desmama numeric,
  data_desmama date,
  created_at timestamptz default now()
);

-- Table: usuarios (metadata linking to auth.users)
create table if not exists usuarios (
  id uuid primary key references auth.users(id),
  nome text,
  role text check (role in ('admin','gerente','peao','visitante')) default 'peao',
  fazenda_id uuid references fazendas(id),
  created_at timestamptz default now()
);

-- Table: sync_events
create table if not exists sync_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  entidade text,
  entidade_id uuid,
  tipo text,
  payload jsonb,
  synced boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_bezerros_fazenda on bezerros(fazenda_id);
create index if not exists idx_vacas_fazenda on vacas(fazenda_id);
create index if not exists idx_desmama_bezerro on desmama(bezerro_id);
