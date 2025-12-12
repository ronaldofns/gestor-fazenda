-- 006_add_racas_online.sql
-- Adicionar tabela racas_online para sincronização

-- Table: racas_online
create table if not exists racas_online (
  id bigserial primary key,
  uuid text unique not null,
  nome text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes para melhor performance
create index if not exists idx_racas_online_uuid on racas_online(uuid);
create index if not exists idx_racas_online_nome on racas_online(nome);

-- Enable RLS
alter table racas_online enable row level security;

-- Policies básicas: permitir acesso autenticado
create policy "racas_online_select" on racas_online
  for select using (auth.role() = 'authenticated');

create policy "racas_online_insert" on racas_online
  for insert with check (auth.role() = 'authenticated');

create policy "racas_online_update" on racas_online
  for update using (auth.role() = 'authenticated');

create policy "racas_online_delete" on racas_online
  for delete using (auth.role() = 'authenticated');

