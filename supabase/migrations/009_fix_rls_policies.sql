-- 009_fix_rls_policies.sql
-- Ajustar políticas RLS para permitir acesso via anon key (sem autenticação)
-- Como estamos usando autenticação local, precisamos permitir acesso público às tabelas de sincronização

-- Remover políticas antigas que exigem autenticação
drop policy if exists "usuarios_online_select_authenticated" on usuarios_online;
drop policy if exists "usuarios_online_insert_authenticated" on usuarios_online;
drop policy if exists "usuarios_online_update_authenticated" on usuarios_online;
drop policy if exists "usuarios_online_delete_authenticated" on usuarios_online;

-- Criar novas políticas que permitem acesso público (via anon key)
-- Isso permite que a aplicação sincronize dados sem precisar de autenticação do Supabase Auth
create policy "usuarios_online_select_public" on usuarios_online
  for select
  using (true);

create policy "usuarios_online_insert_public" on usuarios_online
  for insert
  with check (true);

create policy "usuarios_online_update_public" on usuarios_online
  for update
  using (true)
  with check (true);

create policy "usuarios_online_delete_public" on usuarios_online
  for delete
  using (true);

-- Comentário explicativo
comment on policy "usuarios_online_select_public" on usuarios_online is 'Permite leitura pública para sincronização (autenticação local)';
comment on policy "usuarios_online_insert_public" on usuarios_online is 'Permite inserção pública para sincronização (autenticação local)';
comment on policy "usuarios_online_update_public" on usuarios_online is 'Permite atualização pública para sincronização (autenticação local)';
comment on policy "usuarios_online_delete_public" on usuarios_online is 'Permite exclusão pública para sincronização (autenticação local)';

