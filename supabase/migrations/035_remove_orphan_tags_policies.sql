-- ============================================
-- Migration: Remover Policies Órfãs de Tags
-- Descrição: Remove policies de tags/tag_assignments já que RLS foi desabilitado
-- Versão: 0.3.0
-- Data: 2026-01-20
-- ============================================

-- ============================================
-- REMOVER POLÍTICAS ÓRFÃS DA TABELA: tags
-- ============================================

DROP POLICY IF EXISTS "tags_select_public" ON public.tags;
DROP POLICY IF EXISTS "tags_insert_public" ON public.tags;
DROP POLICY IF EXISTS "tags_update_public" ON public.tags;

-- ============================================
-- REMOVER POLÍTICAS ÓRFÃS DA TABELA: tag_assignments
-- ============================================

DROP POLICY IF EXISTS "tag_assignments_select_public" ON public.tag_assignments;
DROP POLICY IF EXISTS "tag_assignments_insert_public" ON public.tag_assignments;
DROP POLICY IF EXISTS "tag_assignments_update_public" ON public.tag_assignments;

-- ============================================
-- CONFIRMAR QUE RLS ESTÁ DESABILITADO
-- ============================================

-- Garantir que RLS está desabilitado (já foi feito na migration 034, mas confirmando)
ALTER TABLE public.tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_assignments DISABLE ROW LEVEL SECURITY;

-- ============================================
-- FIM DA MIGRATION
-- ============================================
