-- 050_add_notificacoes_lidas_tipos_estendidos.sql
-- Adiciona tipos estendidos (desmama_atrasada, matriz_improdutiva, etc.) na constraint.
-- Necessário se 049 já foi aplicada com apenas peso/vacina.
-- Notificacoes.tsx usa esses tipos ao marcar alertas como lidos.

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'notificacoes_lidas_online'::regclass
    and contype = 'c'
  limit 1;
  if cname is not null then
    execute format('alter table notificacoes_lidas_online drop constraint %I', cname);
  end if;
end $$;

alter table notificacoes_lidas_online
  add constraint notificacoes_lidas_online_tipo_check
  check (tipo in (
    'desmama', 'mortalidade', 'dados', 'matriz', 'peso', 'vacina',
    'desmama_atrasada', 'matriz_improdutiva', 'peso_critico', 'vacinas_vencidas', 'mortalidade_alta'
  ));
