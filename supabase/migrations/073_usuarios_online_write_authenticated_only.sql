-- ============================================
-- usuarios_online: restringir INSERT/UPDATE/DELETE apenas a usuários autenticados
--
-- Histórico: a migração 009 criou políticas "públicas" (WITH CHECK true) com o comentário
-- "sincronização (autenticação local)". A 062 reverteu várias tabelas para (true) quando
-- o projeto usava login local + chave anon. Hoje o app exige sessão Supabase Auth para
-- sync (getSupabaseForSync() retorna null sem sessão), e auth.ts/syncService só escrevem
-- em usuarios_online com o client que envia o JWT. Não há fluxo que use anon para escrever
-- em usuarios_online; permitir anon é risco desnecessário.
--
-- Esta migração remove qualquer política permissiva (true) para write e cria políticas
-- únicas que exigem auth.uid() IS NOT NULL.
-- ============================================

-- Remover todas as políticas de write existentes (nomes ao longo das migrações)
DROP POLICY IF EXISTS "usuarios_online_insert_public" ON public.usuarios_online;
DROP POLICY IF EXISTS "usuarios_online_update_public" ON public.usuarios_online;
DROP POLICY IF EXISTS "usuarios_online_delete_public" ON public.usuarios_online;
DROP POLICY IF EXISTS "usuarios_online_insert_authenticated" ON public.usuarios_online;
DROP POLICY IF EXISTS "usuarios_online_update_authenticated" ON public.usuarios_online;
DROP POLICY IF EXISTS "usuarios_online_delete_authenticated" ON public.usuarios_online;

-- INSERT: apenas usuário autenticado
CREATE POLICY "usuarios_online_insert_authenticated"
  ON public.usuarios_online
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

COMMENT ON POLICY "usuarios_online_insert_authenticated" ON public.usuarios_online IS
  'Inserção apenas com sessão Supabase Auth (sync e cadastro de usuário).';

-- UPDATE: apenas usuário autenticado
CREATE POLICY "usuarios_online_update_authenticated"
  ON public.usuarios_online
  FOR UPDATE
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

COMMENT ON POLICY "usuarios_online_update_authenticated" ON public.usuarios_online IS
  'Atualização apenas com sessão Supabase Auth (sync e edição de usuário).';

-- DELETE: apenas usuário autenticado
CREATE POLICY "usuarios_online_delete_authenticated"
  ON public.usuarios_online
  FOR DELETE
  USING ((SELECT auth.uid()) IS NOT NULL);

COMMENT ON POLICY "usuarios_online_delete_authenticated" ON public.usuarios_online IS
  'Exclusão apenas com sessão Supabase Auth (ex.: deleteUser no app).';
