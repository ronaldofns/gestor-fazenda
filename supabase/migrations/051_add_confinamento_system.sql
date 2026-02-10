-- ========================================
-- MÓDULO DE CONFINAMENTO
-- Migração para criar estrutura completa de gestão de confinamento
-- ========================================

-- 1. Tabela de Confinamentos (lotes/ciclos)
CREATE TABLE IF NOT EXISTS public.confinamentos_online (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  fazenda_id INTEGER NOT NULL REFERENCES public.fazendas_online(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL, -- Ex: "Confinamento Maio/2026 – Terminação"
  data_inicio DATE NOT NULL,
  data_fim_prevista DATE,
  data_fim_real DATE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ativo', 'finalizado', 'cancelado')),
  observacoes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Índices para confinamentos_online
CREATE INDEX IF NOT EXISTS idx_confinamentos_fazenda ON public.confinamentos_online(fazenda_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_confinamentos_status ON public.confinamentos_online(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_confinamentos_fazenda_status ON public.confinamentos_online(fazenda_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_confinamentos_data_inicio ON public.confinamentos_online(data_inicio) WHERE deleted_at IS NULL;

-- Trigger para updated_at em confinamentos_online
CREATE OR REPLACE FUNCTION update_confinamentos_online_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_confinamentos_online_updated_at
  BEFORE UPDATE ON public.confinamentos_online
  FOR EACH ROW
  EXECUTE FUNCTION update_confinamentos_online_updated_at();

-- 2. Tabela de Vínculo Animal-Confinamento
CREATE TABLE IF NOT EXISTS public.confinamento_animais_online (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  confinamento_id INTEGER NOT NULL REFERENCES public.confinamentos_online(id) ON DELETE CASCADE,
  animal_id UUID NOT NULL REFERENCES public.animais_online(uuid) ON DELETE CASCADE,
  data_entrada DATE NOT NULL,
  peso_entrada NUMERIC(10, 2) NOT NULL CHECK (peso_entrada > 0),
  data_saida DATE,
  peso_saida NUMERIC(10, 2) CHECK (peso_saida IS NULL OR peso_saida > 0),
  motivo_saida VARCHAR(20) CHECK (motivo_saida IN ('abate', 'venda', 'morte', 'outro')),
  observacoes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Um animal não pode estar em múltiplos confinamentos ativos simultaneamente
  -- (validação via trigger ou aplicação)
  UNIQUE(animal_id, confinamento_id)
);

-- Índices para confinamento_animais_online
CREATE INDEX IF NOT EXISTS idx_confinamento_animais_confinamento ON public.confinamento_animais_online(confinamento_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_confinamento_animais_animal ON public.confinamento_animais_online(animal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_confinamento_animais_data_entrada ON public.confinamento_animais_online(data_entrada) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_confinamento_animais_data_saida ON public.confinamento_animais_online(data_saida) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_confinamento_animais_ativo ON public.confinamento_animais_online(animal_id, data_saida) WHERE deleted_at IS NULL AND data_saida IS NULL;

-- Trigger para updated_at em confinamento_animais_online
CREATE OR REPLACE FUNCTION update_confinamento_animais_online_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_confinamento_animais_online_updated_at
  BEFORE UPDATE ON public.confinamento_animais_online
  FOR EACH ROW
  EXECUTE FUNCTION update_confinamento_animais_online_updated_at();

-- 3. Tabela de Pesagens do Confinamento (opcional - pode reutilizar pesagens gerais)
CREATE TABLE IF NOT EXISTS public.confinamento_pesagens_online (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  confinamento_animal_id INTEGER NOT NULL REFERENCES public.confinamento_animais_online(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  peso NUMERIC(10, 2) NOT NULL CHECK (peso > 0),
  observacoes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Uma pesagem por animal-confinamento por data
  UNIQUE(confinamento_animal_id, data)
);

-- Índices para confinamento_pesagens_online
CREATE INDEX IF NOT EXISTS idx_confinamento_pesagens_confinamento_animal ON public.confinamento_pesagens_online(confinamento_animal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_confinamento_pesagens_data ON public.confinamento_pesagens_online(data) WHERE deleted_at IS NULL;

-- Trigger para updated_at em confinamento_pesagens_online
CREATE OR REPLACE FUNCTION update_confinamento_pesagens_online_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_confinamento_pesagens_online_updated_at
  BEFORE UPDATE ON public.confinamento_pesagens_online
  FOR EACH ROW
  EXECUTE FUNCTION update_confinamento_pesagens_online_updated_at();

-- 4. Tabela de Alimentação do Confinamento (Fase 2 - opcional no MVP)
CREATE TABLE IF NOT EXISTS public.confinamento_alimentacao_online (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  confinamento_id INTEGER NOT NULL REFERENCES public.confinamentos_online(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo_dieta VARCHAR(200),
  custo_total NUMERIC(10, 2) CHECK (custo_total IS NULL OR custo_total >= 0),
  observacoes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Índices para confinamento_alimentacao_online
CREATE INDEX IF NOT EXISTS idx_confinamento_alimentacao_confinamento ON public.confinamento_alimentacao_online(confinamento_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_confinamento_alimentacao_data ON public.confinamento_alimentacao_online(data) WHERE deleted_at IS NULL;

-- Trigger para updated_at em confinamento_alimentacao_online
CREATE OR REPLACE FUNCTION update_confinamento_alimentacao_online_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_confinamento_alimentacao_online_updated_at
  BEFORE UPDATE ON public.confinamento_alimentacao_online
  FOR EACH ROW
  EXECUTE FUNCTION update_confinamento_alimentacao_online_updated_at();

-- ========================================
-- RLS (Row Level Security)
-- ========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.confinamentos_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confinamento_animais_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confinamento_pesagens_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confinamento_alimentacao_online ENABLE ROW LEVEL SECURITY;

-- Políticas para confinamentos_online
CREATE POLICY "Usuários autenticados podem ler confinamentos"
  ON public.confinamentos_online
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir confinamentos"
  ON public.confinamentos_online
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar confinamentos"
  ON public.confinamentos_online
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar confinamentos"
  ON public.confinamentos_online
  FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para confinamento_animais_online
CREATE POLICY "Usuários autenticados podem ler confinamento_animais"
  ON public.confinamento_animais_online
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir confinamento_animais"
  ON public.confinamento_animais_online
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar confinamento_animais"
  ON public.confinamento_animais_online
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar confinamento_animais"
  ON public.confinamento_animais_online
  FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para confinamento_pesagens_online
CREATE POLICY "Usuários autenticados podem ler confinamento_pesagens"
  ON public.confinamento_pesagens_online
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir confinamento_pesagens"
  ON public.confinamento_pesagens_online
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar confinamento_pesagens"
  ON public.confinamento_pesagens_online
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar confinamento_pesagens"
  ON public.confinamento_pesagens_online
  FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para confinamento_alimentacao_online
CREATE POLICY "Usuários autenticados podem ler confinamento_alimentacao"
  ON public.confinamento_alimentacao_online
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir confinamento_alimentacao"
  ON public.confinamento_alimentacao_online
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar confinamento_alimentacao"
  ON public.confinamento_alimentacao_online
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar confinamento_alimentacao"
  ON public.confinamento_alimentacao_online
  FOR DELETE
  TO authenticated
  USING (true);

-- ========================================
-- Comentários para documentação
-- ========================================

COMMENT ON TABLE public.confinamentos_online IS 'Tabela de confinamentos (lotes/ciclos)';
COMMENT ON TABLE public.confinamento_animais_online IS 'Vínculo entre animais e confinamentos - histórico completo';
COMMENT ON TABLE public.confinamento_pesagens_online IS 'Pesagens específicas do confinamento (opcional - pode reutilizar pesagens gerais)';
COMMENT ON TABLE public.confinamento_alimentacao_online IS 'Controle de alimentação e custos do confinamento (Fase 2)';

COMMENT ON COLUMN public.confinamentos_online.status IS 'Status: ativo, finalizado ou cancelado';
COMMENT ON COLUMN public.confinamento_animais_online.motivo_saida IS 'Motivo da saída: abate, venda, morte ou outro';
COMMENT ON COLUMN public.confinamento_animais_online.data_saida IS 'NULL se animal ainda está confinado';
