-- Adicionar coluna categoria_uuid na tabela matrizes_online
ALTER TABLE matrizes_online 
ADD COLUMN IF NOT EXISTS categoria_uuid TEXT;

-- Criar índice para categoria_uuid
CREATE INDEX IF NOT EXISTS idx_matrizes_online_categoria_uuid ON matrizes_online(categoria_uuid);

-- Migrar dados existentes: converter categoria (string) para categoria_uuid
-- Se categoria = 'novilha', categoria_uuid = 'categoria-novilha'
-- Se categoria = 'vaca', categoria_uuid = 'categoria-vaca'
UPDATE matrizes_online
SET categoria_uuid = CASE
  WHEN categoria = 'novilha' THEN 'categoria-novilha'
  WHEN categoria = 'vaca' THEN 'categoria-vaca'
  ELSE categoria
END
WHERE categoria_uuid IS NULL AND categoria IS NOT NULL;

-- Adicionar foreign key constraint (opcional, pode ser removido se causar problemas)
-- ALTER TABLE matrizes_online
-- ADD CONSTRAINT fk_matrizes_categoria
-- FOREIGN KEY (categoria_uuid) REFERENCES categorias_online(uuid);

