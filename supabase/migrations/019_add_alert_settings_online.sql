-- 019_add_alert_settings_online.sql
-- Criar tabela para sincronização de configurações de alerta

-- Tabela de configurações de alerta online (para sincronização entre dispositivos)
create table if not exists alert_settings_online (
  id bigserial primary key,
  uuid text unique not null, -- UUID local do IndexedDB (sempre 'alert-settings-global')
  limite_meses_desmama integer not null default 8 check (limite_meses_desmama >= 1 and limite_meses_desmama <= 36),
  janela_meses_mortalidade integer not null default 6 check (janela_meses_mortalidade >= 1 and janela_meses_mortalidade <= 24),
  limiar_mortalidade integer not null default 10 check (limiar_mortalidade >= 1 and limiar_mortalidade <= 100),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Índice único para garantir apenas uma configuração global
create unique index if not exists idx_alert_settings_online_uuid on alert_settings_online(uuid);

-- Comentários para documentação
comment on table alert_settings_online is 'Tabela para sincronização de configurações de alerta entre dispositivos';
comment on column alert_settings_online.uuid is 'UUID local do IndexedDB, sempre "alert-settings-global" para configuração global';
comment on column alert_settings_online.limite_meses_desmama is 'Limite de meses sem desmama para gerar alerta (1-36)';
comment on column alert_settings_online.janela_meses_mortalidade is 'Janela de meses para calcular mortalidade (1-24)';
comment on column alert_settings_online.limiar_mortalidade is 'Limiar de mortalidade em percentual para gerar alerta (1-100)';

-- Trigger para atualizar updated_at automaticamente
create or replace function update_alert_settings_online_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_alert_settings_online_updated_at
before update on alert_settings_online
for each row
execute function update_alert_settings_online_updated_at();

-- Políticas RLS (Row Level Security) - permitir acesso público para sincronização local
alter table alert_settings_online enable row level security;

-- Política para SELECT (leitura pública)
drop policy if exists _select_public on alert_settings_online;
create policy _select_public on alert_settings_online
  for select
  using (true);

-- Política para INSERT (inserção pública)
drop policy if exists _insert_public on alert_settings_online;
create policy _insert_public on alert_settings_online
  for insert
  with check (true);

-- Política para UPDATE (atualização pública)
drop policy if exists _update_public on alert_settings_online;
create policy _update_public on alert_settings_online
  for update
  using (true)
  with check (true);

-- Política para DELETE (exclusão pública - raramente usado)
drop policy if exists _delete_public on alert_settings_online;
create policy _delete_public on alert_settings_online
  for delete
  using (true);

