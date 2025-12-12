-- 011_fix_all_rls_policies.sql
-- Corrigir políticas RLS para todas as tabelas de sincronização
-- Permitir acesso público via anon key (sem autenticação Supabase Auth)

-- ============================================
-- FAZENDAS_ONLINE
-- ============================================
-- Remover políticas antigas
drop policy if exists "fazendas_online_select" on fazendas_online;
drop policy if exists "fazendas_online_insert" on fazendas_online;
drop policy if exists "fazendas_online_update" on fazendas_online;
drop policy if exists "fazendas_online_delete" on fazendas_online;

-- Criar novas políticas públicas
create policy "fazendas_online_select_public" on fazendas_online
  for select
  using (true);

create policy "fazendas_online_insert_public" on fazendas_online
  for insert
  with check (true);

create policy "fazendas_online_update_public" on fazendas_online
  for update
  using (true)
  with check (true);

create policy "fazendas_online_delete_public" on fazendas_online
  for delete
  using (true);

-- ============================================
-- NASCIMENTOS_ONLINE
-- ============================================
-- Remover políticas antigas
drop policy if exists "nascimentos_online_select" on nascimentos_online;
drop policy if exists "nascimentos_online_insert" on nascimentos_online;
drop policy if exists "nascimentos_online_update" on nascimentos_online;
drop policy if exists "nascimentos_online_delete" on nascimentos_online;

-- Criar novas políticas públicas
create policy "nascimentos_online_select_public" on nascimentos_online
  for select
  using (true);

create policy "nascimentos_online_insert_public" on nascimentos_online
  for insert
  with check (true);

create policy "nascimentos_online_update_public" on nascimentos_online
  for update
  using (true)
  with check (true);

create policy "nascimentos_online_delete_public" on nascimentos_online
  for delete
  using (true);

-- ============================================
-- DESMAMAS_ONLINE
-- ============================================
-- Remover políticas antigas
drop policy if exists "desmamas_online_select" on desmamas_online;
drop policy if exists "desmamas_online_insert" on desmamas_online;
drop policy if exists "desmamas_online_update" on desmamas_online;
drop policy if exists "desmamas_online_delete" on desmamas_online;

-- Criar novas políticas públicas
create policy "desmamas_online_select_public" on desmamas_online
  for select
  using (true);

create policy "desmamas_online_insert_public" on desmamas_online
  for insert
  with check (true);

create policy "desmamas_online_update_public" on desmamas_online
  for update
  using (true)
  with check (true);

create policy "desmamas_online_delete_public" on desmamas_online
  for delete
  using (true);

-- ============================================
-- RACAS_ONLINE
-- ============================================
-- Remover políticas antigas
drop policy if exists "racas_online_select" on racas_online;
drop policy if exists "racas_online_insert" on racas_online;
drop policy if exists "racas_online_update" on racas_online;
drop policy if exists "racas_online_delete" on racas_online;

-- Criar novas políticas públicas
create policy "racas_online_select_public" on racas_online
  for select
  using (true);

create policy "racas_online_insert_public" on racas_online
  for insert
  with check (true);

create policy "racas_online_update_public" on racas_online
  for update
  using (true)
  with check (true);

create policy "racas_online_delete_public" on racas_online
  for delete
  using (true);

-- ============================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================
comment on policy "fazendas_online_select_public" on fazendas_online is 'Permite leitura pública para sincronização (autenticação local)';
comment on policy "nascimentos_online_select_public" on nascimentos_online is 'Permite leitura pública para sincronização (autenticação local)';
comment on policy "desmamas_online_select_public" on desmamas_online is 'Permite leitura pública para sincronização (autenticação local)';
comment on policy "racas_online_select_public" on racas_online is 'Permite leitura pública para sincronização (autenticação local)';

