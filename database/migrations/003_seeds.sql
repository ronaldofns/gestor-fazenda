-- 003_seeds.sql
-- Insert a default fazenda and an admin placeholder (link to an auth user must exist)
insert into fazendas (id, nome) values ('11111111-1111-1111-1111-111111111111', 'Fazenda Demo') on conflict do nothing;

-- Note: to create a user, create auth user in Supabase and then insert into usuarios referencing auth.users.id
-- Example (run after creating auth user and replacing the uuid):
-- insert into usuarios (id, nome, role, fazenda_id) values ('<auth-uuid>', 'Admin Demo', 'admin', '11111111-1111-1111-1111-111111111111');
