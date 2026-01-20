-- ============================================
-- Migration: Corrigir Policies de Tags
-- Descrição: Alterar policies para permitir inserção/atualização pública (igual outras tabelas)
-- Versão: 0.3.0
-- Data: 2026-01-20
-- ============================================

-- Remover policies antigas
DROP POLICY IF EXISTS "users_select_own_tags" ON public.tags;
DROP POLICY IF EXISTS "users_insert_own_tags" ON public.tags;
DROP POLICY IF EXISTS "users_update_own_tags" ON public.tags;
DROP POLICY IF EXISTS "users_delete_own_tags" ON public.tags;

DROP POLICY IF EXISTS "users_select_own_tag_assignments" ON public.tag_assignments;
DROP POLICY IF EXISTS "users_insert_own_tag_assignments" ON public.tag_assignments;
DROP POLICY IF EXISTS "users_update_own_tag_assignments" ON public.tag_assignments;
DROP POLICY IF EXISTS "users_delete_own_tag_assignments" ON public.tag_assignments;

-- ============================================
-- NOVAS POLÍTICAS PARA: tags (públicas como outras tabelas)
-- ============================================

-- SELECT: Todos podem ver tags não deletadas
CREATE POLICY "tags_select_public" ON public.tags
  FOR SELECT
  USING (deleted_at IS NULL);

-- INSERT: Qualquer autenticado pode inserir
CREATE POLICY "tags_insert_public" ON public.tags
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: Qualquer autenticado pode atualizar
CREATE POLICY "tags_update_public" ON public.tags
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- DELETE: Não permitir delete físico (apenas soft delete via UPDATE)
-- (Não criamos policy de DELETE, apenas UPDATE para soft delete)

-- ============================================
-- NOVAS POLÍTICAS PARA: tag_assignments (públicas)
-- ============================================

-- SELECT: Todos podem ver atribuições não deletadas
CREATE POLICY "tag_assignments_select_public" ON public.tag_assignments
  FOR SELECT
  USING (deleted_at IS NULL);

-- INSERT: Qualquer autenticado pode inserir
CREATE POLICY "tag_assignments_insert_public" ON public.tag_assignments
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: Qualquer autenticado pode atualizar
CREATE POLICY "tag_assignments_update_public" ON public.tag_assignments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================
-- FIM DA MIGRATION
-- ============================================
