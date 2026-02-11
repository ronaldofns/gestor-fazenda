-- Alinhar constraint de permission com o tipo PermissionType do app (models.ts)
-- Remove valores obsoletos (nascimento, matrizes, importar_planilha) e garante todos os usados pelo app.

alter table public.role_permissions_online drop constraint if exists role_permissions_online_permission_check;

-- Remover linhas cuja permission não está na lista nova (evita violar a constraint).
-- O app re-sincronizará as permissões corretas (PermissionType em models.ts).
delete from public.role_permissions_online
where permission is null
   or permission not in (
    'gerenciar_usuarios',
    'gerenciar_fazendas',
    'gerenciar_racas',
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
  );

alter table public.role_permissions_online
  add constraint role_permissions_online_permission_check
  check (permission in (
    'gerenciar_usuarios',
    'gerenciar_fazendas',
    'gerenciar_racas',
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
