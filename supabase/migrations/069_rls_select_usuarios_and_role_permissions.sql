-- ============================================
-- Garantir SELECT para usuarios_online e role_permissions_online
-- Qualquer usuário autenticado (auth.uid() IS NOT NULL) pode ler:
-- - usuarios_online: necessário para getUsuarioFromSupabaseByEmail após login (carregar role e dados do usuário)
-- - role_permissions_online: necessário para sync e para usePermissions (hasPermission) de todas as roles
-- Sem SELECT, não-admin recebe 403 porque o app não consegue carregar usuário ou permissões.
-- ============================================

-- usuarios_online: garantir que qualquer autenticado possa ler (para carregar usuário por email após login)
DROP POLICY IF EXISTS "usuarios_online_select_public" ON public.usuarios_online;
DROP POLICY IF EXISTS "usuarios_online_select_authenticated" ON public.usuarios_online;
CREATE POLICY "usuarios_online_select_authenticated" ON public.usuarios_online
  FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

COMMENT ON POLICY "usuarios_online_select_authenticated" ON public.usuarios_online IS 'Permite que qualquer usuário autenticado leia para carregar seu próprio registro (por email) e role após login';

-- role_permissions_online: garantir que qualquer autenticado possa ler (para sync e para hasPermission por role)
DROP POLICY IF EXISTS "_select_public" ON public.role_permissions_online;
CREATE POLICY "_select_public" ON public.role_permissions_online
  FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

COMMENT ON POLICY "_select_public" ON public.role_permissions_online IS 'Permite que qualquer usuário autenticado leia permissões por role (necessário para uso de hasPermission no app)';
