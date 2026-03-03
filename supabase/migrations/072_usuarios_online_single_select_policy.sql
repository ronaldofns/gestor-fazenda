-- ============================================
-- Consolidar políticas de SELECT em usuarios_online (remediar lint multiple_permissive_policies)
-- A tabela tinha duas políticas permissivas para SELECT:
--   - public_read_usuarios_online (USING true)
--   - usuarios_online_select_authenticated (USING auth.uid() IS NOT NULL)
-- Múltiplas políticas permissivas para o mesmo role/action obrigam o Postgres a avaliar todas (OR),
-- o que é subótimo para performance. Uma única política com a condição desejada resolve.
-- Comportamento mantido: leitura permitida para todos (anon + authenticated), necessário para
-- sincronização e para getUsuarioFromSupabaseByEmail no fluxo de login.
-- ============================================

DROP POLICY IF EXISTS "public_read_usuarios_online" ON public.usuarios_online;
DROP POLICY IF EXISTS "usuarios_online_select_authenticated" ON public.usuarios_online;

CREATE POLICY "usuarios_online_select"
  ON public.usuarios_online
  FOR SELECT
  USING (true);

COMMENT ON POLICY "usuarios_online_select" ON public.usuarios_online IS
  'Leitura permitida para anon e authenticated (sincronização e carregamento de usuário por email no login). Política única evita múltiplas permissive policies no mesmo action.';
