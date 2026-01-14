-- 023_add_pesagens_online.sql
-- Criar tabela para sincronização de pesagens periódicas

-- Tabela de pesagens online (para sincronização entre dispositivos)
create table if not exists pesagens_online (
  id bigserial primary key,
  uuid text not null, -- UUID local do IndexedDB
  nascimento_id text not null, -- UUID do nascimento (animal)
  data_pesagem date not null, -- Data da pesagem
  peso numeric(10, 2) not null check (peso > 0), -- Peso em kg
  observacao text, -- Observações sobre a pesagem
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(uuid),
  unique(nascimento_id, data_pesagem) -- Uma pesagem por animal por data
);

-- Índices para melhor performance
create index if not exists idx_pesagens_online_nascimento_id on pesagens_online(nascimento_id);
create index if not exists idx_pesagens_online_data_pesagem on pesagens_online(data_pesagem);
create index if not exists idx_pesagens_online_nascimento_data on pesagens_online(nascimento_id, data_pesagem);

-- Comentários para documentação
comment on table pesagens_online is 'Tabela para sincronização de pesagens periódicas entre dispositivos';
comment on column pesagens_online.uuid is 'UUID local do IndexedDB';
comment on column pesagens_online.nascimento_id is 'UUID do nascimento (animal)';
comment on column pesagens_online.data_pesagem is 'Data da pesagem';
comment on column pesagens_online.peso is 'Peso em kg';
comment on column pesagens_online.observacao is 'Observações sobre a pesagem';

-- Trigger para atualizar updated_at automaticamente
create or replace function update_pesagens_online_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_pesagens_online_updated_at
before update on pesagens_online
for each row
execute function update_pesagens_online_updated_at();

-- RLS (Row Level Security)
alter table pesagens_online enable row level security;

-- Política: Usuários autenticados podem ler todas as pesagens
create policy "Usuários autenticados podem ler pesagens"
on pesagens_online
for select
to authenticated
using (true);

-- Política: Usuários autenticados podem inserir pesagens
create policy "Usuários autenticados podem inserir pesagens"
on pesagens_online
for insert
to authenticated
with check (true);

-- Política: Usuários autenticados podem atualizar pesagens
create policy "Usuários autenticados podem atualizar pesagens"
on pesagens_online
for update
to authenticated
using (true)
with check (true);

-- Política: Usuários autenticados podem deletar pesagens
create policy "Usuários autenticados podem deletar pesagens"
on pesagens_online
for delete
to authenticated
using (true);
