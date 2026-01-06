import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { Usuario, UserRole } from '../db/models';
import { deleteUser, updateUser } from '../utils/auth';
import { showToast } from '../utils/toast';
import { Icons } from '../utils/iconMapping';
import { useAuth } from '../hooks/useAuth';
import UsuarioModal from '../components/UsuarioModal';
import HistoricoAlteracoes from '../components/HistoricoAlteracoes';
import ConfirmDialog from '../components/ConfirmDialog';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  peao: 'Peão',
  visitante: 'Visitante'
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-800',
  gerente: 'bg-blue-100 text-blue-800',
  peao: 'bg-green-100 text-green-800',
  visitante: 'bg-gray-100 text-gray-800'
};

export default function ListaUsuarios() {
  const { user: currentUser } = useAuth();
  const usuarios = useLiveQuery(() => db.usuarios.toArray(), []) || [];
  const fazendas = useLiveQuery(() => db.fazendas.toArray(), []) || [];

  // Estados do modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [usuarioEditando, setUsuarioEditando] = useState<{ id: string } | null>(null);
  
  // Estados do histórico
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoEntityId, setHistoricoEntityId] = useState<string | null>(null);
  
  // Estado do modal de confirmação
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    onConfirm: () => {}
  });

  const handleNovoUsuario = () => {
    setUsuarioEditando(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEditarUsuario = (usuario: Usuario) => {
    setUsuarioEditando({ id: usuario.id });
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleFecharModal = () => {
    setModalOpen(false);
    setUsuarioEditando(null);
  };

  const handleToggleAtivo = async (usuario: Usuario) => {
    setConfirmDialog({
      open: true,
      title: usuario.ativo ? 'Desativar usuário' : 'Ativar usuário',
      message: `Deseja ${usuario.ativo ? 'desativar' : 'ativar'} o usuário ${usuario.nome}?`,
      variant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          await updateUser(usuario.id, { ativo: !usuario.ativo });
        } catch (error) {
          console.error('Erro ao atualizar usuário:', error);
          showToast({ type: 'error', title: 'Erro ao atualizar usuário', message: 'Tente novamente.' });
        }
      }
    });
  };

  const handleDelete = async (usuario: Usuario) => {
    if (usuario.id === currentUser?.id) {
      showToast({ type: 'warning', title: 'Ação bloqueada', message: 'Você não pode excluir seu próprio usuário.' });
      return;
    }

    setConfirmDialog({
      open: true,
      title: 'Excluir usuário',
      message: `Deseja realmente excluir o usuário ${usuario.nome}?`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          await deleteUser(usuario.id);
          showToast({ type: 'success', title: 'Usuário excluído', message: usuario.nome });
        } catch (error) {
          console.error('Erro ao excluir usuário:', error);
          showToast({ type: 'error', title: 'Erro ao excluir usuário', message: 'Tente novamente.' });
        }
      }
    });
  };

  const getFazendaNome = (fazendaId?: string) => {
    if (!fazendaId) return '-';
    const fazenda = fazendas.find(f => f.id === fazendaId);
    return fazenda?.nome || '-';
  };

  return (
    <div className="p-4 sm:p-6 text-gray-900 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold">Usuários</h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
            Gerenciar usuários do sistema
          </p>
        </div>
        <button
          type="button"
          onClick={handleNovoUsuario}
          className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
        >
          <Icons.Plus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>
      <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg overflow-hidden">
          {usuarios.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
              Nenhum usuário cadastrado ainda.
            </div>
          ) : (
            <>
              {/* Tabela Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                  <thead className="bg-gray-100 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Nome</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Fazenda</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                    {usuarios.map((usuario) => (
                      <tr key={usuario.id} className={!usuario.ativo ? 'bg-gray-50 dark:bg-slate-800/60 opacity-60' : ''}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">
                          {usuario.nome}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200">
                          {usuario.email}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ROLE_COLORS[usuario.role]}`}>
                            {ROLE_LABELS[usuario.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200">
                          {getFazendaNome(usuario.fazendaId)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {usuario.ativo ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              <Icons.UserCheck className="w-3 h-3 mr-1" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              <Icons.UserX className="w-3 h-3 mr-1" />
                              Inativo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditarUsuario(usuario)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                              title="Editar usuário"
                            >
                              <Icons.Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setHistoricoEntityId(usuario.id);
                                setHistoricoOpen(true);
                              }}
                              className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
                              title="Ver histórico"
                            >
                              <Icons.History className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleAtivo(usuario)}
                              className={`p-1.5 rounded transition-colors ${
                                usuario.ativo
                                  ? 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50'
                                  : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                              }`}
                              title={usuario.ativo ? 'Desativar usuário' : 'Ativar usuário'}
                            >
                              {usuario.ativo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                            {usuario.id !== currentUser?.id && (
                              <button
                                onClick={() => handleDelete(usuario)}
                                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                title="Excluir usuário"
                              >
                                <Icons.Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Lista em cards para mobile */}
              <div className="md:hidden space-y-3 p-3">
                {usuarios.map((usuario) => (
                  <div
                    key={usuario.id}
                    className={`bg-white dark:bg-slate-900 rounded-lg shadow-sm p  -4 border border-gray-200 dark:border-slate-800 ${
                      !usuario.ativo ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                          {usuario.nome}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 break-words">
                          {usuario.email}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ROLE_COLORS[usuario.role]}`}>
                            {ROLE_LABELS[usuario.role]}
                          </span>
                          <span className="text-gray-500 dark:text-slate-400">
                            {getFazendaNome(usuario.fazendaId)}
                          </span>
                        </div>
                        <div className="mt-1">
                          {usuario.ativo ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              <Icons.UserCheck className="w-3 h-3 mr-1" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              <Icons.UserX className="w-3 h-3 mr-1" />
                              Inativo
                            </span>
                          )}
                        </div>
                      </div>
                    <div className="flex flex-shrink-0 flex-col gap-1 items-end">
                      <button
                        onClick={() => handleToggleAtivo(usuario)}
                        className={`p-1.5 rounded-full transition-colors ${
                          usuario.ativo
                            ? 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50'
                            : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                        }`}
                        title={usuario.ativo ? 'Desativar usuário' : 'Ativar usuário'}
                      >
                        {usuario.ativo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                        <button
                          type="button"
                          onClick={() => handleEditarUsuario(usuario)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                          title="Editar usuário"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHistoricoEntityId(usuario.id);
                            setHistoricoOpen(true);
                          }}
                          className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-full transition-colors"
                          title="Ver histórico"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        {usuario.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDelete(usuario)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                            title="Excluir usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
      </div>

      <UsuarioModal
        open={modalOpen}
        mode={modalMode}
        initialData={usuarioEditando}
        onClose={handleFecharModal}
        onSaved={() => {
          // Dados serão atualizados automaticamente pelo useLiveQuery
        }}
      />

      {/* Modal Histórico de Alterações */}
      {historicoEntityId && (
        <HistoricoAlteracoes
          open={historicoOpen}
          entity="usuario"
          entityId={historicoEntityId}
          entityNome={usuarios.find(u => u.id === historicoEntityId)?.nome}
          onClose={() => {
            setHistoricoOpen(false);
            setHistoricoEntityId(null);
          }}
          onRestored={() => {
            // Dados serão atualizados automaticamente pelo useLiveQuery
          }}
        />
      )}

      {/* Modal de Confirmação */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}

