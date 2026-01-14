import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { PermissionType, UserRole, RolePermission } from '../db/models';
import { useAuth } from './useAuth';

/**
 * Hook para gerenciar permissões do sistema
 */
export function usePermissions() {
  const { user } = useAuth();

  // Buscar todas as permissões
  const allPermissions = useLiveQuery(() => 
    db.rolePermissions.toArray()
  ) || [];

  // Buscar permissões do usuário atual
  const userPermissions = useLiveQuery(() => {
    if (!user) return [];
    return db.rolePermissions
      .where('role')
      .equals(user.role)
      .and(p => p.granted === true)
      .toArray();
  }, [user]) || [];

  /**
   * Verifica se o usuário atual tem uma permissão específica
   */
  const hasPermission = (permission: PermissionType): boolean => {
    if (!user) return false;
    // Admin sempre tem todas as permissões
    if (user.role === 'admin') return true;
    
    const perm = userPermissions.find(p => p.permission === permission);
    return perm?.granted === true;
  };

  /**
   * Verifica se o usuário atual tem pelo menos uma das permissões
   */
  const hasAnyPermission = (permissions: PermissionType[]): boolean => {
    return permissions.some(perm => hasPermission(perm));
  };

  /**
   * Verifica se o usuário atual tem todas as permissões
   */
  const hasAllPermissions = (permissions: PermissionType[]): boolean => {
    return permissions.every(perm => hasPermission(perm));
  };

  /**
   * Busca permissões de uma role específica
   */
  const getRolePermissions = (role: UserRole): RolePermission[] => {
    return allPermissions.filter(p => p.role === role);
  };

  /**
   * Atualiza uma permissão
   */
  const updatePermission = async (
    role: UserRole,
    permission: PermissionType,
    granted: boolean
  ): Promise<void> => {
    const existing = await db.rolePermissions
      .where('[role+permission]')
      .equals([role, permission])
      .first();

    const now = new Date().toISOString();

    if (existing) {
      await db.rolePermissions.update(existing.id, {
        granted,
        updatedAt: now,
        synced: false
      });
    } else {
      const { v4: uuidv4 } = await import('uuid');
      await db.rolePermissions.add({
        id: uuidv4(),
        role,
        permission,
        granted,
        createdAt: now,
        updatedAt: now,
        synced: false,
        remoteId: null
      });
    }
  };

  /**
   * Atualiza múltiplas permissões de uma vez
   */
  const updateRolePermissions = async (
    role: UserRole,
    permissions: Record<PermissionType, boolean>
  ): Promise<void> => {
    const updates = Object.entries(permissions).map(([permission, granted]) =>
      updatePermission(role, permission as PermissionType, granted)
    );
    await Promise.all(updates);
  };

  /**
   * Reseta permissões de uma role para os valores padrão
   */
  const resetRolePermissions = async (role: UserRole): Promise<void> => {
    const defaultPermissions: Record<UserRole, PermissionType[]> = {
      admin: [
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
        'ver_planilha',
        'ver_matrizes',
        'ver_fazendas',
        'ver_usuarios',
        'exportar_dados',
        'gerar_relatorios'
      ],
      gerente: [
        'ver_dashboard',
        'ver_notificacoes',
        'ver_sincronizacao',
        'ver_planilha',
        'ver_matrizes',
        'ver_fazendas',
        'cadastrar_nascimento',
        'editar_nascimento',
        'cadastrar_desmama',
        'editar_desmama',
        'cadastrar_pesagem',
        'editar_pesagem',
        'cadastrar_vacina',
        'editar_vacina',
        'gerenciar_matrizes',
        'exportar_dados',
        'gerar_relatorios'
      ],
      peao: [
        'ver_dashboard',
        'ver_notificacoes',
        'ver_planilha',
        'ver_matrizes',
        'cadastrar_nascimento',
        'cadastrar_desmama',
        'cadastrar_pesagem',
        'cadastrar_vacina'
      ],
      visitante: [
        'ver_dashboard',
        'ver_notificacoes',
        'ver_planilha',
        'ver_matrizes',
        'ver_fazendas'
      ]
    };

    const allPerms: PermissionType[] = [
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
      'ver_planilha',
      'ver_matrizes',
      'ver_fazendas',
      'ver_usuarios',
      'exportar_dados',
      'gerar_relatorios'
    ];

    const rolePerms = defaultPermissions[role];
    const updates = allPerms.map(permission =>
      updatePermission(role, permission, rolePerms.includes(permission))
    );
    await Promise.all(updates);
  };

  return {
    allPermissions,
    userPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    getRolePermissions,
    updatePermission,
    updateRolePermissions,
    resetRolePermissions
  };
}

