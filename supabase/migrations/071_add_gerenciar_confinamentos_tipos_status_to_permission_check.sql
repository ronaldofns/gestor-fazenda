-- Incluir gerenciar_confinamentos, gerenciar_tipos_animais e gerenciar_status_animais no CHECK de permission
-- (alinhado a PermissionType em src/db/models.ts)

alter table public.role_permissions_online drop constraint if exists role_permissions_online_permission_check;

alter table public.role_permissions_online
  add constraint role_permissions_online_permission_check
  check (permission in (
    'gerenciar_usuarios',
    'gerenciar_fazendas',
    'gerenciar_confinamentos',
    'gerenciar_racas',
    'gerenciar_tipos_animais',
    'gerenciar_status_animais',
    'gerenciar_categorias',
    'cadastrar_animal',
    'editar_animal',
    'excluir_animal',
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
    'ver_planilha',
    'ver_confinamentos',
    'ver_fazendas',
    'ver_usuarios',
    'exportar_dados',
    'gerar_relatorios'
  ));

comment on column public.role_permissions_online.permission is 'Tipo de permissão (deve coincidir com PermissionType em src/db/models.ts).';
