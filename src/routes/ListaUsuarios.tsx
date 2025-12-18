import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/dexieDB';
import { Usuario, UserRole } from '../db/models';
import { deleteUser, updateUser } from '../utils/auth';
import { showToast } from '../utils/toast';
import { Edit, Trash2, Plus, UserCheck, UserX } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

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

  const handleToggleAtivo = async (usuario: Usuario) => {
    if (!confirm(`Deseja ${usuario.ativo ? 'desativar' : 'ativar'} o usuário ${usuario.nome}?`)) {
      return;
    }

    try {
      await updateUser(usuario.id, { ativo: !usuario.ativo });
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      showToast({ type: 'error', title: 'Erro ao atualizar usuário', message: 'Tente novamente.' });
    }
  };

  const handleDelete = async (usuario: Usuario) => {
    if (usuario.id === currentUser?.id) {
      showToast({ type: 'warning', title: 'Ação bloqueada', message: 'Você não pode excluir seu próprio usuário.' });
      return;
    }

    if (!confirm(`Deseja realmente excluir o usuário ${usuario.nome}?`)) {
      return;
    }

    try {
      await deleteUser(usuario.id);
      showToast({ type: 'success', title: 'Usuário excluído', message: usuario.nome });
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      showToast({ type: 'error', title: 'Erro ao excluir usuário', message: 'Tente novamente.' });
    }
  };

  const getFazendaNome = (fazendaId?: string) => {
    if (!fazendaId) return '-';
    const fazenda = fazendas.find(f => f.id === fazendaId);
    return fazenda?.nome || '-';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-gray-200 dark:border-slate-800">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-slate-100">Usuários</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">Gerenciar usuários do sistema</p>
            </div>
            <Link
              to="/novo-usuario"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Novo Usuário
            </Link>
          </div>
        </div>
      </header>

      <main className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
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
                              <UserCheck className="w-3 h-3 mr-1" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              <UserX className="w-3 h-3 mr-1" />
                              Inativo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              to={`/editar-usuario/${usuario.id}`}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                              title="Editar usuário"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
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
                                <Trash2 className="w-4 h-4" />
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
                              <UserCheck className="w-3 h-3 mr-1" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              <UserX className="w-3 h-3 mr-1" />
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
                        <Link
                          to={`/editar-usuario/${usuario.id}`}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                          title="Editar usuário"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
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
      </main>
    </div>
  );
}

