-- ========================================
-- Adicionar animal_id à tabela pesagens_online
-- Vincula pesagens ao novo sistema de animais
-- ========================================

-- Adicionar coluna animal_id (opcional para manter compatibilidade)
ALTER TABLE public.pesagens_online 
ADD COLUMN IF NOT EXISTS animal_id UUID REFERENCES public.animais_online(uuid) ON DELETE CASCADE;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_pesagens_animal_id 
ON public.pesagens_online(animal_id) 
WHERE animal_id IS NOT NULL;

-- Migração de dados: Vincular pesagens existentes aos animais
-- Buscar animal através do nascimento (brinco + fazenda + data nascimento)
UPDATE public.pesagens_online p
SET animal_id = (
  SELECT a.uuid
  FROM public.animais_online a
  INNER JOIN public.nascimentos_online n ON (
    n.brinco_numero = a.brinco AND
    n.fazenda_uuid = (
      SELECT f.uuid 
      FROM public.fazendas_online f 
      WHERE f.id = a.fazenda_id
    ) AND
    COALESCE(n.data_nascimento::text, '') = COALESCE(a.data_nascimento::text, '')
  )
  WHERE n.uuid = p.nascimento_id
  AND a.deleted_at IS NULL
  LIMIT 1
)
WHERE p.animal_id IS NULL
AND p.nascimento_id IS NOT NULL;

-- Comentário na coluna
COMMENT ON COLUMN public.pesagens_online.animal_id IS 'Referência ao animal no novo sistema (opcional, mantém compatibilidade com nascimento_id)';
