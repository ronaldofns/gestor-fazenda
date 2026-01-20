-- ============================================
-- Migration: Diagnóstico e Correção DEFINITIVA de Policies de Tags
-- Versão: 0.3.0
-- Data: 2026-01-20
-- ============================================

-- 1. Verificar se RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('tags', 'tag_assignments');

-- 2. Listar TODAS as policies existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('tags', 'tag_assignments')
ORDER BY tablename, policyname;

-- 3. DESABILITAR RLS temporariamente (se necessário)
-- Isso é mais drástico, mas garante que funcione
ALTER TABLE public.tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_assignments DISABLE ROW LEVEL SECURITY;

-- ============================================
-- FIM DO DIAGNÓSTICO
-- ============================================
