-- 053_add_audits_entity_types_confinamento.sql
-- Incluir todos os tipos de entidade de auditoria (confinamento, tipoAnimal, statusAnimal, origem, genealogia)

ALTER TABLE audits_online DROP CONSTRAINT IF EXISTS audits_online_entity_check;

ALTER TABLE audits_online
  ADD CONSTRAINT audits_online_entity_check
  CHECK (entity IN (
    'fazenda','raca','nascimento','desmama','matriz','usuario','categoria','pesagem','vacina','animal',
    'tipoAnimal','statusAnimal','origem','genealogia',
    'confinamento','confinamentoAnimal','confinamentoPesagem','confinamentoAlimentacao'
  ));

COMMENT ON COLUMN audits_online.entity IS 'Tipo de entidade auditada (fazenda, raca, categoria, nascimento, desmama, matriz, usuario, pesagem, vacina, animal, tipoAnimal, statusAnimal, origem, genealogia, confinamento, confinamentoAnimal, confinamentoPesagem, confinamentoAlimentacao)';
