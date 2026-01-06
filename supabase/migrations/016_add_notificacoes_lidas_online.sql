-- 016_add_notificacoes_lidas_online.sql
-- Criar tabela para sincronização de notificações lidas

-- Tabela de notificações lidas online (para sincronização com dados locais)
create table if not exists notificacoes_lidas_online (
  id bigserial primary key,
  uuid text unique not null, -- Chave única da notificação (ex: "desmama-{id}", "mortalidade-{fazendaId}")
  tipo text check (tipo in ('desmama', 'mortalidade', 'dados', 'matriz')) not null,
  marcada_em timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Índices para melhor performance
create index if not exists idx_notificacoes_lidas_online_uuid on notificacoes_lidas_online(uuid);
create index if not exists idx_notificacoes_lidas_online_tipo on notificacoes_lidas_online(tipo);
create index if not exists idx_notificacoes_lidas_online_marcada_em on notificacoes_lidas_online(marcada_em);

-- Comentários para documentação
comment on table notificacoes_lidas_online is 'Tabela para sincronização de notificações marcadas como lidas entre dispositivos';
comment on column notificacoes_lidas_online.uuid is 'Chave única da notificação (ex: "desmama-{id}", "mortalidade-{fazendaId}")';
comment on column notificacoes_lidas_online.tipo is 'Tipo da notificação: desmama, mortalidade, dados ou matriz';
comment on column notificacoes_lidas_online.marcada_em is 'Data e hora em que a notificação foi marcada como lida';

-- Trigger para atualizar updated_at automaticamente
create or replace function update_notificacoes_lidas_online_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_notificacoes_lidas_online_updated_at
before update on notificacoes_lidas_online
for each row
execute function update_notificacoes_lidas_online_updated_at();

-- Habilitar Row Level Security (RLS)
alter table notificacoes_lidas_online enable row level security;

-- Políticas RLS para permitir acesso público (via anon key) para sincronização
-- Como estamos usando autenticação local, precisamos permitir acesso público

-- Política para SELECT (leitura)
drop policy if exists "notificacoes_lidas_online_select_public" on notificacoes_lidas_online;
create policy "notificacoes_lidas_online_select_public" on notificacoes_lidas_online
  for select
  using (true);

-- Política para INSERT (inserção)
drop policy if exists "notificacoes_lidas_online_insert_public" on notificacoes_lidas_online;
create policy "notificacoes_lidas_online_insert_public" on notificacoes_lidas_online
  for insert
  with check (true);

-- Política para UPDATE (atualização)
drop policy if exists "notificacoes_lidas_online_update_public" on notificacoes_lidas_online;
create policy "notificacoes_lidas_online_update_public" on notificacoes_lidas_online
  for update
  using (true)
  with check (true);

-- Política para DELETE (exclusão)
drop policy if exists "notificacoes_lidas_online_delete_public" on notificacoes_lidas_online;
create policy "notificacoes_lidas_online_delete_public" on notificacoes_lidas_online
  for delete
  using (true);

-- Comentários nas políticas
comment on policy "notificacoes_lidas_online_select_public" on notificacoes_lidas_online is 'Permite leitura pública para sincronização (autenticação local)';
comment on policy "notificacoes_lidas_online_insert_public" on notificacoes_lidas_online is 'Permite inserção pública para sincronização (autenticação local)';
comment on policy "notificacoes_lidas_online_update_public" on notificacoes_lidas_online is 'Permite atualização pública para sincronização (autenticação local)';
comment on policy "notificacoes_lidas_online_delete_public" on notificacoes_lidas_online is 'Permite exclusão pública para sincronização (autenticação local)';

