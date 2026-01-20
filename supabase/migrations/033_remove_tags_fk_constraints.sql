-- ============================================
-- Migration: Remover Foreign Key Constraints de Tags
-- Descrição: Remove constraints que referenciam auth.users (não usado no sistema)
-- Versão: 0.3.0
-- Data: 2026-01-20
-- ============================================

-- Remover FK de created_by na tabela tags
ALTER TABLE public.tags 
  DROP CONSTRAINT IF EXISTS tags_created_by_fkey;

-- Remover FK de assigned_by na tabela tag_assignments
ALTER TABLE public.tag_assignments 
  DROP CONSTRAINT IF EXISTS tag_assignments_assigned_by_fkey;

-- Comentários atualizados
COMMENT ON COLUMN public.tags.created_by IS 'UUID do usuário que criou a tag (local, não vinculado a auth.users)';
COMMENT ON COLUMN public.tag_assignments.assigned_by IS 'UUID do usuário que atribuiu a tag (local, não vinculado a auth.users)';

-- ============================================
-- FIM DA MIGRATION
-- ============================================
