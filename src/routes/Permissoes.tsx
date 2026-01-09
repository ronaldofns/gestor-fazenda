import { useState } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { UserRole, PermissionType } from '../db/models';
import { Icons } from '../utils/iconMapping';
import { showToast } from '../utils/toast';
import { useAuth } from '../hooks/useAuth';
import { pushPending } from '../api/syncService';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryBgClass, getThemeClasses } from '../utils/themeHelpers';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  peao: 'Peão',
  visitante: 'Visitante'
};

const PERMISSION_LABELS: Record<PermissionType, string> = {
  importar_planilha: 'Importar Planilha',
  gerenciar_usuarios: 'Gerenciar Usuários',
  gerenciar_fazendas: 'Gerenciar Fazendas',
  gerenciar_matrizes: 'Gerenciar Matrizes',
  gerenciar_racas: 'Gerenciar Raças',
  gerenciar_categorias: 'Gerenciar Categorias',
  cadastrar_nascimento: 'Cadastrar Nascimento',
  editar_nascimento: 'Editar Nascimento',
  excluir_nascimento: 'Excluir Nascimento',
  cadastrar_desmama: 'Cadastrar Desmama',
  editar_desmama: 'Editar Desmama',
  excluir_desmama: 'Excluir Desmama',
  ver_dashboard: 'Ver Dashboard',
  ver_notificacoes: 'Ver Notificações',
  exportar_dados: 'Exportar Dados',
  gerar_relatorios: 'Gerar Relatórios'
};

const PERMISSION_GROUPS: Record<string, PermissionType[]> = {
  'Importação e Dados': ['importar_planilha', 'exportar_dados', 'gerar_relatorios'],
  'Gerenciamento': ['gerenciar_usuarios', 'gerenciar_fazendas', 'gerenciar_matrizes', 'gerenciar_racas', 'gerenciar_categorias'],
  'Nascimentos': ['cadastrar_nascimento', 'editar_nascimento', 'excluir_nascimento'],
  'Desmamas': ['cadastrar_desmama', 'editar_desmama', 'excluir_desmama'],
  'Visualização': ['ver_dashboard', 'ver_notificacoes']
};

export default function Permissoes() {
  const { isAdmin } = useAuth();
  const { allPermissions, getRolePermissions, updatePermission, resetRolePermissions } = usePermissions();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [saving, setSaving] = useState(false);

  // Verificar se o usuário é admin
  if (!isAdmin()) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/40 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            Apenas administradores podem gerenciar permissões.
          </p>
        </div>
      </div>
    );
  }

  const rolePermissions = getRolePermissions(selectedRole);
  const permissionsMap = new Map(rolePermissions.map(p => [p.permission, p]));

  const handleTogglePermission = async (permission: PermissionType) => {
    const current = permissionsMap.get(permission);
    const newGranted = !current?.granted;
    
    setSaving(true);
    try {
      await updatePermission(selectedRole, permission, newGranted);
      await pushPending();
      showToast({
        type: 'success',
        title: 'Permissão atualizada',
        message: `Permissão "${PERMISSION_LABELS[permission]}" ${newGranted ? 'concedida' : 'revogada'} para ${ROLE_LABELS[selectedRole]}.`
      });
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      showToast({
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível atualizar a permissão.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetRole = async () => {
    if (!confirm(`Deseja realmente resetar todas as permissões de ${ROLE_LABELS[selectedRole]} para os valores padrão?`)) {
      return;
    }

    setSaving(true);
    try {
      await resetRolePermissions(selectedRole);
      await pushPending();
      showToast({
        type: 'success',
        title: 'Permissões resetadas',
        message: `Permissões de ${ROLE_LABELS[selectedRole]} foram resetadas para os valores padrão.`
      });
    } catch (error) {
      console.error('Erro ao resetar permissões:', error);
      showToast({
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível resetar as permissões.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">

      {/* Seletor de Role */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
          Selecionar Role:
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedRole === role
                  ? `${getPrimaryBgClass(primaryColor)} text-white`
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
      </div>

      {/* Botão Resetar */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={handleResetRole}
          disabled={saving}
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Icons.RefreshCw className="w-4 h-4" />
          Resetar para Padrão
        </button>
      </div>

      {/* Lista de Permissões por Grupo */}
      <div className="space-y-6">
        {Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => (
          <div key={groupName} className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {groupName}
            </h3>
            <div className="space-y-2">
              {permissions.map((permission) => {
                const perm = permissionsMap.get(permission);
                const granted = perm?.granted ?? false;

                return (
                  <label
                    key={permission}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {PERMISSION_LABELS[permission]}
                    </span>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={granted}
                        onChange={() => handleTogglePermission(permission)}
                        disabled={saving}
                        className={`w-5 h-5 ${getThemeClasses(primaryColor, 'text')} rounded ${getThemeClasses(primaryColor, 'ring')} focus:ring-2`}
                      />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

