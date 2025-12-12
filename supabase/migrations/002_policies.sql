-- 002_policies.sql
-- Enable Row Level Security and policies for privacy

-- Enable RLS for tables that should be access-controlled
alter table bezerros enable row level security;
alter table vacas enable row level security;
alter table desmama enable row level security;
alter table fazendas enable row level security;
alter table usuarios enable row level security;

-- Policy: allow users to select rows belonging to their fazenda
create policy "bezerros_select_own_fazenda" on bezerros
  for select using (fazenda_id = (select fazenda_id from usuarios where id = auth.uid()));

create policy "vacas_select_own_fazenda" on vacas
  for select using (fazenda_id = (select fazenda_id from usuarios where id = auth.uid()));

create policy "desmama_select_own_fazenda" on desmama
  for select using (exists (select 1 from bezerros b where b.id = desmama.bezerro_id and b.fazenda_id = (select fazenda_id from usuarios where id = auth.uid())));

create policy "fazendas_select_basic" on fazendas
  for select using (exists (select 1 from usuarios u where u.id = auth.uid() and u.fazenda_id = fazendas.id));

-- Insert policies for insert: ensure user's fazenda matches inserted fazenda
create policy "bezerros_insert_own_fazenda" on bezerros
  for insert with check (fazenda_id = (select fazenda_id from usuarios where id = auth.uid()));

create policy "vacas_insert_own_fazenda" on vacas
  for insert with check (fazenda_id = (select fazenda_id from usuarios where id = auth.uid()));

-- Allow users to insert desmama only for bezerros in their fazenda
create policy "desmama_insert_own" on desmama
  for insert with check (exists (select 1 from bezerros b where b.id = desmama.bezerro_id and b.fazenda_id = (select fazenda_id from usuarios where id = auth.uid())));

-- Update policies: only allow updates if same fazenda
create policy "bezerros_update_own" on bezerros
  for update using (fazenda_id = (select fazenda_id from usuarios where id = auth.uid()))
  with check (fazenda_id = (select fazenda_id from usuarios where id = auth.uid()));

create policy "vacas_update_own" on vacas
  for update using (fazenda_id = (select fazenda_id from usuarios where id = auth.uid()))
  with check (fazenda_id = (select fazenda_id from usuarios where id = auth.uid()));

-- Deletion restricted to admin role via check on usuarios table role
create policy "restrict_delete_admin" on bezerros
  for delete using (exists (select 1 from usuarios u where u.id = auth.uid() and u.role = 'admin'));

create policy "restrict_delete_admin_vacas" on vacas
  for delete using (exists (select 1 from usuarios u where u.id = auth.uid() and u.role = 'admin'));
