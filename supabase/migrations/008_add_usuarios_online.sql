-- 008_add_usuarios_online.sql
-- Criar tabela para sincronização de usuários locais

-- Tabela de usuários online (para sincronização com dados locais)
create table if not exists usuarios_online (
  id bigserial primary key,
  uuid text unique not null, -- UUID local do IndexedDB
  nome text not null,
  email text unique not null,
  senha_hash text not null, -- Hash da senha (SHA256)
  role text check (role in ('admin','gerente','peao','visitante')) default 'peao' not null,
  fazenda_uuid text, -- UUID da fazenda (referência local)
  ativo boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Índices para melhor performance
create index if not exists idx_usuarios_online_uuid on usuarios_online(uuid);
create index if not exists idx_usuarios_online_email on usuarios_online(email);
create index if not exists idx_usuarios_online_fazenda_uuid on usuarios_online(fazenda_uuid);
create index if not exists idx_usuarios_online_role on usuarios_online(role);
create index if not exists idx_usuarios_online_ativo on usuarios_online(ativo);

-- Comentários para documentação
comment on table usuarios_online is 'Tabela para sincronização de usuários locais com o servidor';
comment on column usuarios_online.uuid is 'UUID local do IndexedDB, usado para identificar o registro localmente';
comment on column usuarios_online.email is 'Email único do usuário';
comment on column usuarios_online.senha_hash is 'Hash SHA256 da senha do usuário';
comment on column usuarios_online.role is 'Role/permissão do usuário: admin, gerente, peao ou visitante';
comment on column usuarios_online.fazenda_uuid is 'UUID da fazenda associada (referência local)';
comment on column usuarios_online.ativo is 'Indica se o usuário está ativo ou inativo';

-- Trigger para atualizar updated_at automaticamente
create or replace function update_usuarios_online_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_usuarios_online_updated_at
before update on usuarios_online
for each row
execute function update_usuarios_online_updated_at();

-- Habilitar Row Level Security (RLS)
alter table usuarios_online enable row level security;

-- Política: Permitir leitura para usuários autenticados
create policy "usuarios_online_select_authenticated" on usuarios_online
  for select
  using (auth.role() = 'authenticated');

-- Política: Permitir inserção para usuários autenticados
create policy "usuarios_online_insert_authenticated" on usuarios_online
  for insert
  with check (auth.role() = 'authenticated');

-- Política: Permitir atualização para usuários autenticados
create policy "usuarios_online_update_authenticated" on usuarios_online
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Política: Permitir exclusão para usuários autenticados
create policy "usuarios_online_delete_authenticated" on usuarios_online
  for delete
  using (auth.role() = 'authenticated');

