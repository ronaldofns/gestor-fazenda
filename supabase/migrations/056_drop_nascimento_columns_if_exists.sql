-- Garantir remoção das colunas nascimento_id e nascimento_uuid (idempotente)
-- Caso 055 não tenha sido aplicada ou o banco esteja em estado intermediário

-- desmamas_online: remover coluna nascimento_uuid se existir
ALTER TABLE public.desmamas_online
DROP COLUMN IF EXISTS nascimento_uuid;

-- pesagens_online: remover coluna nascimento_id se existir
ALTER TABLE public.pesagens_online
DROP COLUMN IF EXISTS nascimento_id;

-- vacinacoes_online: remover coluna nascimento_id se existir
ALTER TABLE public.vacinacoes_online
DROP COLUMN IF EXISTS nascimento_id;
