-- 012_add_matrizes_online.sql
-- Tabela de matrizes para sincronização com IndexedDB

-- Table: matrizes_online
create table if not exists matrizes_online (
  id bigserial primary key,
  uuid text unique not null, -- UUID local do IndexedDB
  identificador text not null, -- Código/brinco da matriz (ex: 123, V-01)
  fazenda_uuid text not null, -- UUID da fazenda (referência local)
  categoria text check (categoria in ('novilha','vaca')) not null,
  raca text,
  data_nascimento date,
  pai text, -- Identificador do pai (livre, sem FK)
  mae text, -- Identificador da mãe (livre, sem FK)
  ativo boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Indexes para melhor performance
create index if not exists idx_matrizes_online_uuid on matrizes_online(uuid);
create index if not exists idx_matrizes_online_fazenda_uuid on matrizes_online(fazenda_uuid);
create index if not exists idx_matrizes_online_identificador on matrizes_online(identificador);
create index if not exists idx_matrizes_online_ativo on matrizes_online(ativo);

-- Comentários para documentação
comment on table matrizes_online is 'Tabela para sincronização de matrizes (vacas/novilhas) com o IndexedDB local.';
comment on column matrizes_online.uuid is 'UUID local do IndexedDB, usado para identificar a matriz localmente.';
comment on column matrizes_online.fazenda_uuid is 'UUID da fazenda no IndexedDB.';
comment on column matrizes_online.identificador is 'Identificador/brinco da matriz (código usado na planilha).';
comment on column matrizes_online.categoria is 'Categoria da matriz: novilha ou vaca.';

-- Habilitar Row Level Security (RLS)
alter table matrizes_online enable row level security;

-- Policies básicas: permitir acesso autenticado
create policy "matrizes_online_select_authenticated" on matrizes_online
  for select
  using (auth.role() = 'authenticated');

create policy "matrizes_online_insert_authenticated" on matrizes_online
  for insert
  with check (auth.role() = 'authenticated');

create policy "matrizes_online_update_authenticated" on matrizes_online
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "matrizes_online_delete_authenticated" on matrizes_online
  for delete
  using (auth.role() = 'authenticated');


