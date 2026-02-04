-- 041_add_animal_to_audits_check.sql
-- Adicionar 'animal' à constraint check da tabela audits_online

-- Remover constraint antiga (se existir)
ALTER TABLE audits_online DROP CONSTRAINT IF EXISTS audits_online_entity_check;

-- Recriar constraint com 'animal' incluído
ALTER TABLE audits_online
  ADD CONSTRAINT audits_online_entity_check
  CHECK (entity IN ('fazenda','raca','nascimento','desmama','matriz','usuario','categoria','pesagem','vacina','animal'));

-- Comentário atualizado
COMMENT ON COLUMN audits_online.entity IS 'Tipo de entidade: fazenda, raca, categoria, nascimento, desmama, matriz, usuario, pesagem, vacina, animal';
