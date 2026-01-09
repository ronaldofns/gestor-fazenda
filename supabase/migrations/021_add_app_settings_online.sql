-- 021_add_app_settings_online.sql
-- Criar tabela para sincronização de configurações do app

-- Tabela de configurações do app online (para sincronização entre dispositivos)
create table if not exists app_settings_online (
  id bigserial primary key,
  uuid text unique not null, -- UUID local do IndexedDB (sempre 'app-settings-global')
  timeout_inatividade integer not null default 15 check (timeout_inatividade >= 1 and timeout_inatividade <= 120),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Índice único para garantir apenas uma configuração global
create unique index if not exists idx_app_settings_online_uuid on app_settings_online(uuid);

-- Comentários para documentação
comment on table app_settings_online is 'Tabela para sincronização de configurações do app entre dispositivos';
comment on column app_settings_online.uuid is 'UUID local do IndexedDB, sempre "app-settings-global" para configuração global';
comment on column app_settings_online.timeout_inatividade is 'Tempo de inatividade em minutos antes de fazer logout automático (1-120)';

-- Trigger para atualizar updated_at automaticamente
create or replace function update_app_settings_online_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_app_settings_online_updated_at
before update on app_settings_online
for each row
execute function update_app_settings_online_updated_at();

-- Políticas RLS (Row Level Security) - permitir acesso público para sincronização local
alter table app_settings_online enable row level security;

-- Política para SELECT (leitura pública)
drop policy if exists _select_public on app_settings_online;
create policy _select_public on app_settings_online
  for select
  using (true);

-- Política para INSERT (inserção pública)
drop policy if exists _insert_public on app_settings_online;
create policy _insert_public on app_settings_online
  for insert
  with check (true);

-- Política para UPDATE (atualização pública)
drop policy if exists _update_public on app_settings_online;
create policy _update_public on app_settings_online
  for update
  using (true)
  with check (true);

-- Política para DELETE (exclusão pública - raramente usado)
drop policy if exists _delete_public on app_settings_online;
create policy _delete_public on app_settings_online
  for delete
  using (true);
