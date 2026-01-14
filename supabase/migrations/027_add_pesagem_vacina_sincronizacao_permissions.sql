-- 027_add_pesagem_vacina_sincronizacao_permissions.sql
-- Adicionar novas permissões para pesagens, vacinações e sincronização

-- Remover constraint antiga
alter table role_permissions_online drop constraint if exists role_permissions_online_permission_check;

-- Recriar constraint com as novas permissões
alter table role_permissions_online
  add constraint role_permissions_online_permission_check
  check (permission in (
    'importar_planilha',
    'gerenciar_usuarios',
    'gerenciar_fazendas',
    'gerenciar_matrizes',
    'gerenciar_racas',
    'gerenciar_categorias',
    'cadastrar_nascimento',
    'editar_nascimento',
    'excluir_nascimento',
    'cadastrar_desmama',
    'editar_desmama',
    'excluir_desmama',
    'cadastrar_pesagem',
    'editar_pesagem',
    'excluir_pesagem',
    'cadastrar_vacina',
    'editar_vacina',
    'excluir_vacina',
    'ver_dashboard',
    'ver_notificacoes',
    'ver_sincronizacao',
    'exportar_dados',
    'gerar_relatorios'
  ));

-- Comentário atualizado
comment on column role_permissions_online.permission is 'Tipo de permissão: importar_planilha, gerenciar_usuarios, gerenciar_fazendas, gerenciar_matrizes, gerenciar_racas, gerenciar_categorias, cadastrar_nascimento, editar_nascimento, excluir_nascimento, cadastrar_desmama, editar_desmama, excluir_desmama, cadastrar_pesagem, editar_pesagem, excluir_pesagem, cadastrar_vacina, editar_vacina, excluir_vacina, ver_dashboard, ver_notificacoes, ver_sincronizacao, exportar_dados, gerar_relatorios';
