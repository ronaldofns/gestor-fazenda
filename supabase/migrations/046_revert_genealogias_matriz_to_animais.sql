-- 046_revert_genealogias_matriz_to_animais.sql
-- Reverter FK de matriz_id em genealogias_online para referenciar animais_online(uuid).
-- O app usa apenas animais como mãe (não matrizes_online), então matriz_id deve apontar para animais_online.

-- Remover constraint que aponta para matrizes_online (adicionada em 040)
ALTER TABLE public.genealogias_online
DROP CONSTRAINT IF EXISTS genealogias_online_matriz_id_fkey;

-- Adicionar constraint referenciando animais_online(uuid)
ALTER TABLE public.genealogias_online
ADD CONSTRAINT genealogias_online_matriz_id_fkey
FOREIGN KEY (matriz_id)
REFERENCES public.animais_online(uuid);

COMMENT ON CONSTRAINT genealogias_online_matriz_id_fkey ON public.genealogias_online
IS 'Referência para a mãe (animal) na tabela animais_online';
