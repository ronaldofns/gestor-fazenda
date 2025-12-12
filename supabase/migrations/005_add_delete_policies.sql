-- 005_add_delete_policies.sql
-- Adicionar políticas DELETE para as tabelas de sincronização
-- Estas políticas permitem que usuários autenticados excluam registros

-- Policies para DELETE: permitir exclusão para usuários autenticados
-- Remover políticas existentes se houver (para evitar erro de duplicação)
drop policy if exists "fazendas_online_delete" on fazendas_online;
drop policy if exists "nascimentos_online_delete" on nascimentos_online;
drop policy if exists "desmamas_online_delete" on desmamas_online;

-- Criar políticas DELETE
create policy "fazendas_online_delete" on fazendas_online
  for delete using (auth.role() = 'authenticated');

create policy "nascimentos_online_delete" on nascimentos_online
  for delete using (auth.role() = 'authenticated');

create policy "desmamas_online_delete" on desmamas_online
  for delete using (auth.role() = 'authenticated');

