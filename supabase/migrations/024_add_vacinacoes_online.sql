-- 024_add_vacinacoes_online.sql
-- Criar tabela para sincronização de vacinações

-- Tabela de vacinações online (para sincronização entre dispositivos)
create table if not exists vacinacoes_online (
  id bigserial primary key,
  uuid text not null, -- UUID local do IndexedDB
  nascimento_id text not null, -- UUID do nascimento (animal)
  vacina text not null, -- Nome da vacina
  data_aplicacao date not null, -- Data da aplicação
  data_vencimento date, -- Data de vencimento/revacinação
  lote text, -- Lote da vacina
  responsavel text, -- Responsável pela aplicação
  observacao text, -- Observações sobre a vacinação
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(uuid)
);

-- Índices para melhor performance
create index if not exists idx_vacinacoes_online_nascimento_id on vacinacoes_online(nascimento_id);
create index if not exists idx_vacinacoes_online_data_aplicacao on vacinacoes_online(data_aplicacao);
create index if not exists idx_vacinacoes_online_data_vencimento on vacinacoes_online(data_vencimento);
create index if not exists idx_vacinacoes_online_nascimento_data on vacinacoes_online(nascimento_id, data_aplicacao);

-- Comentários para documentação
comment on table vacinacoes_online is 'Tabela para sincronização de vacinações entre dispositivos';
comment on column vacinacoes_online.uuid is 'UUID local do IndexedDB';
comment on column vacinacoes_online.nascimento_id is 'UUID do nascimento (animal)';
comment on column vacinacoes_online.vacina is 'Nome da vacina';
comment on column vacinacoes_online.data_aplicacao is 'Data da aplicação da vacina';
comment on column vacinacoes_online.data_vencimento is 'Data de vencimento/revacinação';
comment on column vacinacoes_online.lote is 'Lote da vacina';
comment on column vacinacoes_online.responsavel is 'Responsável pela aplicação';
comment on column vacinacoes_online.observacao is 'Observações sobre a vacinação';

-- Trigger para atualizar updated_at automaticamente
create or replace function update_vacinacoes_online_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_vacinacoes_online_updated_at
before update on vacinacoes_online
for each row
execute function update_vacinacoes_online_updated_at();

-- RLS (Row Level Security)
alter table vacinacoes_online enable row level security;

-- Política: Usuários autenticados podem ler todas as vacinações
create policy "Usuários autenticados podem ler vacinações"
on vacinacoes_online
for select
to authenticated
using (true);

-- Política: Usuários autenticados podem inserir vacinações
create policy "Usuários autenticados podem inserir vacinações"
on vacinacoes_online
for insert
to authenticated
with check (true);

-- Política: Usuários autenticados podem atualizar vacinações
create policy "Usuários autenticados podem atualizar vacinações"
on vacinacoes_online
for update
to authenticated
using (true)
with check (true);

-- Política: Usuários autenticados podem deletar vacinações
create policy "Usuários autenticados podem deletar vacinações"
on vacinacoes_online
for delete
to authenticated
using (true);
