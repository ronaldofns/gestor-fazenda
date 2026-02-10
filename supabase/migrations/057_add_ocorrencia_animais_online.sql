-- ========================================
-- OCORRÊNCIAS ANIMAL (sanidade: doença, tratamento, morte, outro)
-- Tabela para sync com o app (ocorrencia_animais no Dexie)
-- ========================================

CREATE TABLE IF NOT EXISTS public.ocorrencia_animais_online (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  animal_id UUID NOT NULL REFERENCES public.animais_online(uuid) ON DELETE CASCADE,
  confinamento_animal_id INTEGER NULL REFERENCES public.confinamento_animais_online(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('doenca', 'tratamento', 'morte', 'outro')),
  custo NUMERIC(10, 2) CHECK (custo IS NULL OR custo >= 0),
  observacoes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ocorrencia_animais_animal ON public.ocorrencia_animais_online(animal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ocorrencia_animais_confinamento_animal ON public.ocorrencia_animais_online(confinamento_animal_id) WHERE deleted_at IS NULL AND confinamento_animal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ocorrencia_animais_data ON public.ocorrencia_animais_online(data) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ocorrencia_animais_updated_at ON public.ocorrencia_animais_online(updated_at) WHERE deleted_at IS NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_ocorrencia_animais_online_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ocorrencia_animais_online_updated_at
  BEFORE UPDATE ON public.ocorrencia_animais_online
  FOR EACH ROW
  EXECUTE FUNCTION update_ocorrencia_animais_online_updated_at();

-- ========================================
-- RLS (Row Level Security) — políticas públicas para sync (anon/key)
-- ========================================

ALTER TABLE public.ocorrencia_animais_online ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocorrencia_animais_online_select_public" ON public.ocorrencia_animais_online
  FOR SELECT USING (true);

CREATE POLICY "ocorrencia_animais_online_insert_public" ON public.ocorrencia_animais_online
  FOR INSERT WITH CHECK (true);

CREATE POLICY "ocorrencia_animais_online_update_public" ON public.ocorrencia_animais_online
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "ocorrencia_animais_online_delete_public" ON public.ocorrencia_animais_online
  FOR DELETE USING (true);

-- ========================================
-- Auditoria: permitir entity 'ocorrenciaAnimal' em audits_online
-- ========================================

ALTER TABLE public.audits_online DROP CONSTRAINT IF EXISTS audits_online_entity_check;

ALTER TABLE public.audits_online
  ADD CONSTRAINT audits_online_entity_check
  CHECK (entity IN (
    'fazenda','raca','nascimento','desmama','matriz','usuario','categoria','pesagem','vacina','animal',
    'tipoAnimal','statusAnimal','origem','genealogia',
    'confinamento','confinamentoAnimal','confinamentoPesagem','confinamentoAlimentacao','ocorrenciaAnimal'
  ));

COMMENT ON TABLE public.ocorrencia_animais_online IS 'Ocorrências de sanidade por animal (doença, tratamento, morte, outro); opcionalmente vinculada a um vínculo de confinamento';
COMMENT ON COLUMN public.ocorrencia_animais_online.tipo IS 'Tipo: doenca, tratamento, morte, outro';
COMMENT ON COLUMN public.ocorrencia_animais_online.confinamento_animal_id IS 'Opcional: quando a ocorrência foi registrada no contexto de um confinamento';
