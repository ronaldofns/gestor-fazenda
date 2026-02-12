-- RPC para testar se auth.uid() está preenchido (útil para debug do sync com JWT).
-- No frontend: await supabase.rpc('auth_uid') → se retornar UUID, o JWT chegou; se null, não chegou.
create or replace function public.auth_uid()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid();
$$;
