-- 018_add_categoria_to_audits_and_fix_rls.sql
-- Adicionar 'categoria' na lista de entidades permitidas em audits_online
-- Corrigir políticas RLS para garantir sincronização

-- Primeiro, remover a constraint antiga
ALTER TABLE audits_online DROP CONSTRAINT IF EXISTS audits_online_entity_check;

-- Recriar constraint com 'categoria' incluída
ALTER TABLE audits_online 
  ADD CONSTRAINT audits_online_entity_check 
  CHECK (entity IN ('fazenda','raca','nascimento','desmama','matriz','usuario','categoria'));

-- Remover políticas antigas para garantir que não há conflitos
DROP POLICY IF EXISTS "audits_online_select_authenticated" ON audits_online;
DROP POLICY IF EXISTS "audits_online_insert_authenticated" ON audits_online;
DROP POLICY IF EXISTS "audits_online_select_public" ON audits_online;
DROP POLICY IF EXISTS "audits_online_insert_public" ON audits_online;

-- Criar políticas públicas para sincronização (autenticação local)
CREATE POLICY "audits_online_select_public" ON audits_online
  FOR SELECT
  USING (true);

CREATE POLICY "audits_online_insert_public" ON audits_online
  FOR INSERT
  WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE audits_online IS 'Tabela de auditoria para sincronização com IndexedDB. Registra todas as alterações (create, update, delete) em entidades do sistema.';
COMMENT ON COLUMN audits_online.entity IS 'Tipo de entidade: fazenda, raca, categoria, nascimento, desmama, matriz, usuario';
COMMENT ON COLUMN audits_online.entity_id IS 'UUID local da entidade no IndexedDB';
COMMENT ON COLUMN audits_online.before_json IS 'Snapshot JSON do estado anterior (para update/delete)';
COMMENT ON COLUMN audits_online.after_json IS 'Snapshot JSON do estado atual (para create/update)';

