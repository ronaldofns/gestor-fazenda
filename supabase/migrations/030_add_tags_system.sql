-- ============================================
-- Migration: Sistema de Tags
-- Descrição: Cria tabelas para tags customizáveis e atribuições
-- Versão: 0.3.0
-- Data: 2026-01-20
-- ============================================

-- 1. Tabela de Tags
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  description TEXT,
  category TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  usage_count INTEGER NOT NULL DEFAULT 0,
  
  -- Constraints
  CONSTRAINT tags_name_not_empty CHECK (TRIM(name) <> ''),
  CONSTRAINT tags_color_format CHECK (color ~ '^#[0-9a-fA-F]{6}$')
);

-- 2. Tabela de Atribuições de Tags
CREATE TABLE IF NOT EXISTS public.tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('nascimento', 'matriz', 'fazenda')),
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraint única: uma tag só pode ser atribuída uma vez a cada entidade
  CONSTRAINT unique_tag_assignment UNIQUE (entity_id, entity_type, tag_id, deleted_at)
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_tags_created_by ON public.tags(created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tags_category ON public.tags(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON public.tags(usage_count DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tag_assignments_entity ON public.tag_assignments(entity_id, entity_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tag_assignments_tag ON public.tag_assignments(tag_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tag_assignments_entity_type ON public.tag_assignments(entity_type) WHERE deleted_at IS NULL;

-- 4. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW
  EXECUTE FUNCTION update_tags_updated_at();

CREATE TRIGGER trigger_tag_assignments_updated_at
  BEFORE UPDATE ON public.tag_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_tags_updated_at();

-- 5. Função para atualizar contador de uso
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    -- Incrementar ao criar atribuição
    UPDATE public.tags 
    SET usage_count = usage_count + 1 
    WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    -- Decrementar ao marcar como deletado
    UPDATE public.tags 
    SET usage_count = GREATEST(usage_count - 1, 0) 
    WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrementar ao deletar fisicamente
    UPDATE public.tags 
    SET usage_count = GREATEST(usage_count - 1, 0) 
    WHERE id = OLD.tag_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tag_usage_count
  AFTER INSERT OR UPDATE OR DELETE ON public.tag_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_tag_usage_count();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Ativar RLS
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS PARA: tags
-- ============================================

-- SELECT: Usuários podem ver suas próprias tags (não deletadas)
CREATE POLICY "users_select_own_tags" ON public.tags
  FOR SELECT
  USING (
    created_by = auth.uid() 
    AND deleted_at IS NULL
  );

-- INSERT: Usuários podem criar suas próprias tags
CREATE POLICY "users_insert_own_tags" ON public.tags
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
  );

-- UPDATE: Usuários podem atualizar suas próprias tags (não deletadas)
CREATE POLICY "users_update_own_tags" ON public.tags
  FOR UPDATE
  USING (
    created_by = auth.uid() 
    AND deleted_at IS NULL
  )
  WITH CHECK (
    created_by = auth.uid()
  );

-- DELETE: Usuários podem deletar suas próprias tags (soft delete via updated_at)
CREATE POLICY "users_delete_own_tags" ON public.tags
  FOR UPDATE
  USING (
    created_by = auth.uid()
  )
  WITH CHECK (
    created_by = auth.uid() 
    AND deleted_at IS NOT NULL
  );

-- ============================================
-- POLÍTICAS PARA: tag_assignments
-- ============================================

-- SELECT: Usuários podem ver atribuições das suas próprias tags
CREATE POLICY "users_select_own_tag_assignments" ON public.tag_assignments
  FOR SELECT
  USING (
    assigned_by = auth.uid() 
    AND deleted_at IS NULL
  );

-- INSERT: Usuários podem criar atribuições com suas próprias tags
CREATE POLICY "users_insert_own_tag_assignments" ON public.tag_assignments
  FOR INSERT
  WITH CHECK (
    assigned_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tags 
      WHERE tags.id = tag_id 
        AND tags.created_by = auth.uid() 
        AND tags.deleted_at IS NULL
    )
  );

-- UPDATE: Usuários podem atualizar suas próprias atribuições
CREATE POLICY "users_update_own_tag_assignments" ON public.tag_assignments
  FOR UPDATE
  USING (
    assigned_by = auth.uid() 
    AND deleted_at IS NULL
  )
  WITH CHECK (
    assigned_by = auth.uid()
  );

-- DELETE: Usuários podem deletar suas próprias atribuições (soft delete)
CREATE POLICY "users_delete_own_tag_assignments" ON public.tag_assignments
  FOR UPDATE
  USING (
    assigned_by = auth.uid()
  )
  WITH CHECK (
    assigned_by = auth.uid() 
    AND deleted_at IS NOT NULL
  );

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE public.tags IS 'Tags customizáveis para categorização de nascimentos, matrizes e fazendas';
COMMENT ON TABLE public.tag_assignments IS 'Atribuições de tags a entidades (nascimentos, matrizes, fazendas)';

COMMENT ON COLUMN public.tags.name IS 'Nome da tag (ex: Leite, Para Venda, Lote A)';
COMMENT ON COLUMN public.tags.color IS 'Cor em hexadecimal (ex: #10b981)';
COMMENT ON COLUMN public.tags.category IS 'Categoria da tag (ex: Status, Tipo, Prioridade)';
COMMENT ON COLUMN public.tags.usage_count IS 'Contador de quantas vezes a tag foi atribuída (atualizado automaticamente)';

COMMENT ON COLUMN public.tag_assignments.entity_id IS 'UUID da entidade (nascimento_id, matriz_id ou fazenda_id)';
COMMENT ON COLUMN public.tag_assignments.entity_type IS 'Tipo da entidade: nascimento, matriz ou fazenda';
COMMENT ON COLUMN public.tag_assignments.tag_id IS 'Referência à tag atribuída';

-- ============================================
-- FIM DA MIGRATION
-- ============================================
