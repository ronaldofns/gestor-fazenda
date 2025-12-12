-- 004_sync_tables.sql
-- Tabelas para sincronização offline/online
-- Estas tabelas são usadas pelo serviço de sincronização

-- Table: fazendas_online
create table if not exists fazendas_online (
  id bigserial primary key,
  uuid text unique not null,
  nome text not null,
  logo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Table: nascimentos_online
create table if not exists nascimentos_online (
  id bigserial primary key,
  uuid text unique not null,
  fazenda_uuid text not null,
  matriz_id text not null,
  mes integer not null check (mes >= 1 and mes <= 12),
  ano integer not null,
  novilha boolean default false,
  vaca boolean default false,
  brinco_numero text,
  data_nascimento date,
  sexo text check (sexo in ('M', 'F')),
  raca text,
  obs text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Table: desmamas_online
create table if not exists desmamas_online (
  id bigserial primary key,
  uuid text unique not null,
  nascimento_uuid text not null,
  data_desmama date,
  peso_desmama numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes para melhor performance
create index if not exists idx_fazendas_online_uuid on fazendas_online(uuid);
create index if not exists idx_nascimentos_online_uuid on nascimentos_online(uuid);
create index if not exists idx_nascimentos_online_fazenda on nascimentos_online(fazenda_uuid);
create index if not exists idx_nascimentos_online_mes_ano on nascimentos_online(mes, ano);
create index if not exists idx_nascimentos_online_matriz on nascimentos_online(matriz_id);
create index if not exists idx_desmamas_online_uuid on desmamas_online(uuid);
create index if not exists idx_desmamas_online_nascimento on desmamas_online(nascimento_uuid);

-- Enable RLS
alter table fazendas_online enable row level security;
alter table nascimentos_online enable row level security;
alter table desmamas_online enable row level security;

-- Policies básicas: permitir acesso autenticado
create policy "fazendas_online_select" on fazendas_online
  for select using (auth.role() = 'authenticated');

create policy "fazendas_online_insert" on fazendas_online
  for insert with check (auth.role() = 'authenticated');

create policy "fazendas_online_update" on fazendas_online
  for update using (auth.role() = 'authenticated');

create policy "nascimentos_online_select" on nascimentos_online
  for select using (auth.role() = 'authenticated');

create policy "nascimentos_online_insert" on nascimentos_online
  for insert with check (auth.role() = 'authenticated');

create policy "nascimentos_online_update" on nascimentos_online
  for update using (auth.role() = 'authenticated');

create policy "desmamas_online_select" on desmamas_online
  for select using (auth.role() = 'authenticated');

create policy "desmamas_online_insert" on desmamas_online
  for insert with check (auth.role() = 'authenticated');

create policy "desmamas_online_update" on desmamas_online
  for update using (auth.role() = 'authenticated');

-- Policies para DELETE: permitir exclusão para usuários autenticados
create policy "fazendas_online_delete" on fazendas_online
  for delete using (auth.role() = 'authenticated');

create policy "nascimentos_online_delete" on nascimentos_online
  for delete using (auth.role() = 'authenticated');

create policy "desmamas_online_delete" on desmamas_online
  for delete using (auth.role() = 'authenticated');

