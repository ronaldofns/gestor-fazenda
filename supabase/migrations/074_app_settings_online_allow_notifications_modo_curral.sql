-- Adicionar colunas usadas pelo app em app_settings (sync envia allow_browser_notifications e modo_curral)
-- Erro no sync: "Could not find the 'allow_browser_notifications' column of 'app_settings_online'"

ALTER TABLE public.app_settings_online
  ADD COLUMN IF NOT EXISTS allow_browser_notifications boolean NOT NULL DEFAULT true;

ALTER TABLE public.app_settings_online
  ADD COLUMN IF NOT EXISTS modo_curral boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.app_settings_online.allow_browser_notifications IS 'Permitir notificações no navegador (PWA)';
COMMENT ON COLUMN public.app_settings_online.modo_curral IS 'Modo Campo/Curral: UI simplificada, fonte maior, alto contraste';
