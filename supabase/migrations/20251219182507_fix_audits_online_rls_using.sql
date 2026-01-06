-- 020_fix_audits_online_rls_using.sql
-- Corrigir políticas RLS para audits_online
-- O erro "new row violates row-level security policy (USING expression)" indica problema na política INSERT

-- Remover TODAS as políticas existentes (incluindo as que podem ter sido criadas incorretamente)
DROP POLICY IF EXISTS "audits_online_select_authenticated" ON audits_online;
DROP POLICY IF EXISTS "audits_online_insert_authenticated" ON audits_online;
DROP POLICY IF EXISTS "audits_online_select_public" ON audits_online;
DROP POLICY IF EXISTS "audits_online_insert_public" ON audits_online;

-- Recriar políticas públicas corretas
-- Para INSERT, não usar USING, apenas WITH CHECK
CREATE POLICY "audits_online_select_public" ON audits_online
  FOR SELECT
  USING (true);

CREATE POLICY "audits_online_insert_public" ON audits_online
  FOR INSERT
  WITH CHECK (true);

-- Comentários para documentação
COMMENT ON POLICY "audits_online_select_public" ON audits_online IS 'Permite leitura pública para sincronização (autenticação local)';
COMMENT ON POLICY "audits_online_insert_public" ON audits_online IS 'Permite inserção pública para sincronização (autenticação local)';

