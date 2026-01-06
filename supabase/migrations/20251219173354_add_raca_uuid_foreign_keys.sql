-- 019_add_raca_uuid_foreign_keys.sql
-- Adicionar colunas raca_uuid e foreign keys para racas_online
-- Similar ao que foi feito com categorias

-- ============================================
-- NASCIMENTOS_ONLINE
-- ============================================

-- Adicionar coluna raca_uuid
ALTER TABLE nascimentos_online 
ADD COLUMN IF NOT EXISTS raca_uuid TEXT;

-- Criar índice para raca_uuid
CREATE INDEX IF NOT EXISTS idx_nascimentos_online_raca_uuid ON nascimentos_online(raca_uuid);

-- Migrar dados existentes: buscar UUID da raça baseado no nome
UPDATE nascimentos_online n
SET raca_uuid = (
  SELECT r.uuid 
  FROM racas_online r 
  WHERE r.nome = n.raca 
  LIMIT 1
)
WHERE n.raca IS NOT NULL 
  AND n.raca_uuid IS NULL;

-- ============================================
-- MATRIZES_ONLINE
-- ============================================

-- Adicionar coluna raca_uuid
ALTER TABLE matrizes_online 
ADD COLUMN IF NOT EXISTS raca_uuid TEXT;

-- Criar índice para raca_uuid
CREATE INDEX IF NOT EXISTS idx_matrizes_online_raca_uuid ON matrizes_online(raca_uuid);

-- Migrar dados existentes: buscar UUID da raça baseado no nome
UPDATE matrizes_online m
SET raca_uuid = (
  SELECT r.uuid 
  FROM racas_online r 
  WHERE r.nome = m.raca 
  LIMIT 1
)
WHERE m.raca IS NOT NULL 
  AND m.raca_uuid IS NULL;

-- ============================================
-- FOREIGN KEYS
-- ============================================

-- Foreign key: nascimentos_online.raca_uuid → racas_online.uuid
-- SET NULL: se raça for deletada, nascimentos ficam sem raça (mas não são deletados)
ALTER TABLE nascimentos_online
ADD CONSTRAINT fk_nascimentos_raca
FOREIGN KEY (raca_uuid)
REFERENCES racas_online(uuid)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Foreign key: matrizes_online.raca_uuid → racas_online.uuid
-- SET NULL: se raça for deletada, matrizes ficam sem raça (mas não são deletadas)
ALTER TABLE matrizes_online
ADD CONSTRAINT fk_matrizes_raca
FOREIGN KEY (raca_uuid)
REFERENCES racas_online(uuid)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- ============================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================

COMMENT ON COLUMN nascimentos_online.raca IS 'Raça legada (texto). Mantida para compatibilidade, mas raca_uuid é a fonte de verdade.';
COMMENT ON COLUMN nascimentos_online.raca_uuid IS 'UUID da raça em racas_online. Fonte de verdade para relacionamento.';

COMMENT ON COLUMN matrizes_online.raca IS 'Raça legada (texto). Mantida para compatibilidade, mas raca_uuid é a fonte de verdade.';
COMMENT ON COLUMN matrizes_online.raca_uuid IS 'UUID da raça em racas_online. Fonte de verdade para relacionamento.';

COMMENT ON CONSTRAINT fk_nascimentos_raca ON nascimentos_online IS 
'Garante que raca_uuid referencia uma raça válida (se informada). Se raça for deletada, nascimento fica sem raça.';

COMMENT ON CONSTRAINT fk_matrizes_raca ON matrizes_online IS 
'Garante que raca_uuid referencia uma raça válida (se informada). Se raça for deletada, matriz fica sem raça.';

