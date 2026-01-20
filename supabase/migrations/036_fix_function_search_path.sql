-- ============================================
-- Migration: Corrigir search_path das Funções
-- Descrição: Adiciona SECURITY DEFINER e search_path vazio nas funções de trigger
-- Versão: 0.3.0
-- Data: 2026-01-20
-- ============================================

-- ============================================
-- RECRIAR FUNÇÃO: update_alert_settings_online_updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_alert_settings_online_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- RECRIAR FUNÇÃO: update_app_settings_online_updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_app_settings_online_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- RECRIAR FUNÇÃO: update_pesagens_online_updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_pesagens_online_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- RECRIAR FUNÇÃO: update_vacinacoes_online_updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_vacinacoes_online_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- RECRIAR FUNÇÃO: update_tags_updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_tags_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- RECRIAR FUNÇÃO: update_tag_usage_count
-- ============================================

CREATE OR REPLACE FUNCTION public.update_tag_usage_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Incrementar contador quando uma nova atribuição é criada
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.tags 
    SET usage_count = usage_count + 1 
    WHERE id = NEW.tag_id;
    RETURN NEW;
  END IF;
  
  -- Decrementar contador quando uma atribuição é deletada (soft delete)
  IF (TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
    UPDATE public.tags 
    SET usage_count = GREATEST(usage_count - 1, 0)
    WHERE id = OLD.tag_id;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- RECRIAR FUNÇÃO: create_default_user_settings
-- ============================================

CREATE OR REPLACE FUNCTION public.create_default_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- RECRIAR FUNÇÃO: update_role_permissions_online_updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_role_permissions_online_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- FIM DA MIGRATION
-- ============================================
