-- ============================================
-- Migration: Habilitar RLS em Tags com Policies Públicas
-- Descrição: Habilita RLS e cria policies públicas permissivas (igual outras tabelas)
-- Versão: 0.3.0
-- Data: 2026-01-20
-- ============================================

-- ============================================
-- HABILITAR RLS NAS TABELAS
-- ============================================

-- Habilitar RLS em tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS em tag_assignments
ALTER TABLE public.tag_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CRIAR POLÍTICAS PÚBLICAS PARA: tags
-- ============================================

-- SELECT: Todos podem ver (filtrar deletadas no app)
CREATE POLICY "tags_select_public" ON public.tags
  FOR SELECT
  USING (true);

-- INSERT: Qualquer um pode inserir (controle no app)
CREATE POLICY "tags_insert_public" ON public.tags
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: Qualquer um pode atualizar (controle no app)
CREATE POLICY "tags_update_public" ON public.tags
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- DELETE: Não usar (soft delete via UPDATE)
-- Não criar policy de DELETE para forçar uso de soft delete

-- ============================================
-- CRIAR POLÍTICAS PÚBLICAS PARA: tag_assignments
-- ============================================

-- SELECT: Todos podem ver (filtrar deletadas no app)
CREATE POLICY "tag_assignments_select_public" ON public.tag_assignments
  FOR SELECT
  USING (true);

-- INSERT: Qualquer um pode inserir (controle no app)
CREATE POLICY "tag_assignments_insert_public" ON public.tag_assignments
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: Qualquer um pode atualizar (controle no app)
CREATE POLICY "tag_assignments_update_public" ON public.tag_assignments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- DELETE: Não usar (soft delete via UPDATE)
-- Não criar policy de DELETE para forçar uso de soft delete

-- ============================================
-- FIM DA MIGRATION
-- ============================================
