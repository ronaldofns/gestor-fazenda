-- ========================================
-- Script para atualizar brincos vazios em animais_online
-- Gera brincos temporários no formato TEMP-YYYYMMDD-HHMMSS
-- ========================================

-- PRIMEIRO: Verificar quantos registros serão afetados
-- Execute este SELECT antes do UPDATE para ver o que será alterado
SELECT 
  id,
  uuid,
  brinco,
  nome,
  data_cadastro,
  created_at,
  'TEMP-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || TO_CHAR(created_at, 'HH24MISS') as novo_brinco
FROM public.animais_online
WHERE deleted_at IS NULL
  AND (
    brinco IS NULL 
    OR TRIM(brinco) = '' 
    OR LENGTH(TRIM(brinco)) = 0
  )
ORDER BY created_at;

-- SEGUNDO: Executar o UPDATE para atualizar os brincos vazios
-- ATENÇÃO: Este comando irá modificar dados. Execute apenas após revisar o SELECT acima.
UPDATE public.animais_online
SET 
  brinco = 'TEMP-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || TO_CHAR(created_at, 'HH24MISS'),
  updated_at = NOW()
WHERE deleted_at IS NULL
  AND (
    brinco IS NULL 
    OR TRIM(brinco) = '' 
    OR LENGTH(TRIM(brinco)) = 0
  );

-- TERCEIRO: Verificar se houve conflitos de brincos duplicados
-- Se houver animais criados no mesmo segundo, pode haver duplicatas
-- Este SELECT mostra possíveis duplicatas
SELECT 
  brinco,
  COUNT(*) as quantidade,
  ARRAY_AGG(id ORDER BY id) as ids_afetados
FROM public.animais_online
WHERE deleted_at IS NULL
  AND brinco LIKE 'TEMP-%'
GROUP BY brinco
HAVING COUNT(*) > 1;

-- QUARTO: Se houver duplicatas, este script corrige adicionando um sufixo sequencial
-- Execute apenas se o SELECT acima mostrar duplicatas
DO $$
DECLARE
  rec RECORD;
  counter INTEGER;
BEGIN
  FOR rec IN 
    SELECT brinco, ARRAY_AGG(id ORDER BY id) as ids_array
    FROM public.animais_online
    WHERE deleted_at IS NULL
      AND brinco LIKE 'TEMP-%'
    GROUP BY brinco
    HAVING COUNT(*) > 1
  LOOP
    counter := 1;
    -- Pular o primeiro (manter brinco original) e atualizar os demais
    FOR i IN 2..array_length(rec.ids_array, 1) LOOP
      UPDATE public.animais_online
      SET 
        brinco = rec.brinco || '-' || counter,
        updated_at = NOW()
      WHERE id = rec.ids_array[i];
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- QUINTO: Verificação final - mostrar resumo
SELECT 
  COUNT(*) FILTER (WHERE brinco LIKE 'TEMP-%') as brincos_temporarios,
  COUNT(*) FILTER (WHERE brinco IS NULL OR TRIM(brinco) = '') as brincos_vazios,
  COUNT(*) as total_animais_ativos
FROM public.animais_online
WHERE deleted_at IS NULL;
