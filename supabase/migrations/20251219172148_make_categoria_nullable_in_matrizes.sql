-- 017_make_categoria_nullable_in_matrizes.sql
-- Tornar a coluna categoria opcional (nullable) na tabela matrizes_online
-- Agora estamos usando categoria_uuid como fonte de verdade

-- Recriar a coluna categoria sem o check constraint e sem NOT NULL
-- Isso permite valores NULL
ALTER TABLE matrizes_online 
ALTER COLUMN categoria TYPE text;

-- Remover a constraint NOT NULL (se ainda existir)
ALTER TABLE matrizes_online 
ALTER COLUMN categoria DROP NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN matrizes_online.categoria IS 'Categoria legada (novilha/vaca). Mantida para compatibilidade, mas categoria_uuid é a fonte de verdade.';

