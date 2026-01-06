-- 016_fix_matrizes_categorias_audits_rls.sql
-- Corrigir políticas RLS para matrizes_online, categorias_online e audits_online
-- Permitir acesso público via anon key (sem autenticação Supabase Auth)
-- Seguindo o mesmo padrão das outras tabelas de sincronização

-- ============================================
-- MATRIZES_ONLINE
-- ============================================
-- Remover políticas antigas que exigem autenticação
drop policy if exists "matrizes_online_select_authenticated" on matrizes_online;
drop policy if exists "matrizes_online_insert_authenticated" on matrizes_online;
drop policy if exists "matrizes_online_update_authenticated" on matrizes_online;
drop policy if exists "matrizes_online_delete_authenticated" on matrizes_online;

-- Criar novas políticas públicas
create policy "matrizes_online_select_public" on matrizes_online
  for select
  using (true);

create policy "matrizes_online_insert_public" on matrizes_online
  for insert
  with check (true);

create policy "matrizes_online_update_public" on matrizes_online
  for update
  using (true)
  with check (true);

create policy "matrizes_online_delete_public" on matrizes_online
  for delete
  using (true);

-- ============================================
-- CATEGORIAS_ONLINE
-- ============================================
-- Remover políticas antigas que exigem autenticação
drop policy if exists "Usuários autenticados podem ler categorias" on categorias_online;
drop policy if exists "Usuários autenticados podem inserir categorias" on categorias_online;
drop policy if exists "Usuários autenticados podem atualizar categorias" on categorias_online;
drop policy if exists "Usuários autenticados podem deletar categorias" on categorias_online;

-- Criar novas políticas públicas
create policy "categorias_online_select_public" on categorias_online
  for select
  using (true);

create policy "categorias_online_insert_public" on categorias_online
  for insert
  with check (true);

create policy "categorias_online_update_public" on categorias_online
  for update
  using (true)
  with check (true);

create policy "categorias_online_delete_public" on categorias_online
  for delete
  using (true);

-- ============================================
-- AUDITS_ONLINE
-- ============================================
-- Remover políticas antigas que exigem autenticação
drop policy if exists "audits_online_select_authenticated" on audits_online;
drop policy if exists "audits_online_insert_authenticated" on audits_online;

-- Criar novas políticas públicas
create policy "audits_online_select_public" on audits_online
  for select
  using (true);

create policy "audits_online_insert_public" on audits_online
  for insert
  with check (true);

-- Nota: audits_online não tem políticas de update/delete por design (histórico imutável)

-- ============================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================
comment on policy "matrizes_online_select_public" on matrizes_online is 'Permite leitura pública para sincronização (autenticação local)';
comment on policy "matrizes_online_insert_public" on matrizes_online is 'Permite inserção pública para sincronização (autenticação local)';
comment on policy "matrizes_online_update_public" on matrizes_online is 'Permite atualização pública para sincronização (autenticação local)';
comment on policy "matrizes_online_delete_public" on matrizes_online is 'Permite exclusão pública para sincronização (autenticação local)';

comment on policy "categorias_online_select_public" on categorias_online is 'Permite leitura pública para sincronização (autenticação local)';
comment on policy "categorias_online_insert_public" on categorias_online is 'Permite inserção pública para sincronização (autenticação local)';
comment on policy "categorias_online_update_public" on categorias_online is 'Permite atualização pública para sincronização (autenticação local)';
comment on policy "categorias_online_delete_public" on categorias_online is 'Permite exclusão pública para sincronização (autenticação local)';

comment on policy "audits_online_select_public" on audits_online is 'Permite leitura pública para sincronização (autenticação local)';
comment on policy "audits_online_insert_public" on audits_online is 'Permite inserção pública para sincronização (autenticação local)';

