-- 049_fix_notificacoes_lidas_tipo_check.sql
-- Corrige a constraint CHECK da coluna tipo para incluir 'peso' e 'vacina',
-- que são usados pelo app mas não estavam permitidos no banco.
-- Isso causava falha no push de notificações lidas, mantendo-as sempre pendentes.

-- Remove a constraint antiga (há apenas uma CHECK na tabela, na coluna tipo)
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

-- Adiciona nova constraint com TODOS os tipos usados pelo app
-- Notificacoes.tsx usa: desmama_atrasada, matriz_improdutiva, peso_critico, vacinas_vencidas, mortalidade_alta
-- notificacoesLidas.ts usa: desmama, mortalidade, dados, matriz, peso, vacina
alter table notificacoes_lidas_online
  add constraint notificacoes_lidas_online_tipo_check
  check (tipo in (
    'desmama', 'mortalidade', 'dados', 'matriz', 'peso', 'vacina',
    'desmama_atrasada', 'matriz_improdutiva', 'peso_critico', 'vacinas_vencidas', 'mortalidade_alta'
  ));

comment on column notificacoes_lidas_online.tipo is 'Tipo da notificação (simples ou estendido conforme Notificacoes.tsx)';
