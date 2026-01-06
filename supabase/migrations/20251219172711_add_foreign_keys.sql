-- 018_add_foreign_keys.sql
-- Adicionar foreign keys para estruturar relacionamentos entre tabelas
-- Isso garante integridade referencial e melhora a qualidade dos dados

-- ============================================
-- LIMPEZA DE DADOS INCONSISTENTES (se houver)
-- ============================================

-- Remover matrizes que referenciam fazendas inexistentes (antes de adicionar FK)
-- Isso pode acontecer se houver dados órfãos
DELETE FROM matrizes_online
WHERE fazenda_uuid NOT IN (SELECT uuid FROM fazendas_online);

-- Remover matrizes que referenciam categorias inexistentes (apenas se categoria_uuid não for NULL)
DELETE FROM matrizes_online
WHERE categoria_uuid IS NOT NULL 
  AND categoria_uuid NOT IN (SELECT uuid FROM categorias_online);

-- Remover nascimentos que referenciam fazendas inexistentes
DELETE FROM nascimentos_online
WHERE fazenda_uuid NOT IN (SELECT uuid FROM fazendas_online);

-- Remover nascimentos que referenciam matrizes inexistentes
DELETE FROM nascimentos_online
WHERE matriz_id NOT IN (SELECT uuid FROM matrizes_online);

-- Remover desmamas que referenciam nascimentos inexistentes
DELETE FROM desmamas_online
WHERE nascimento_uuid NOT IN (SELECT uuid FROM nascimentos_online);

-- Limpar referências inválidas em usuarios_online (apenas se fazenda_uuid não for NULL)
UPDATE usuarios_online
SET fazenda_uuid = NULL
WHERE fazenda_uuid IS NOT NULL 
  AND fazenda_uuid NOT IN (SELECT uuid FROM fazendas_online);

-- Limpar referências inválidas em audits_online (apenas se user_uuid não for NULL)
UPDATE audits_online
SET user_uuid = NULL
WHERE user_uuid IS NOT NULL 
  AND user_uuid NOT IN (SELECT uuid FROM usuarios_online);

-- ============================================
-- MATRIZES_ONLINE
-- ============================================

-- Foreign key: matrizes_online.fazenda_uuid → fazendas_online.uuid
-- RESTRICT: não permite deletar fazenda se houver matrizes associadas
ALTER TABLE matrizes_online
ADD CONSTRAINT fk_matrizes_fazenda
FOREIGN KEY (fazenda_uuid)
REFERENCES fazendas_online(uuid)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key: matrizes_online.categoria_uuid → categorias_online.uuid
-- SET NULL: se categoria for deletada, matrizes ficam sem categoria (mas não são deletadas)
ALTER TABLE matrizes_online
ADD CONSTRAINT fk_matrizes_categoria
FOREIGN KEY (categoria_uuid)
REFERENCES categorias_online(uuid)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- ============================================
-- NASCIMENTOS_ONLINE
-- ============================================

-- Foreign key: nascimentos_online.fazenda_uuid → fazendas_online.uuid
-- RESTRICT: não permite deletar fazenda se houver nascimentos associados
ALTER TABLE nascimentos_online
ADD CONSTRAINT fk_nascimentos_fazenda
FOREIGN KEY (fazenda_uuid)
REFERENCES fazendas_online(uuid)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key: nascimentos_online.matriz_id → matrizes_online.uuid
-- RESTRICT: não permite deletar matriz se houver nascimentos associados (preserva histórico)
ALTER TABLE nascimentos_online
ADD CONSTRAINT fk_nascimentos_matriz
FOREIGN KEY (matriz_id)
REFERENCES matrizes_online(uuid)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- ============================================
-- DESMAMAS_ONLINE
-- ============================================

-- Foreign key: desmamas_online.nascimento_uuid → nascimentos_online.uuid
-- CASCADE: se nascimento for deletado, desmamas também são deletadas
ALTER TABLE desmamas_online
ADD CONSTRAINT fk_desmamas_nascimento
FOREIGN KEY (nascimento_uuid)
REFERENCES nascimentos_online(uuid)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- ============================================
-- USUARIOS_ONLINE
-- ============================================

-- Foreign key: usuarios_online.fazenda_uuid → fazendas_online.uuid
-- SET NULL: se fazenda for deletada, usuários ficam sem fazenda (mas não são deletados)
ALTER TABLE usuarios_online
ADD CONSTRAINT fk_usuarios_fazenda
FOREIGN KEY (fazenda_uuid)
REFERENCES fazendas_online(uuid)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- ============================================
-- AUDITS_ONLINE
-- ============================================

-- Foreign key: audits_online.user_uuid → usuarios_online.uuid
-- SET NULL: se usuário for deletado, audits mantêm histórico mas sem referência ao usuário
ALTER TABLE audits_online
ADD CONSTRAINT fk_audits_usuario
FOREIGN KEY (user_uuid)
REFERENCES usuarios_online(uuid)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Nota: audits_online.entity_id não pode ter FK porque referencia diferentes tabelas
-- dependendo do valor de entity (fazenda, raca, nascimento, desmama, matriz, usuario)

-- ============================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================

COMMENT ON CONSTRAINT fk_matrizes_fazenda ON matrizes_online IS 
'Garante que toda matriz pertence a uma fazenda válida. Impede exclusão de fazenda com matrizes.';

COMMENT ON CONSTRAINT fk_matrizes_categoria ON matrizes_online IS 
'Garante que categoria_uuid referencia uma categoria válida. Se categoria for deletada, matriz fica sem categoria.';

COMMENT ON CONSTRAINT fk_nascimentos_fazenda ON nascimentos_online IS 
'Garante que todo nascimento pertence a uma fazenda válida. Impede exclusão de fazenda com nascimentos.';

COMMENT ON CONSTRAINT fk_nascimentos_matriz ON nascimentos_online IS 
'Garante que todo nascimento referencia uma matriz válida. Impede exclusão de matriz com nascimentos (preserva histórico).';

COMMENT ON CONSTRAINT fk_desmamas_nascimento ON desmamas_online IS 
'Garante que toda desmama pertence a um nascimento válido. Se nascimento for deletado, desmama também é deletada.';

COMMENT ON CONSTRAINT fk_usuarios_fazenda ON usuarios_online IS 
'Garante que fazenda_uuid referencia uma fazenda válida (se informada). Se fazenda for deletada, usuário fica sem fazenda.';

COMMENT ON CONSTRAINT fk_audits_usuario ON audits_online IS 
'Garante que user_uuid referencia um usuário válido (se informado). Se usuário for deletado, audit mantém histórico sem referência.';

