-- 020_add_role_permissions_online.sql
-- Criar tabela para sincronização de permissões por role

-- Tabela de permissões por role online (para sincronização entre dispositivos)
create table if not exists role_permissions_online (
  id bigserial primary key,
  uuid text not null, -- UUID local do IndexedDB
  role text not null check (role in ('admin', 'gerente', 'peao', 'visitante')),
  permission text not null check (permission in (
    'importar_planilha',
    'gerenciar_usuarios',
    'gerenciar_fazendas',
    'gerenciar_matrizes',
    'gerenciar_racas',
    'gerenciar_categorias',
    'cadastrar_nascimento',
    'editar_nascimento',
    'excluir_nascimento',
    'cadastrar_desmama',
    'editar_desmama',
    'excluir_desmama',
    'ver_dashboard',
    'ver_notificacoes',
    'exportar_dados',
    'gerar_relatorios'
  )),
  granted boolean not null default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(uuid),
  unique(role, permission) -- Uma permissão por role (evita duplicatas)
);

-- Índices para melhor performance
create index if not exists idx_role_permissions_online_role on role_permissions_online(role);
create index if not exists idx_role_permissions_online_permission on role_permissions_online(permission);
create index if not exists idx_role_permissions_online_role_permission on role_permissions_online(role, permission);

-- Comentários para documentação
comment on table role_permissions_online is 'Tabela para sincronização de permissões por role entre dispositivos';
comment on column role_permissions_online.uuid is 'UUID local do IndexedDB';
comment on column role_permissions_online.role is 'Role do usuário (admin, gerente, peao, visitante)';
comment on column role_permissions_online.permission is 'Tipo de permissão';
comment on column role_permissions_online.granted is 'Se a permissão está concedida (true) ou revogada (false)';

-- Trigger para atualizar updated_at automaticamente
create or replace function update_role_permissions_online_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_role_permissions_online_updated_at
before update on role_permissions_online
for each row
execute function update_role_permissions_online_updated_at();

-- Políticas RLS (Row Level Security) - permitir acesso público para sincronização local
alter table role_permissions_online enable row level security;

-- Política para SELECT (leitura pública)
drop policy if exists _select_public on role_permissions_online;
create policy _select_public on role_permissions_online
  for select
  using (true);

-- Política para INSERT (inserção pública)
drop policy if exists _insert_public on role_permissions_online;
create policy _insert_public on role_permissions_online
  for insert
  with check (true);

-- Política para UPDATE (atualização pública)
drop policy if exists _update_public on role_permissions_online;
create policy _update_public on role_permissions_online
  for update
  using (true)
  with check (true);

-- Política para DELETE (exclusão pública - raramente usado)
drop policy if exists _delete_public on role_permissions_online;
create policy _delete_public on role_permissions_online
  for delete
  using (true);

