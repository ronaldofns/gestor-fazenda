-- 022_add_intervalo_sincronizacao.sql
-- Adicionar campo intervalo_sincronizacao e primary_color na tabela app_settings_online

-- Adicionar coluna intervalo_sincronizacao (em segundos)
alter table app_settings_online
add column if not exists intervalo_sincronizacao integer not null default 30 check (intervalo_sincronizacao >= 10 and intervalo_sincronizacao <= 300);

-- Adicionar coluna primary_color (se não existir)
alter table app_settings_online
add column if not exists primary_color text default 'gray' check (primary_color in ('green', 'blue', 'emerald', 'teal', 'indigo', 'purple', 'gray'));

-- Comentários para documentação
comment on column app_settings_online.intervalo_sincronizacao is 'Intervalo de sincronização automática em segundos (10-300)';
comment on column app_settings_online.primary_color is 'Cor primária do tema (green, blue, emerald, teal, indigo, purple, gray)';
