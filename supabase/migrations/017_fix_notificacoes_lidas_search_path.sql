-- 017_fix_notificacoes_lidas_search_path.sql
-- Corrigir função update_notificacoes_lidas_online_updated_at para ter search_path fixo
-- Isso resolve o aviso de segurança "Function Search Path Mutable"

-- Recriar a função com search_path fixo
create or replace function update_notificacoes_lidas_online_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Comentário explicativo
comment on function update_notificacoes_lidas_online_updated_at() is 'Atualiza o campo updated_at automaticamente. search_path fixo para segurança.';

