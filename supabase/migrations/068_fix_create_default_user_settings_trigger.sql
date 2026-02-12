-- ============================================
-- Fix: trigger AFTER INSERT ON auth.users falhava com RLS
-- O trigger insere em user_app_settings; a política exige user_id = auth.uid().
-- No momento do signUp, auth.uid() é quem criou o usuário (admin), não o novo usuário,
-- então a inserção era bloqueada e retornava "Database error saving new user" (500).
-- Solução: função com SECURITY DEFINER para inserir ignorando RLS no contexto do trigger.
-- ============================================

DROP TRIGGER IF EXISTS trigger_create_default_settings ON auth.users;

CREATE OR REPLACE FUNCTION create_default_user_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_app_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_default_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_user_settings();
