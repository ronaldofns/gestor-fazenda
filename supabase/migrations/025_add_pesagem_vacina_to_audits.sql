-- 025_add_pesagem_vacina_to_audits.sql
-- Adicionar 'pesagem' e 'vacina' à constraint check da tabela audits_online

-- Remover constraint antiga (se existir)
ALTER TABLE audits_online DROP CONSTRAINT IF EXISTS audits_online_entity_check;

-- Recriar constraint com 'pesagem' e 'vacina' incluídas
ALTER TABLE audits_online
  ADD CONSTRAINT audits_online_entity_check
  CHECK (entity IN ('fazenda','raca','nascimento','desmama','matriz','usuario','categoria','pesagem','vacina'));

-- Comentário atualizado
COMMENT ON COLUMN audits_online.entity IS 'Tipo de entidade: fazenda, raca, categoria, nascimento, desmama, matriz, usuario, pesagem, vacina';
