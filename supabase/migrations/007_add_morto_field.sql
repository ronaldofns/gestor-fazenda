-- 007_add_morto_field.sql
-- Adicionar campo morto na tabela nascimentos_online

alter table nascimentos_online 
add column if not exists morto boolean default false;

-- Comentário para documentação
comment on column nascimentos_online.morto is 'Indica se o bezerro nasceu morto (true) ou vivo (false)';

