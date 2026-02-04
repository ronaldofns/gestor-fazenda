-- ========================================
-- Script Simplificado: Atualizar Brincos Vazios
-- Execute este script no Supabase SQL Editor
-- ========================================

-- 1. VERIFICAR: Quantos registros serão afetados?
SELECT 
  COUNT(*) as total_afetados,
  MIN(created_at) as primeiro_registro,
  MAX(created_at) as ultimo_registro
FROM public.animais_online
WHERE deleted_at IS NULL
  AND (brinco IS NULL OR TRIM(brinco) = '' OR LENGTH(TRIM(brinco)) = 0);

-- 2. VER: Exemplos dos registros que serão atualizados
SELECT 
  id,
  uuid,
  brinco as brinco_atual,
  nome,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as data_criacao,
  'TEMP-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || TO_CHAR(created_at, 'HH24MISS') as novo_brinco
FROM public.animais_online
WHERE deleted_at IS NULL
  AND (brinco IS NULL OR TRIM(brinco) = '' OR LENGTH(TRIM(brinco)) = 0)
ORDER BY created_at
LIMIT 10;

-- 3. EXECUTAR: Atualizar brincos vazios
-- ⚠️ ATENÇÃO: Descomente a linha abaixo apenas após revisar os resultados acima
-- UPDATE public.animais_online
-- SET 
--   brinco = 'TEMP-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || TO_CHAR(created_at, 'HH24MISS'),
--   updated_at = NOW()
-- WHERE deleted_at IS NULL
--   AND (brinco IS NULL OR TRIM(brinco) = '' OR LENGTH(TRIM(brinco)) = 0);

-- 4. VERIFICAR: Resultado após atualização
-- Execute após o UPDATE para verificar se funcionou
-- SELECT 
--   COUNT(*) FILTER (WHERE brinco LIKE 'TEMP-%') as brincos_temporarios,
--   COUNT(*) FILTER (WHERE brinco IS NULL OR TRIM(brinco) = '') as brincos_vazios,
--   COUNT(*) as total_animais_ativos
-- FROM public.animais_online
-- WHERE deleted_at IS NULL;
