-- 040_fix_genealogias_matriz_id_fk.sql
-- Corrigir foreign key de matriz_id em genealogias_online para referenciar matrizes_online

-- Remover constraint antiga se existir
ALTER TABLE public.genealogias_online
DROP CONSTRAINT IF EXISTS genealogias_online_matriz_id_fkey;

-- Adicionar nova constraint referenciando matrizes_online
ALTER TABLE public.genealogias_online
ADD CONSTRAINT genealogias_online_matriz_id_fkey 
FOREIGN KEY (matriz_id) 
REFERENCES public.matrizes_online(uuid);

-- Comentário para documentação
COMMENT ON CONSTRAINT genealogias_online_matriz_id_fkey ON public.genealogias_online 
IS 'Referência para a matriz/mãe na tabela matrizes_online';
