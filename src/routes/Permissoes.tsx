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
import ConfirmDialog from '../components/ConfirmDialog';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  peao: 'Peão',
  visitante: 'Visitante'
};

const PERMISSION_LABELS: Record<PermissionType, string> = {
  gerenciar_usuarios: 'Gerenciar Usuários',
  gerenciar_fazendas: 'Gerenciar Fazendas',
  gerenciar_racas: 'Gerenciar Raças',
  gerenciar_categorias: 'Gerenciar Categorias',
  cadastrar_animal: 'Cadastrar Animal',
  editar_animal: 'Editar Animal',
  excluir_animal: 'Excluir Animal',
  cadastrar_desmama: 'Cadastrar Desmama',
  editar_desmama: 'Editar Desmama',
  excluir_desmama: 'Excluir Desmama',
  cadastrar_pesagem: 'Cadastrar Pesagem',
  editar_pesagem: 'Editar Pesagem',
  excluir_pesagem: 'Excluir Pesagem',
  cadastrar_vacina: 'Cadastrar Vacinação',
  editar_vacina: 'Editar Vacinação',
  excluir_vacina: 'Excluir Vacinação',
  ver_dashboard: 'Ver Dashboard',
  ver_notificacoes: 'Ver Notificações',
  ver_sincronizacao: 'Ver Sincronização',
  ver_fazendas: 'Ver Fazendas',
  ver_usuarios: 'Ver Usuários',
  ver_planilha: 'Ver Animais',
  ver_confinamentos: 'Ver Confinamentos',
  exportar_dados: 'Exportar Dados',
  gerar_relatorios: 'Gerar Relatórios'
};

const PERMISSION_GROUPS: Record<string, PermissionType[]> = {
  'Visualização': ['ver_dashboard', 'ver_notificacoes', 'ver_sincronizacao', 'ver_planilha', 'ver_confinamentos', 'ver_fazendas', 'ver_usuarios'],
  'Gerenciamento': ['gerenciar_usuarios', 'gerenciar_fazendas', 'gerenciar_racas', 'gerenciar_categorias'],
  'Animais': ['cadastrar_animal', 'editar_animal', 'excluir_animal'],
  'Desmamas': ['cadastrar_desmama', 'editar_desmama', 'excluir_desmama'],
  'Pesagens': ['cadastrar_pesagem', 'editar_pesagem', 'excluir_pesagem'],
  'Vacinações': ['cadastrar_vacina', 'editar_vacina', 'excluir_vacina'],
  'Dados e Relatórios': ['exportar_dados', 'gerar_relatorios']
};

export default function Permissoes() {
  const { isAdmin } = useAuth();
  const { allPermissions, getRolePermissions, updatePermission, resetRolePermissions } = usePermissions();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [saving, setSaving] = useState(false);

  // Confirm Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

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
      // Não sincronizar imediatamente - deixar para sincronização automática ou manual
      // Isso melhora muito o desempenho
      showToast({
        type: 'success',
        title: 'Permissão atualizada',
        message: `Permissão "${PERMISSION_LABELS[permission]}" ${newGranted ? 'incluída' : 'removida'} para ${ROLE_LABELS[selectedRole]}.`
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
    setConfirmDialog({
      open: true,
      title: 'Resetar Permissões',
      message: `Deseja realmente resetar todas as permissões de ${ROLE_LABELS[selectedRole]} para os valores padrão?`,
      onConfirm: async () => {
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
          setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} });
        }
      }
    });
  };

  const handleSelectAll = async (granted: boolean) => {
    setSaving(true);
    try {
      const allPerms: PermissionType[] = Object.values(PERMISSION_GROUPS).flat();
      // Usar batch update para melhor performance
      await Promise.all(
        allPerms.map(permission => updatePermission(selectedRole, permission, granted))
      );
      // Sincronizar apenas uma vez após todas as atualizações
      await pushPending();
      showToast({
        type: 'success',
        title: granted ? 'Todas incluídas' : 'Todas removidas',
        message: `Todas as permissões foram ${granted ? 'incluídas' : 'removidas'} para ${ROLE_LABELS[selectedRole]}.`
      });
    } catch (error) {
      console.error('Erro ao atualizar permissões:', error);
      showToast({
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível atualizar as permissões.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectGroup = async (groupPermissions: PermissionType[], granted: boolean) => {
    setSaving(true);
    try {
      // Atualizar todas as permissões do grupo em paralelo
      await Promise.all(
        groupPermissions.map(permission => updatePermission(selectedRole, permission, granted))
      );
      // Sincronizar apenas uma vez após todas as atualizações do grupo
      await pushPending();
      showToast({
        type: 'success',
        title: granted ? 'Grupo incluído' : 'Grupo removido',
        message: `Todas as permissões do grupo foram ${granted ? 'incluídas' : 'removidas'} para ${ROLE_LABELS[selectedRole]}.`
      });
    } catch (error) {
      console.error('Erro ao atualizar permissões do grupo:', error);
      showToast({
        type: 'error',
        title: 'Erro',
        message: 'Não foi possível atualizar as permissões do grupo.'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-full overflow-x-hidden">

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

      {/* Botões de Ação Global: Incluir e Remover */}
      <div className="mb-6 flex flex-wrap gap-2 justify-between items-center">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSelectAll(true)}
            disabled={saving}
            className={`px-4 py-2 ${getPrimaryBgClass(primaryColor)} hover:opacity-90 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            <Icons.Check className="w-4 h-4" />
            Incluir Todas
          </button>
          <button
            onClick={() => handleSelectAll(false)}
            disabled={saving}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Icons.X className="w-4 h-4" />
            Remover Todas
          </button>
        </div>
        <button
          onClick={handleResetRole}
          disabled={saving}
          title="Resetar para Padrão"
          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Icons.RefreshCw className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Resetar para Padrão</span>
        </button>
      </div>

      {/* Lista de Permissões por Grupo */}
      <div className="space-y-6">
        {Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => {
          const groupPermissions = permissions.map(p => permissionsMap.get(p));
          const allGranted = groupPermissions.every(p => p?.granted === true);
          const someGranted = groupPermissions.some(p => p?.granted === true);
          
          return (
          <div key={groupName} className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">
                {groupName}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSelectGroup(permissions, true)}
                  disabled={saving || allGranted}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 ${
                    allGranted
                      ? 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                      : `${getThemeClasses(primaryColor, 'bg')} text-white hover:opacity-90`
                  }`}
                  title="Incluir todas do grupo"
                >
                  <Icons.Check className="w-3 h-3" />
                  Incluir
                </button>
                <button
                  onClick={() => handleSelectGroup(permissions, false)}
                  disabled={saving || !someGranted}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 ${
                    !someGranted
                      ? 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
                      : 'bg-gray-600 hover:bg-gray-700 text-white'
                  }`}
                  title="Remover todas do grupo"
                >
                  <Icons.X className="w-3 h-3" />
                  Remover
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {permissions.map((permission) => {
                const perm = permissionsMap.get(permission);
                const granted = perm?.granted ?? false;

                return (
                  <div
                    key={permission}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors gap-2"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                      {PERMISSION_LABELS[permission]}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => !granted && handleTogglePermission(permission)}
                        disabled={saving || granted}
                        className={`px-2 py-1 text-xs font-medium rounded ${granted ? 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400 cursor-default' : `${getThemeClasses(primaryColor, 'bg')} text-white hover:opacity-90`} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title="Incluir permissão"
                      >
                        Incluir
                      </button>
                      <button
                        type="button"
                        onClick={() => granted && handleTogglePermission(permission)}
                        disabled={saving || !granted}
                        className={`px-2 py-1 text-xs font-medium rounded ${!granted ? 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400 cursor-default' : 'bg-gray-600 hover:bg-gray-700 text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title="Remover permissão"
                      >
                        Remover
                      </button>
                      <input
                        type="checkbox"
                        checked={granted}
                        onChange={() => handleTogglePermission(permission)}
                        disabled={saving}
                        className={`w-5 h-5 ${getThemeClasses(primaryColor, 'text')} rounded ${getThemeClasses(primaryColor, 'ring')} focus:ring-2`}
                        title={granted ? 'Remover permissão' : 'Incluir permissão'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant="warning"
        confirmText="Resetar"
        cancelText="Cancelar"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: () => {} })}
      />
    </div>
  );
}

