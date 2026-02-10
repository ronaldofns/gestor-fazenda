-- 054_fix_confinamento_tables_rls_public.sql
-- Permitir acesso às tabelas de confinamento para sincronização (anon/key local)
-- As políticas atuais usam TO authenticated; o app usa anon key, então INSERT falha com RLS.
-- Alinhado ao padrão das outras tabelas de sync (audits_online, fazendas_online, etc.)

-- ========== confinamentos_online ==========
DROP POLICY IF EXISTS "Usuários autenticados podem ler confinamentos" ON public.confinamentos_online;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir confinamentos" ON public.confinamentos_online;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar confinamentos" ON public.confinamentos_online;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar confinamentos" ON public.confinamentos_online;

CREATE POLICY "confinamentos_online_select_public" ON public.confinamentos_online
  FOR SELECT USING (true);

CREATE POLICY "confinamentos_online_insert_public" ON public.confinamentos_online
  FOR INSERT WITH CHECK (true);

CREATE POLICY "confinamentos_online_update_public" ON public.confinamentos_online
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "confinamentos_online_delete_public" ON public.confinamentos_online
  FOR DELETE USING (true);

-- ========== confinamento_animais_online ==========
DROP POLICY IF EXISTS "Usuários autenticados podem ler confinamento_animais" ON public.confinamento_animais_online;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir confinamento_animais" ON public.confinamento_animais_online;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar confinamento_animais" ON public.confinamento_animais_online;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar confinamento_animais" ON public.confinamento_animais_online;

CREATE POLICY "confinamento_animais_online_select_public" ON public.confinamento_animais_online
  FOR SELECT USING (true);

CREATE POLICY "confinamento_animais_online_insert_public" ON public.confinamento_animais_online
  FOR INSERT WITH CHECK (true);

CREATE POLICY "confinamento_animais_online_update_public" ON public.confinamento_animais_online
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "confinamento_animais_online_delete_public" ON public.confinamento_animais_online
  FOR DELETE USING (true);

-- ========== confinamento_pesagens_online ==========
DROP POLICY IF EXISTS "Usuários autenticados podem ler confinamento_pesagens" ON public.confinamento_pesagens_online;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir confinamento_pesagens" ON public.confinamento_pesagens_online;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar confinamento_pesagens" ON public.confinamento_pesagens_online;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar confinamento_pesagens" ON public.confinamento_pesagens_online;

CREATE POLICY "confinamento_pesagens_online_select_public" ON public.confinamento_pesagens_online
  FOR SELECT USING (true);

CREATE POLICY "confinamento_pesagens_online_insert_public" ON public.confinamento_pesagens_online
  FOR INSERT WITH CHECK (true);

CREATE POLICY "confinamento_pesagens_online_update_public" ON public.confinamento_pesagens_online
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "confinamento_pesagens_online_delete_public" ON public.confinamento_pesagens_online
  FOR DELETE USING (true);

-- ========== confinamento_alimentacao_online ==========
DROP POLICY IF EXISTS "Usuários autenticados podem ler confinamento_alimentacao" ON public.confinamento_alimentacao_online;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir confinamento_alimentacao" ON public.confinamento_alimentacao_online;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar confinamento_alimentacao" ON public.confinamento_alimentacao_online;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar confinamento_alimentacao" ON public.confinamento_alimentacao_online;

CREATE POLICY "confinamento_alimentacao_online_select_public" ON public.confinamento_alimentacao_online
  FOR SELECT USING (true);

CREATE POLICY "confinamento_alimentacao_online_insert_public" ON public.confinamento_alimentacao_online
  FOR INSERT WITH CHECK (true);

CREATE POLICY "confinamento_alimentacao_online_update_public" ON public.confinamento_alimentacao_online
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "confinamento_alimentacao_online_delete_public" ON public.confinamento_alimentacao_online
  FOR DELETE USING (true);

COMMENT ON POLICY "confinamentos_online_select_public" ON public.confinamentos_online IS 'Sincronização: leitura permitida (auth local)';
COMMENT ON POLICY "confinamentos_online_insert_public" ON public.confinamentos_online IS 'Sincronização: inserção permitida (auth local)';
