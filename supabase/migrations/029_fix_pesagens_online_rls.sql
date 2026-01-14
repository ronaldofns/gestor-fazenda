-- 029_fix_pesagens_online_rls.sql
-- Corrigir políticas RLS para pesagens_online (similar ao fix de vacinacoes_online)

-- Remover TODAS as políticas existentes para garantir que não há conflitos
DROP POLICY IF EXISTS "Usuários autenticados podem ler pesagens" ON pesagens_online;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir pesagens" ON pesagens_online;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar pesagens" ON pesagens_online;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar pesagens" ON pesagens_online;

-- Recriar políticas públicas para sincronização (autenticação local)
-- Para INSERT, não usar USING, apenas WITH CHECK
CREATE POLICY "pesagens_online_select_public" ON pesagens_online
  FOR SELECT
  USING (true);

CREATE POLICY "pesagens_online_insert_public" ON pesagens_online
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "pesagens_online_update_public" ON pesagens_online
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "pesagens_online_delete_public" ON pesagens_online
  FOR DELETE
  USING (true);

-- Comentários para documentação
COMMENT ON POLICY "pesagens_online_select_public" ON pesagens_online IS 'Permite leitura pública para sincronização (autenticação local)';
COMMENT ON POLICY "pesagens_online_insert_public" ON pesagens_online IS 'Permite inserção pública para sincronização (autenticação local)';
COMMENT ON POLICY "pesagens_online_update_public" ON pesagens_online IS 'Permite atualização pública para sincronização (autenticação local)';
COMMENT ON POLICY "pesagens_online_delete_public" ON pesagens_online IS 'Permite exclusão pública para sincronização (autenticação local)';
