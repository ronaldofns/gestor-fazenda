import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { Icons } from '../utils/iconMapping';
import { showToast } from '../utils/toast';
import FazendaModal from '../components/FazendaModal';
import HistoricoAlteracoes from '../components/HistoricoAlteracoes';
import ConfirmDialog from '../components/ConfirmDialog';
import { Fazenda } from '../db/models';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass } from '../utils/themeHelpers';

export default function ListaFazendas() {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const fazendas = useMemo(() => {
    return fazendasRaw.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [fazendasRaw]);

  // Estados do modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [fazendaEditando, setFazendaEditando] = useState<Fazenda | null>(null);
  
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

  const handleNovaFazenda = () => {
    setFazendaEditando(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEditarFazenda = (fazenda: Fazenda) => {
    setFazendaEditando(fazenda);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleFecharModal = () => {
    setModalOpen(false);
    setFazendaEditando(null);
  };

  const handleDelete = async (fazendaId: string, fazendaNome: string) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir fazenda',
      message: `Deseja realmente excluir a fazenda "${fazendaNome}"?`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
      // Verificar se há nascimentos associados a esta fazenda
      const nascimentos = await db.nascimentos.where('fazendaId').equals(fazendaId).toArray();
      
      if (nascimentos.length > 0) {
        showToast({
          type: 'warning',
          title: 'Exclusão bloqueada',
          message: `Existem ${nascimentos.length} nascimento(s) associados a "${fazendaNome}". Exclua os nascimentos antes de excluir a fazenda.`
        });
        return;
      }

      // Verificar se há matrizes associadas a esta fazenda
      const matrizes = await db.matrizes.where('fazendaId').equals(fazendaId).toArray();
      
      if (matrizes.length > 0) {
        showToast({
          type: 'warning',
          title: 'Exclusão bloqueada',
          message: `Existem ${matrizes.length} matriz(es) associadas a "${fazendaNome}". Exclua as matrizes antes de excluir a fazenda.`
        });
        return;
      }

      // Excluir no servidor se tiver remoteId
      const fazenda = await db.fazendas.get(fazendaId);
      if (fazenda?.remoteId) {
        try {
          const { supabase } = await import('../api/supabaseClient');
          const { error } = await supabase.from('fazendas_online').delete().eq('id', fazenda.remoteId);
          if (error) {
            // Se o erro for de foreign key constraint, informar melhor
            if (error.code === '23503' || error.message?.includes('foreign key')) {
              showToast({
                type: 'warning',
                title: 'Exclusão bloqueada no servidor',
                message: 'Ainda existem registros associados a esta fazenda no servidor.'
              });
              return;
            }
            console.warn('Erro ao excluir fazenda no servidor:', error);
          }
        } catch (err) {
          console.warn('Erro ao excluir fazenda no servidor:', err);
        }
      }

          // Excluir localmente
          await db.fazendas.delete(fazendaId);
          showToast({ type: 'success', title: 'Fazenda excluída', message: fazendaNome });
        } catch (error) {
          console.error('Erro ao excluir fazenda:', error);
          showToast({
            type: 'error',
            title: 'Erro ao excluir',
            message: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        }
      }
    });
  };

  return (
    <div className="p-4 sm:p-4 text-gray-900 dark:text-slate-100">
      <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg overflow-hidden">
        {fazendas.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
            Nenhuma fazenda cadastrada ainda.
            <button
              type="button"
              onClick={handleNovaFazenda}
              className="ml-2 text-green-600 hover:text-green-800 dark:hover:text-green-400 underline"
            >
              Cadastrar primeira fazenda
            </button>
          </div>
        ) : (
          <>
            {/* Tabela Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                <thead className="bg-gray-100 dark:bg-slate-800">
              <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Nome
                </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Status
                </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
              {fazendas.map((fazenda) => (
                    <tr key={fazenda.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      {fazenda.logoUrl && (
                        <img 
                          src={fazenda.logoUrl} 
                          alt={fazenda.nome}
                          className="w-8 h-8 rounded-full mr-3 object-cover"
                        />
                      )}
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{fazenda.nome}</span>
                    </div>
                  </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-slate-300">
                    {fazenda.synced ? (
                      <span className="text-green-600">Sincronizado</span>
                    ) : (
                      <span className="text-yellow-600">Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                            onClick={() => handleEditarFazenda(fazenda)}
                            className="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-900 transition-colors"
                            title="Editar fazenda"
                          >
                            <Icons.Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setHistoricoEntityId(fazenda.id);
                              setHistoricoOpen(true);
                            }}
                            className="text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-900 transition-colors"
                            title="Ver histórico de alterações"
                          >
                            <Icons.History className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(fazenda.id, fazenda.nome)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-900 transition-colors"
                            title="Excluir fazenda"
                          >
                            <Icons.Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lista em cards para mobile */}
            <div className="md:hidden space-y-3 p-3">
              {fazendas.map((fazenda) => (
                <div
                  key={fazenda.id}
                  className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center min-w-0">
                      {fazenda.logoUrl && (
                        <img
                          src={fazenda.logoUrl}
                          alt={fazenda.nome}
                          className="w-8 h-8 rounded-full mr-3 object-cover flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                          {fazenda.nome}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          {fazenda.synced ? 'Sincronizado' : 'Pendente'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <button
                        onClick={() => handleEditarFazenda(fazenda)}
                        className="p-1.5 text-green-600 hover:bg-green-50 hover:text-green-900 dark:hover:bg-green-900/30 rounded-full transition-colors"
                        title="Editar fazenda"
                      >
                        <Icons.Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setHistoricoEntityId(fazenda.id);
                          setHistoricoOpen(true);
                        }}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 hover:text-purple-900 dark:hover:bg-purple-900/30 rounded-full transition-colors"
                        title="Ver histórico"
                      >
                        <Icons.History className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(fazenda.id, fazenda.nome)}
                        className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-900 dark:hover:bg-red-900/30 rounded-full transition-colors"
                        title="Excluir fazenda"
                      >
                        <Icons.Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <FazendaModal
        open={modalOpen}
        mode={modalMode}
        initialData={fazendaEditando}
        onClose={handleFecharModal}
        onSaved={() => {
          // Dados serão atualizados automaticamente pelo useLiveQuery
        }}
      />

      {/* Modal Histórico de Alterações */}
      {historicoEntityId && (
        <HistoricoAlteracoes
          open={historicoOpen}
          entity="fazenda"
          entityId={historicoEntityId}
          entityNome={fazendas.find(f => f.id === historicoEntityId)?.nome}
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
      <button
          type="button"
          onClick={handleNovaFazenda}
        className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-3 ${getPrimaryButtonClass(primaryColor)} text-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all shadow-lg hover:shadow-xl hover:scale-105`}
        title="Nova Fazenda"
        aria-label="Nova Fazenda"
      >
        <Icons.Plus className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Nova Fazenda</span>
      </button>
    </div>
  );
}
