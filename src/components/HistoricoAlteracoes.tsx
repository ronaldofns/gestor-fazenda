import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { AuditLog, AuditEntity } from '../db/models';
import Modal from './Modal';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass } from '../utils/themeHelpers';
import { showToast } from '../utils/toast';
import { useAuth } from '../hooks/useAuth';
import { registrarAudit } from '../utils/audit';
import ConfirmDialog from './ConfirmDialog';

interface HistoricoAlteracoesProps {
  open: boolean;
  entity: AuditEntity;
  entityId: string;
  entityNome?: string; // Nome/identificador do registro para exibição
  onClose: () => void;
  onRestored?: () => void;
}

export default function HistoricoAlteracoes({
  open,
  entity,
  entityId,
  entityNome,
  onClose,
  onRestored
}: HistoricoAlteracoesProps) {
  const { user } = useAuth();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [mostrarDiff, setMostrarDiff] = useState<string | null>(null);
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

  // Buscar histórico de alterações
  const historico = useLiveQuery(
    async () => {
      const todos = await db.audits.toArray();
      return todos.filter(a => a.entity === entity && a.entityId === entityId);
    },
    [entity, entityId]
  ) || [];

  const historicoOrdenado = useMemo(() => {
    return [...historico].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [historico]);

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create': return 'Criado';
      case 'update': return 'Atualizado';
      case 'delete': return 'Excluído';
      default: return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'update': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'delete': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatarData = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const parseSnapshot = (snapshot: string | null) => {
    if (!snapshot) return null;
    try {
      return JSON.parse(snapshot);
    } catch {
      return null;
    }
  };

  const getDiff = (before: any, after: any) => {
    if (!before || !after) return null;
    
    const diff: Array<{ campo: string; antes: any; depois: any }> = [];
    
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    allKeys.forEach(key => {
      // Ignorar campos internos
      if (['id', 'createdAt', 'updatedAt', 'synced', 'remoteId'].includes(key)) {
        return;
      }
      
      const valorAntes = before[key];
      const valorDepois = after[key];
      
      if (JSON.stringify(valorAntes) !== JSON.stringify(valorDepois)) {
        diff.push({
          campo: key,
          antes: valorAntes,
          depois: valorDepois
        });
      }
    });
    
    return diff;
  };

  const handleRestaurar = async (auditId: string) => {
    const audit = historicoOrdenado.find(a => a.id === auditId);
    if (!audit || !audit.before) {
      showToast({ type: 'warning', title: 'Não é possível restaurar', message: 'Versão anterior não disponível.' });
      return;
    }

    setConfirmDialog({
      open: true,
      title: 'Restaurar versão',
      message: 'Deseja realmente restaurar esta versão? Os dados atuais serão substituídos.',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setRestaurandoId(auditId);
    try {
      const snapshot = parseSnapshot(audit.before);
      if (!snapshot) {
        throw new Error('Snapshot inválido');
      }

      // Buscar estado atual ANTES de restaurar para registrar na auditoria
      let estadoAtual: any = null;
      try {
        switch (entity) {
          case 'nascimento':
            estadoAtual = await db.nascimentos.get(entityId);
            break;
          case 'fazenda':
            estadoAtual = await db.fazendas.get(entityId);
            break;
          case 'matriz':
            estadoAtual = await db.matrizes.get(entityId);
            break;
          case 'desmama':
            estadoAtual = await db.desmamas.get(entityId);
            break;
        }
      } catch (err) {
        console.warn('Erro ao buscar estado atual para auditoria:', err);
      }

      // Remover campos que não devem ser restaurados
      const { id, createdAt, updatedAt, synced, remoteId, ...dadosRestaurar } = snapshot;
      
      // Atualizar o registro
      const now = new Date().toISOString();
      
      switch (entity) {
        case 'nascimento':
          await db.nascimentos.update(entityId, {
            ...dadosRestaurar,
            updatedAt: now,
            synced: false
          });
          break;
        case 'fazenda':
          await db.fazendas.update(entityId, {
            ...dadosRestaurar,
            updatedAt: now,
            synced: false
          });
          break;
        case 'matriz':
          await db.matrizes.update(entityId, {
            ...dadosRestaurar,
            updatedAt: now,
            synced: false
          });
          break;
        case 'usuario':
          // Usuários precisam de tratamento especial (senha hash)
          showToast({ type: 'warning', title: 'Restauração de usuário', message: 'Restauração de usuários requer atenção especial. Use a edição manual.' });
          setRestaurandoId(null);
          return;
        case 'desmama':
          await db.desmamas.update(entityId, {
            ...dadosRestaurar,
            updatedAt: now,
            synced: false
          });
          break;
        default:
          throw new Error(`Tipo de entidade não suportado: ${entity}`);
      }

      // Registrar a restauração como uma nova auditoria
      await registrarAudit({
        entity,
        entityId,
        action: 'update',
        before: estadoAtual, // Estado atual antes da restauração
        after: { ...dadosRestaurar, updatedAt: now }, // Estado restaurado
        user: user ? { id: user.id, nome: user.nome } : null,
        description: `Restauração da versão de ${formatarData(audit.timestamp)}`
      });

        showToast({ type: 'success', title: 'Versão restaurada', message: 'Os dados foram restaurados com sucesso.' });
        onRestored?.();
      } catch (error: any) {
        console.error('Erro ao restaurar:', error);
        showToast({ type: 'error', title: 'Erro ao restaurar', message: error?.message || 'Tente novamente.' });
      } finally {
        setRestaurandoId(null);
      }
      }
    });
  };

  const formatarValor = (valor: any): string => {
    if (valor === null || valor === undefined) return '-';
    if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
    if (typeof valor === 'object') return JSON.stringify(valor);
    return String(valor);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Histórico de Alterações
            </h2>
            {entityNome && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                {entityNome}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {historicoOrdenado.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-slate-400">
              <Icons.Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma alteração registrada para este item.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {historicoOrdenado.map((audit, index) => {
                const before = parseSnapshot(audit.before);
                const after = parseSnapshot(audit.after);
                const diff = audit.action === 'update' ? getDiff(before, after) : null;
                const isMostrandoDiff = mostrarDiff === audit.id;

                return (
                  <div
                    key={audit.id}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-gray-50 dark:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(audit.action)}`}>
                            {getActionLabel(audit.action)}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-slate-400">
                            {formatarData(audit.timestamp)}
                          </span>
                        </div>

                        {audit.userNome && (
                          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-slate-400 mb-2">
                            <Icons.User className="w-4 h-4" />
                            <span>{audit.userNome}</span>
                          </div>
                        )}

                        {audit.description && (
                          <p className="text-sm text-gray-700 dark:text-slate-300 mb-2">
                            {audit.description}
                          </p>
                        )}

                        {diff && diff.length > 0 && (
                          <div className="mt-3">
                            <button
                              onClick={() => setMostrarDiff(isMostrandoDiff ? null : audit.id)}
                              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                              <Icons.Eye className="w-4 h-4" />
                              {isMostrandoDiff ? 'Ocultar' : 'Mostrar'} alterações ({diff.length})
                            </button>

                            {isMostrandoDiff && (
                              <div className="mt-2 space-y-2 bg-white dark:bg-slate-900 rounded-md p-3 border border-gray-200 dark:border-slate-700">
                                {diff.map((change, idx) => (
                                  <div key={idx} className="text-sm">
                                    <div className="font-medium text-gray-900 dark:text-slate-100 mb-1">
                                      {change.campo}:
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                        <div className="text-red-700 dark:text-red-300 font-medium">Antes:</div>
                                        <div className="text-red-600 dark:text-red-400">{formatarValor(change.antes)}</div>
                                      </div>
                                      <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                                        <div className="text-green-700 dark:text-green-300 font-medium">Depois:</div>
                                        <div className="text-green-600 dark:text-green-400">{formatarValor(change.depois)}</div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {audit.action === 'update' && audit.before && index > 0 && (
                        <button
                          onClick={() => handleRestaurar(audit.id)}
                          disabled={restaurandoId === audit.id}
                          className={`flex items-center gap-1 px-3 py-1.5 text-sm ${getPrimaryButtonClass(primaryColor)} text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                          title="Restaurar esta versão"
                        >
                          <Icons.RotateCcw className="w-4 h-4" />
                          {restaurandoId === audit.id ? 'Restaurando...' : 'Restaurar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </Modal>
  );
}

