-- Criar tabela categorias_online
CREATE TABLE IF NOT EXISTS categorias_online (
  id BIGSERIAL PRIMARY KEY,
  uuid TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_categorias_online_uuid ON categorias_online(uuid);
CREATE INDEX IF NOT EXISTS idx_categorias_online_nome ON categorias_online(nome);

-- Habilitar RLS
ALTER TABLE categorias_online ENABLE ROW LEVEL SECURITY;

-- Política RLS: permitir leitura e escrita para usuários autenticados
CREATE POLICY "Usuários autenticados podem ler categorias"
  ON categorias_online FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir categorias"
  ON categorias_online FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar categorias"
  ON categorias_online FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem deletar categorias"
  ON categorias_online FOR DELETE
  USING (auth.role() = 'authenticated');

-- Inserir categorias padrão
INSERT INTO categorias_online (uuid, nome, created_at, updated_at)
VALUES 
  ('categoria-novilha', 'Novilha', NOW(), NOW()),
  ('categoria-vaca', 'Vaca', NOW(), NOW())
ON CONFLICT (uuid) DO NOTHING;

