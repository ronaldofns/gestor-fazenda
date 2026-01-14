-- 026_fix_vacinacoes_online_rls.sql
-- Corrigir políticas RLS para vacinacoes_online (similar ao fix de audits_online)

-- Remover TODAS as políticas existentes para garantir que não há conflitos
DROP POLICY IF EXISTS "Usuários autenticados podem ler vacinações" ON vacinacoes_online;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir vacinações" ON vacinacoes_online;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar vacinações" ON vacinacoes_online;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar vacinações" ON vacinacoes_online;

-- Recriar políticas públicas para sincronização (autenticação local)
-- Para INSERT, não usar USING, apenas WITH CHECK
CREATE POLICY "vacinacoes_online_select_public" ON vacinacoes_online
  FOR SELECT
  USING (true);

CREATE POLICY "vacinacoes_online_insert_public" ON vacinacoes_online
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "vacinacoes_online_update_public" ON vacinacoes_online
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "vacinacoes_online_delete_public" ON vacinacoes_online
  FOR DELETE
  USING (true);

-- Comentários para documentação
COMMENT ON POLICY "vacinacoes_online_select_public" ON vacinacoes_online IS 'Permite leitura pública para sincronização (autenticação local)';
COMMENT ON POLICY "vacinacoes_online_insert_public" ON vacinacoes_online IS 'Permite inserção pública para sincronização (autenticação local)';
COMMENT ON POLICY "vacinacoes_online_update_public" ON vacinacoes_online IS 'Permite atualização pública para sincronização (autenticação local)';
COMMENT ON POLICY "vacinacoes_online_delete_public" ON vacinacoes_online IS 'Permite exclusão pública para sincronização (autenticação local)';
