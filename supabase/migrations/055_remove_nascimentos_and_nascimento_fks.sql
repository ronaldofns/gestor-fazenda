-- ========================================
-- Remover tabela nascimentos_online e vínculos nascimento_id/nascimento_uuid
-- Antes: garantir que animal_id está preenchido onde havia nascimento_id/nascimento_uuid
-- (pesagens já teve migration 052; desmamas e vacinacoes também em 052, mas repetimos por segurança)
-- ========================================

-- 1) desmamas_online: preencher animal_id a partir de nascimento_uuid onde ainda for NULL
UPDATE public.desmamas_online
SET animal_id = nascimento_uuid::uuid
WHERE animal_id IS NULL
  AND nascimento_uuid IS NOT NULL
  AND nascimento_uuid ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- 2) vacinacoes_online: preencher animal_id a partir de nascimento_id onde ainda for NULL
UPDATE public.vacinacoes_online
SET animal_id = nascimento_id::uuid
WHERE animal_id IS NULL
  AND nascimento_id IS NOT NULL
  AND nascimento_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- 3) pesagens_online: já migrado em 052; opcionalmente preencher qualquer resto
UPDATE public.pesagens_online
SET animal_id = nascimento_id::uuid
WHERE animal_id IS NULL
  AND nascimento_id IS NOT NULL
  AND nascimento_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- 4) Remover FK desmamas_online -> nascimentos_online
ALTER TABLE public.desmamas_online
DROP CONSTRAINT IF EXISTS fk_desmamas_nascimento;

-- 5) Remover coluna nascimento_uuid de desmamas_online
ALTER TABLE public.desmamas_online
DROP COLUMN IF EXISTS nascimento_uuid;

-- 6) pesagens_online: remover constraint e índices de nascimento_id, depois coluna
ALTER TABLE public.pesagens_online
DROP CONSTRAINT IF EXISTS pesagens_online_nascimento_id_data_pesagem_key;

DROP INDEX IF EXISTS public.idx_pesagens_online_nascimento_id;
DROP INDEX IF EXISTS public.idx_pesagens_online_nascimento_data;

ALTER TABLE public.pesagens_online
DROP COLUMN IF EXISTS nascimento_id;

-- Unique por animal + data (substitui o que era por nascimento)
ALTER TABLE public.pesagens_online
ADD CONSTRAINT pesagens_online_animal_id_data_pesagem_key
UNIQUE (animal_id, data_pesagem);

-- 7) vacinacoes_online: remover constraint e índices de nascimento_id, depois coluna
ALTER TABLE public.vacinacoes_online
DROP CONSTRAINT IF EXISTS vacinacoes_online_nascimento_id_data_aplicacao_key;

DROP INDEX IF EXISTS public.idx_vacinacoes_online_nascimento_id;
DROP INDEX IF EXISTS public.idx_vacinacoes_online_nascimento_data;

ALTER TABLE public.vacinacoes_online
DROP COLUMN IF EXISTS nascimento_id;

ALTER TABLE public.vacinacoes_online
ADD CONSTRAINT vacinacoes_online_animal_id_data_aplicacao_key
UNIQUE (animal_id, data_aplicacao);

-- 8) Remover tabela nascimentos_online (e FKs que ela referencia: fazenda, matriz)
DROP TABLE IF EXISTS public.nascimentos_online CASCADE;

-- Comentários
COMMENT ON COLUMN public.desmamas_online.animal_id IS 'Referência ao animal (animais_online.uuid)';
COMMENT ON COLUMN public.pesagens_online.animal_id IS 'Referência ao animal (animais_online.uuid)';
COMMENT ON COLUMN public.vacinacoes_online.animal_id IS 'Referência ao animal (animais_online.uuid)';
