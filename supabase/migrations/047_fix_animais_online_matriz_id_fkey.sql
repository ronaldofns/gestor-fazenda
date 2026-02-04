-- 047_fix_animais_online_matriz_id_fkey.sql
-- Garantir que matriz_id e reprodutor_id em animais_online referenciem animais_online(uuid).
-- O app usa apenas animais como mãe e pai (não matrizes_online).

-- Remover constraints antigas (podem estar apontando para matrizes_online em alguns ambientes)
ALTER TABLE public.animais_online
DROP CONSTRAINT IF EXISTS animais_online_matriz_id_fkey;

ALTER TABLE public.animais_online
DROP CONSTRAINT IF EXISTS animais_online_reprodutor_id_fkey;

-- Recriar referenciando animais_online(uuid)
ALTER TABLE public.animais_online
ADD CONSTRAINT animais_online_matriz_id_fkey
FOREIGN KEY (matriz_id)
REFERENCES public.animais_online(uuid)
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE public.animais_online
ADD CONSTRAINT animais_online_reprodutor_id_fkey
FOREIGN KEY (reprodutor_id)
REFERENCES public.animais_online(uuid)
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT animais_online_matriz_id_fkey ON public.animais_online
IS 'Referência para a mãe (animal) em animais_online';
COMMENT ON CONSTRAINT animais_online_reprodutor_id_fkey ON public.animais_online
IS 'Referência para o pai (animal) em animais_online';
