-- 010_cleanup_and_security_fixes.sql
-- Limpeza de tabelas não utilizadas e correções de segurança

-- ============================================
-- 1. EXCLUIR TABELAS NÃO UTILIZADAS
-- ============================================

-- Tabelas antigas que foram substituídas pelas versões _online
-- Estas tabelas não são mais usadas pelo sistema

-- Excluir tabela sync_events (não utilizada)
drop table if exists sync_events cascade;

-- Excluir tabela usuarios antiga (não utilizada - substituída por usuarios_online)
-- Nota: Esta tabela referencia auth.users, mas não usamos mais Supabase Auth
drop table if exists usuarios cascade;

-- Excluir tabelas antigas do modelo inicial (substituídas por _online)
drop table if exists desmama cascade;
drop table if exists bezerros cascade;
drop table if exists vacas cascade;
drop table if exists fazendas cascade;

-- ============================================
-- 2. CORRIGIR FUNÇÃO update_usuarios_online_updated_at
-- ============================================

-- Recriar função com search_path fixo para segurança
drop function if exists update_usuarios_online_updated_at() cascade;

create or replace function update_usuarios_online_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Recriar trigger
create trigger trigger_update_usuarios_online_updated_at
before update on usuarios_online
for each row
execute function update_usuarios_online_updated_at();

-- ============================================
-- 3. RESOLVER PROBLEMA DE RLS EM usuarios (se ainda existir)
-- ============================================
-- A tabela usuarios tem RLS habilitado mas sem políticas.
-- Como vamos excluir a tabela, isso resolve o problema.
-- Mas caso a tabela ainda exista e não possa ser excluída imediatamente,
-- vamos desabilitar RLS ou adicionar uma política temporária.

-- Desabilitar RLS na tabela usuarios (se ainda existir)
-- Isso resolve o problema "RLS Enabled No Policy"
alter table if exists usuarios disable row level security;

-- ============================================
-- 4. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================

comment on function update_usuarios_online_updated_at() is 'Atualiza automaticamente o campo updated_at na tabela usuarios_online. Função com search_path fixo para segurança.';

-- ============================================
-- RESUMO DAS TABELAS UTILIZADAS PELO SISTEMA:
-- ============================================
-- Tabelas ATIVAS (mantidas):
--   - fazendas_online (sincronização de fazendas)
--   - nascimentos_online (sincronização de nascimentos)
--   - desmamas_online (sincronização de desmamas)
--   - racas_online (sincronização de raças)
--   - usuarios_online (sincronização de usuários locais)
--
-- Tabelas REMOVIDAS (não utilizadas):
--   - sync_events (não utilizada)
--   - usuarios (substituída por usuarios_online)
--   - desmama (substituída por desmamas_online)
--   - bezerros (substituída por nascimentos_online)
--   - vacas (substituída por nascimentos_online - matriz_id)
--   - fazendas (substituída por fazendas_online)

