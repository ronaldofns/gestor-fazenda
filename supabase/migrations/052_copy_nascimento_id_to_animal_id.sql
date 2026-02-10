-- ========================================
-- Copiar nascimento_id → animal_id
-- Preenche animal_id onde estiver NULL usando o valor de nascimento_id/nascimento_uuid
-- (cadastros antigos que gravaram apenas em nascimento_id)
-- ========================================

-- 1) pesagens_online: nascimento_id (text) → animal_id (uuid)
UPDATE public.pesagens_online
SET animal_id = nascimento_id::uuid
WHERE animal_id IS NULL
  AND nascimento_id IS NOT NULL
  AND nascimento_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- 2) vacinacoes_online: nascimento_id (text) → animal_id (uuid)
UPDATE public.vacinacoes_online
SET animal_id = nascimento_id::uuid
WHERE animal_id IS NULL
  AND nascimento_id IS NOT NULL
  AND nascimento_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- 3) desmamas_online: nascimento_uuid (text) → animal_id (uuid)
UPDATE public.desmamas_online
SET animal_id = nascimento_uuid::uuid
WHERE animal_id IS NULL
  AND nascimento_uuid IS NOT NULL
  AND nascimento_uuid ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
