-- 013_add_audits_online.sql
-- Tabela de auditoria para sincronização com o IndexedDB

create table if not exists audits_online (
  id bigserial primary key,
  uuid text unique not null, -- UUID local do registro de auditoria
  entity text not null check (entity in ('fazenda','raca','nascimento','desmama','matriz','usuario')),
  entity_id text not null, -- ID local da entidade (UUID do IndexedDB)
  action text not null check (action in ('create','update','delete')),
  timestamp timestamptz not null default now(),
  user_uuid text, -- ID do usuário local (se houver)
  user_nome text,
  before_json jsonb,
  after_json jsonb,
  description text,
  created_at timestamptz not null default now()
);

-- Indexes para melhor consulta
create index if not exists idx_audits_online_uuid on audits_online(uuid);
create index if not exists idx_audits_online_entity on audits_online(entity);
create index if not exists idx_audits_online_entity_id on audits_online(entity_id);
create index if not exists idx_audits_online_user_uuid on audits_online(user_uuid);
create index if not exists idx_audits_online_timestamp on audits_online(timestamp desc);

-- Habilitar RLS
alter table audits_online enable row level security;

-- Policies: permitir apenas acesso autenticado
create policy "audits_online_select_authenticated" on audits_online
  for select
  using (auth.role() = 'authenticated');

create policy "audits_online_insert_authenticated" on audits_online
  for insert
  with check (auth.role() = 'authenticated');

-- Não expomos update/delete de auditoria por padrão (histórico imutável)


