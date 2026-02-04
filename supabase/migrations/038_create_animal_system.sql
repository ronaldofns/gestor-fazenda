-- ========================================
-- NOVO SISTEMA DE ANIMAIS
-- Migração para criar estrutura completa de gestão de animais
-- ========================================

-- 1. Tabela de Tipos de Animal (Bezerro, Vaca, Touro, etc.)
CREATE TABLE IF NOT EXISTS public.tipos_animal_online (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Índices para tipos_animal_online
CREATE INDEX IF NOT EXISTS idx_tipos_animal_ativo ON public.tipos_animal_online(ativo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tipos_animal_ordem ON public.tipos_animal_online(ordem) WHERE deleted_at IS NULL;

-- Trigger para updated_at em tipos_animal_online
CREATE OR REPLACE FUNCTION update_tipos_animal_online_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tipos_animal_online_updated_at
  BEFORE UPDATE ON public.tipos_animal_online
  FOR EACH ROW
  EXECUTE FUNCTION update_tipos_animal_online_updated_at();

-- Inserir tipos padrão
INSERT INTO public.tipos_animal_online (nome, descricao, ordem) VALUES
  ('Bezerro', 'Macho até 12 meses', 1),
  ('Bezerra', 'Fêmea até 12 meses', 2),
  ('Novilho', 'Macho de 12 a 24 meses', 3),
  ('Novilha', 'Fêmea de 12 a 36 meses', 4),
  ('Vaca', 'Fêmea adulta', 5),
  ('Touro', 'Macho reprodutor', 6),
  ('Boi', 'Macho castrado para engorda', 7),
  ('Garrote', 'Macho jovem para engorda', 8)
ON CONFLICT (uuid) DO NOTHING;

-- 2. Tabela de Status de Animal (Ativo, Vendido, Morto, etc.)
CREATE TABLE IF NOT EXISTS public.status_animal_online (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  cor VARCHAR(7), -- Cor em hex (#RRGGBB)
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Índices para status_animal_online
CREATE INDEX IF NOT EXISTS idx_status_animal_ativo ON public.status_animal_online(ativo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_status_animal_ordem ON public.status_animal_online(ordem) WHERE deleted_at IS NULL;

-- Trigger para updated_at em status_animal_online
CREATE OR REPLACE FUNCTION update_status_animal_online_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_status_animal_online_updated_at
  BEFORE UPDATE ON public.status_animal_online
  FOR EACH ROW
  EXECUTE FUNCTION update_status_animal_online_updated_at();

-- Inserir status padrão
INSERT INTO public.status_animal_online (nome, cor, descricao, ordem) VALUES
  ('Ativo', '#10b981', 'Animal ativo no rebanho', 1),
  ('Vendido', '#3b82f6', 'Animal vendido', 2),
  ('Morto', '#ef4444', 'Animal morto', 3),
  ('Transferido', '#f59e0b', 'Transferido para outra fazenda', 4),
  ('Doente', '#ec4899', 'Animal em tratamento', 5)
ON CONFLICT (uuid) DO NOTHING;

-- 3. Tabela de Origens (Nascido, Comprado, Transferido, etc.)
CREATE TABLE IF NOT EXISTS public.origens_online (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Índices para origens_online
CREATE INDEX IF NOT EXISTS idx_origens_ativo ON public.origens_online(ativo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_origens_ordem ON public.origens_online(ordem) WHERE deleted_at IS NULL;

-- Trigger para updated_at em origens_online
CREATE OR REPLACE FUNCTION update_origens_online_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_origens_online_updated_at
  BEFORE UPDATE ON public.origens_online
  FOR EACH ROW
  EXECUTE FUNCTION update_origens_online_updated_at();

-- Inserir origens padrão
INSERT INTO public.origens_online (nome, descricao, ordem) VALUES
  ('Nascido na Fazenda', 'Animal nascido na propriedade', 1),
  ('Comprado', 'Animal adquirido de terceiros', 2),
  ('Transferido', 'Transferido de outra fazenda do grupo', 3),
  ('Doado', 'Animal recebido como doação', 4)
ON CONFLICT (uuid) DO NOTHING;

-- 4. Tabela Principal de Animais
CREATE TABLE IF NOT EXISTS public.animais_online (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  
  -- Identificação
  brinco VARCHAR(100) NOT NULL,
  nome VARCHAR(200),
  
  -- Classificação
  tipo_id INTEGER REFERENCES public.tipos_animal_online(id),
  raca_id INTEGER REFERENCES public.racas_online(id),
  sexo VARCHAR(1) CHECK (sexo IN ('M', 'F')),
  status_id INTEGER REFERENCES public.status_animal_online(id),
  
  -- Datas
  data_nascimento DATE NOT NULL,
  data_cadastro DATE DEFAULT CURRENT_DATE,
  data_entrada DATE,
  data_saida DATE,
  
  -- Origem e Proprietário
  origem_id INTEGER REFERENCES public.origens_online(id),
  fazenda_id INTEGER NOT NULL REFERENCES public.fazendas_online(id),
  fazenda_origem_id INTEGER REFERENCES public.fazendas_online(id),
  proprietario_anterior VARCHAR(200),
  
  -- Genealogia (referências a outros animais)
  matriz_id UUID REFERENCES public.animais_online(uuid), -- Mãe
  reprodutor_id UUID REFERENCES public.animais_online(uuid), -- Pai
  
  -- Financeiro
  valor_compra DECIMAL(10, 2),
  valor_venda DECIMAL(10, 2),
  
  -- Físico
  pelagem VARCHAR(100),
  peso_atual DECIMAL(7, 2),
  
  -- Agrupamento
  lote VARCHAR(100),
  categoria VARCHAR(100),
  
  -- Observações
  obs TEXT,
  
  -- Sistema
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Índices para animais_online
CREATE INDEX IF NOT EXISTS idx_animais_brinco ON public.animais_online(brinco) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animais_fazenda ON public.animais_online(fazenda_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animais_tipo ON public.animais_online(tipo_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animais_status ON public.animais_online(status_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animais_fazenda_brinco ON public.animais_online(fazenda_id, brinco) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animais_fazenda_status ON public.animais_online(fazenda_id, status_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animais_matriz ON public.animais_online(matriz_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animais_reprodutor ON public.animais_online(reprodutor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animais_data_nascimento ON public.animais_online(data_nascimento) WHERE deleted_at IS NULL;

-- Trigger para updated_at em animais_online
CREATE OR REPLACE FUNCTION update_animais_online_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_animais_online_updated_at
  BEFORE UPDATE ON public.animais_online
  FOR EACH ROW
  EXECUTE FUNCTION update_animais_online_updated_at();

-- 5. Tabela de Genealogia (Árvore genealógica completa)
CREATE TABLE IF NOT EXISTS public.genealogias_online (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  
  -- Animal em questão
  animal_id UUID NOT NULL REFERENCES public.animais_online(uuid),
  
  -- Pais
  matriz_id UUID REFERENCES public.animais_online(uuid), -- Mãe
  reprodutor_id UUID REFERENCES public.animais_online(uuid), -- Pai
  
  -- Avós maternos
  avo_materna UUID REFERENCES public.animais_online(uuid), -- Avó materna (mãe da mãe)
  avo_materno UUID REFERENCES public.animais_online(uuid), -- Avô materno (pai da mãe)
  
  -- Avós paternos
  avo_paterna UUID REFERENCES public.animais_online(uuid), -- Avó paterna (mãe do pai)
  avo_paterno UUID REFERENCES public.animais_online(uuid), -- Avô paterno (pai do pai)
  
  -- Metadados
  geracoes INTEGER DEFAULT 1, -- Número de gerações registradas
  observacoes TEXT,
  
  -- Sistema
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  UNIQUE(animal_id) -- Um animal tem apenas uma árvore genealógica
);

-- Índices para genealogias_online
CREATE INDEX IF NOT EXISTS idx_genealogias_animal ON public.genealogias_online(animal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_genealogias_matriz ON public.genealogias_online(matriz_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_genealogias_reprodutor ON public.genealogias_online(reprodutor_id) WHERE deleted_at IS NULL;

-- Trigger para updated_at em genealogias_online
CREATE OR REPLACE FUNCTION update_genealogias_online_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_genealogias_online_updated_at
  BEFORE UPDATE ON public.genealogias_online
  FOR EACH ROW
  EXECUTE FUNCTION update_genealogias_online_updated_at();

-- ========================================
-- RLS POLICIES (Row Level Security)
-- ========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.tipos_animal_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_animal_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origens_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animais_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genealogias_online ENABLE ROW LEVEL SECURITY;

-- Policies públicas (sistema usa autenticação local)
CREATE POLICY tipos_animal_select_public ON public.tipos_animal_online FOR SELECT USING (true);
CREATE POLICY tipos_animal_insert_public ON public.tipos_animal_online FOR INSERT WITH CHECK (true);
CREATE POLICY tipos_animal_update_public ON public.tipos_animal_online FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY status_animal_select_public ON public.status_animal_online FOR SELECT USING (true);
CREATE POLICY status_animal_insert_public ON public.status_animal_online FOR INSERT WITH CHECK (true);
CREATE POLICY status_animal_update_public ON public.status_animal_online FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY origens_select_public ON public.origens_online FOR SELECT USING (true);
CREATE POLICY origens_insert_public ON public.origens_online FOR INSERT WITH CHECK (true);
CREATE POLICY origens_update_public ON public.origens_online FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY animais_select_public ON public.animais_online FOR SELECT USING (true);
CREATE POLICY animais_insert_public ON public.animais_online FOR INSERT WITH CHECK (true);
CREATE POLICY animais_update_public ON public.animais_online FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY genealogias_select_public ON public.genealogias_online FOR SELECT USING (true);
CREATE POLICY genealogias_insert_public ON public.genealogias_online FOR INSERT WITH CHECK (true);
CREATE POLICY genealogias_update_public ON public.genealogias_online FOR UPDATE USING (true) WITH CHECK (true);

-- ========================================
-- COMENTÁRIOS (Documentação)
-- ========================================

COMMENT ON TABLE public.tipos_animal_online IS 'Tipos de animais (Bezerro, Vaca, Touro, etc.) - Editável pelo usuário';
COMMENT ON TABLE public.status_animal_online IS 'Status dos animais (Ativo, Vendido, Morto, etc.) - Editável pelo usuário';
COMMENT ON TABLE public.origens_online IS 'Origens dos animais (Nascido, Comprado, Transferido, etc.) - Editável pelo usuário';
COMMENT ON TABLE public.animais_online IS 'Tabela principal de animais - Substitui nascimentos com estrutura completa';
COMMENT ON TABLE public.genealogias_online IS 'Árvore genealógica completa dos animais (até 3 gerações)';
