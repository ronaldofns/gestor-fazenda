-- ============================================
-- Migration: Sincronização de Configurações do App
-- Descrição: Tabela para sincronizar configurações entre dispositivos
-- Versão: 0.3.0
-- Data: 2026-01-20
-- ============================================

-- 1. Tabela de Configurações do Usuário
CREATE TABLE IF NOT EXISTS public.user_app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Configurações de Aparência
  primary_color TEXT NOT NULL DEFAULT 'gray',
  dark_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  timeout_inatividade INTEGER NOT NULL DEFAULT 15, -- minutos
  
  -- Configurações de Sincronização
  intervalo_sincronizacao INTEGER NOT NULL DEFAULT 30, -- segundos
  
  -- Configurações de Alertas
  limite_meses_desmama INTEGER NOT NULL DEFAULT 8,
  janela_meses_mortalidade INTEGER NOT NULL DEFAULT 6,
  limiar_mortalidade NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  
  -- Configurações de Backup Automático
  backup_auto_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  backup_interval_minutes INTEGER NOT NULL DEFAULT 1440, -- 24 horas
  backup_max_history INTEGER NOT NULL DEFAULT 10,
  backup_notify_success BOOLEAN NOT NULL DEFAULT TRUE,
  backup_notify_failure BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Metadados
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_primary_color CHECK (primary_color IN ('green', 'blue', 'emerald', 'teal', 'indigo', 'purple', 'gray')),
  CONSTRAINT valid_timeout CHECK (timeout_inatividade BETWEEN 1 AND 120),
  CONSTRAINT valid_sync_interval CHECK (intervalo_sincronizacao BETWEEN 10 AND 300),
  CONSTRAINT valid_desmama_limit CHECK (limite_meses_desmama BETWEEN 1 AND 36),
  CONSTRAINT valid_mortality_window CHECK (janela_meses_mortalidade BETWEEN 1 AND 24),
  CONSTRAINT valid_mortality_threshold CHECK (limiar_mortalidade BETWEEN 0.1 AND 100.0),
  CONSTRAINT valid_backup_interval CHECK (backup_interval_minutes >= 60),
  CONSTRAINT valid_backup_history CHECK (backup_max_history BETWEEN 5 AND 100)
);

-- 2. Índices
CREATE INDEX IF NOT EXISTS idx_user_app_settings_user_id ON public.user_app_settings(user_id);

-- 3. Trigger para updated_at
CREATE TRIGGER trigger_user_app_settings_updated_at
  BEFORE UPDATE ON public.user_app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_tags_updated_at(); -- Reutiliza função existente

-- 4. Função para criar configurações padrão automaticamente
CREATE OR REPLACE FUNCTION create_default_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_app_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para criar configurações quando usuário é criado
CREATE TRIGGER trigger_create_default_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_user_settings();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

ALTER TABLE public.user_app_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: Usuários podem ver suas próprias configurações
CREATE POLICY "users_select_own_settings" ON public.user_app_settings
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Usuários podem criar suas próprias configurações
CREATE POLICY "users_insert_own_settings" ON public.user_app_settings
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Usuários podem atualizar suas próprias configurações
CREATE POLICY "users_update_own_settings" ON public.user_app_settings
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Usuários podem deletar suas próprias configurações
CREATE POLICY "users_delete_own_settings" ON public.user_app_settings
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- INSERIR CONFIGURAÇÕES PADRÃO PARA USUÁRIOS EXISTENTES
-- ============================================

-- Para usuários que já existem, criar configurações padrão
INSERT INTO public.user_app_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- COMENTÁRIOS
-- ============================================

COMMENT ON TABLE public.user_app_settings IS 'Configurações personalizadas do usuário sincronizadas entre dispositivos';

COMMENT ON COLUMN public.user_app_settings.primary_color IS 'Cor principal do tema (green, blue, emerald, teal, indigo, purple, gray)';
COMMENT ON COLUMN public.user_app_settings.dark_mode_enabled IS 'Se o modo escuro está ativado';
COMMENT ON COLUMN public.user_app_settings.timeout_inatividade IS 'Tempo de inatividade antes de logout automático (minutos)';
COMMENT ON COLUMN public.user_app_settings.intervalo_sincronizacao IS 'Intervalo de sincronização automática (segundos)';
COMMENT ON COLUMN public.user_app_settings.backup_auto_enabled IS 'Se o backup automático está habilitado';
COMMENT ON COLUMN public.user_app_settings.backup_interval_minutes IS 'Intervalo entre backups automáticos (minutos)';

-- ============================================
-- FIM DA MIGRATION
-- ============================================
