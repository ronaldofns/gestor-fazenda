import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import useOnline from '../hooks/useOnline';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getPrimaryCardClass, getTitleTextClass } from '../utils/themeHelpers';
import { Icons } from '../utils/iconMapping';
import { syncAll } from '../api/syncService';
import { showToast } from '../utils/toast';
import { setGlobalSyncing, getGlobalSyncing } from '../components/Sidebar';
import { getSyncQueueStats } from '../utils/syncEvents';

interface PendenciaTabela {
  nome: string;
  quantidade: number;
  icone: any;
  detalhes?: Array<{
    id: string;
    dataPesagem?: string;
    peso?: number;
    nascimentoId?: string;
    observacao?: string;
    [key: string]: any;
  }>;
}

interface SyncLog {
  timestamp: string;
  sucesso: boolean;
  erro?: string;
  detalhes?: string;
}

const STORAGE_KEY_LAST_SYNC = 'lastSyncTimestamp';
const STORAGE_KEY_SYNC_LOGS = 'syncLogs';
const MAX_LOGS = 20;

export default function Sincronizacao() {
  const online = useOnline();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [syncing, setSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SYNC_LOGS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Buscar pendências de cada tabela
  const todasTabelas = useLiveQuery(async () => {
    const pendencias: PendenciaTabela[] = [];

    try {
      // Fazendas
      const fazendas = await db.fazendas.toArray();
      const pendFazendas = fazendas.filter(f => f.synced === false).length;
      if (pendFazendas > 0) {
        pendencias.push({
          nome: 'Fazendas',
          quantidade: pendFazendas,
          icone: Icons.Building2
        });
      }
    } catch (err) {
      console.error('Erro ao contar fazendas:', err);
    }

    try {
      // Raças
      const racas = await db.racas.toArray();
      const pendRacas = racas.filter(r => r.synced === false).length;
      if (pendRacas > 0) {
        pendencias.push({
          nome: 'Raças',
          quantidade: pendRacas,
          icone: Icons.Tag
        });
      }
    } catch (err) {
      console.error('Erro ao contar raças:', err);
    }

    try {
      // Categorias
      const categorias = await db.categorias.toArray();
      const pendCategorias = categorias.filter(c => c.synced === false).length;
      if (pendCategorias > 0) {
        pendencias.push({
          nome: 'Categorias',
          quantidade: pendCategorias,
          icone: Icons.Folder
        });
      }
    } catch (err) {
      console.error('Erro ao contar categorias:', err);
    }

    try {
      // Nascimentos
      const nascimentos = await db.nascimentos.toArray();
      const pendNascimentos = nascimentos.filter(n => n.synced === false).length;
      if (pendNascimentos > 0) {
        pendencias.push({
          nome: 'Nascimentos',
          quantidade: pendNascimentos,
          icone: Icons.Baby
        });
      }
    } catch (err) {
      console.error('Erro ao contar nascimentos:', err);
    }

    try {
      // Desmamas
      const desmamas = await db.desmamas.toArray();
      const pendDesmamas = desmamas.filter(d => d.synced === false).length;
      if (pendDesmamas > 0) {
        pendencias.push({
          nome: 'Desmamas',
          quantidade: pendDesmamas,
          icone: Icons.Scale
        });
      }
    } catch (err) {
      console.error('Erro ao contar desmamas:', err);
    }

    try {
      // Matrizes
      const matrizes = await db.matrizes.toArray();
      const pendMatrizes = matrizes.filter(m => m.synced === false).length;
      if (pendMatrizes > 0) {
        pendencias.push({
          nome: 'Matrizes',
          quantidade: pendMatrizes,
          icone: Icons.ListTree
        });
      }
    } catch (err) {
      console.error('Erro ao contar matrizes:', err);
    }

    try {
      // Usuários
      const usuarios = await db.usuarios.toArray();
      const pendUsuarios = usuarios.filter(u => u.synced === false).length;
      if (pendUsuarios > 0) {
        pendencias.push({
          nome: 'Usuários',
          quantidade: pendUsuarios,
          icone: Icons.Users
        });
      }
    } catch (err) {
      console.error('Erro ao contar usuários:', err);
    }

    try {
      // Auditoria
      const audits = await db.audits.toArray();
      const pendAudits = audits.filter(a => a.synced === false).length;
      if (pendAudits > 0) {
        pendencias.push({
          nome: 'Auditoria',
          quantidade: pendAudits,
          icone: Icons.FileText
        });
      }
    } catch (err) {
      console.error('Erro ao contar auditoria:', err);
    }

    try {
      // Notificações Lidas
      const notificacoesLidas = await db.notificacoesLidas.toArray();
      const pendNotificacoes = notificacoesLidas.filter(n => n.synced === false).length;
      if (pendNotificacoes > 0) {
        pendencias.push({
          nome: 'Notificações',
          quantidade: pendNotificacoes,
          icone: Icons.Bell
        });
      }
    } catch (err) {
      console.error('Erro ao contar notificações:', err);
    }

    try {
      // Configurações de Alerta
      const alertSettings = await db.alertSettings.toArray();
      const pendAlertSettings = alertSettings.filter(a => a.synced === false).length;
      if (pendAlertSettings > 0) {
        pendencias.push({
          nome: 'Config. Alertas',
          quantidade: pendAlertSettings,
          icone: Icons.AlertCircle
        });
      }
    } catch (err) {
      console.error('Erro ao contar alert settings:', err);
    }

    try {
      // Configurações do App
      const appSettings = await db.appSettings.toArray();
      const pendAppSettings = appSettings.filter(a => a.synced === false).length;
      if (pendAppSettings > 0) {
        pendencias.push({
          nome: 'Config. App',
          quantidade: pendAppSettings,
          icone: Icons.Settings
        });
      }
    } catch (err) {
      console.error('Erro ao contar app settings:', err);
    }

    try {
      // Permissões
      if (db.rolePermissions) {
        const rolePermissions = await db.rolePermissions.toArray();
        const pendPermissoes = rolePermissions.filter((p) => p.synced === false).length;
        if (pendPermissoes > 0) {
          pendencias.push({
            nome: 'Permissões',
            quantidade: pendPermissoes,
            icone: Icons.Shield
          });
        }
      }
    } catch (err) {
      console.error('Erro ao contar permissões:', err);
    }

    try {
      // Pesagens
      if (db.pesagens) {
        const pesagens = await db.pesagens.toArray();
        const pendPesagens = pesagens.filter(p => p.synced === false);
        if (pendPesagens.length > 0) {
          pendencias.push({
            nome: 'Pesagens',
            quantidade: pendPesagens.length,
            icone: Icons.Scale,
            detalhes: pendPesagens.map(p => ({
              id: p.id,
              dataPesagem: p.dataPesagem,
              peso: p.peso,
              nascimentoId: p.nascimentoId,
              observacao: p.observacao
            }))
          });
        }
      }
    } catch (err) {
      console.error('Erro ao contar pesagens:', err);
    }

    try {
      // Vacinações
      if (db.vacinacoes) {
        const vacinacoes = await db.vacinacoes.toArray();
        const pendVacinacoes = vacinacoes.filter(v => v.synced === false);
        if (pendVacinacoes.length > 0) {
          pendencias.push({
            nome: 'Vacinações',
            quantidade: pendVacinacoes.length,
            icone: Icons.Injection,
            detalhes: pendVacinacoes.map(v => ({
              id: v.id,
              vacina: v.vacina,
              dataAplicacao: v.dataAplicacao,
              nascimentoId: v.nascimentoId
            }))
          });
        }
      }
    } catch (err) {
      console.error('Erro ao contar vacinações:', err);
    }

    try {
      // Exclusões
      if (db.deletedRecords) {
        const deletedRecords = await db.deletedRecords.toArray();
        const pendDeleted = deletedRecords.filter(d => d.synced === false).length;
        if (pendDeleted > 0) {
          pendencias.push({
            nome: 'Exclusões',
            quantidade: pendDeleted,
            icone: Icons.Trash2
          });
        }
      }
    } catch (err) {
      console.error('Erro ao contar exclusões:', err);
    }

    return pendencias;
  }, []);

  const totalPendencias = useMemo(() => {
    return todasTabelas?.reduce((sum, t) => sum + t.quantidade, 0) || 0;
  }, [todasTabelas]);

  // Estatísticas da fila de eventos
  const filaStats = useLiveQuery(async () => {
    try {
      if (db.syncEvents) {
        return await getSyncQueueStats();
      }
      return null;
    } catch (err) {
      console.error('Erro ao buscar estatísticas da fila:', err);
      return null;
    }
  }, []);

  // Eventos pendentes da fila
  const eventosPendentes = useLiveQuery(async () => {
    try {
      if (db.syncEvents) {
        const todosEventos = await db.syncEvents.toArray();
        const eventos = todosEventos
          .filter(e => !e.synced)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return eventos.slice(0, 10); // Mostrar apenas os 10 mais recentes
      }
      return [];
    } catch (err) {
      console.error('Erro ao buscar eventos pendentes:', err);
      return [];
    }
  }, []);

  const [ultimoSync, setUltimoSync] = useState<Date | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  });

  // Escutar eventos de sincronização completada (manual ou automática)
  useEffect(() => {
    const handleSyncCompleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ timestamp: string; success: boolean }>;
      if (customEvent.detail.success) {
        const timestamp = new Date(customEvent.detail.timestamp);
        setUltimoSync(timestamp);
        // Atualizar localStorage também
        localStorage.setItem(STORAGE_KEY_LAST_SYNC, timestamp.toISOString());
      }
    };

    window.addEventListener('syncCompleted', handleSyncCompleted);
    
    return () => {
      window.removeEventListener('syncCompleted', handleSyncCompleted);
    };
  }, []);

  const formatarData = (date: Date | null) => {
    if (!date) return 'Nunca';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const adicionarLog = (log: SyncLog) => {
    setSyncLogs(prev => {
      const novos = [log, ...prev].slice(0, MAX_LOGS);
      try {
        localStorage.setItem(STORAGE_KEY_SYNC_LOGS, JSON.stringify(novos));
      } catch (err) {
        console.error('Erro ao salvar logs:', err);
      }
      return novos;
    });
  };

  const handleSync = async () => {
    if (!online) {
      showToast({
        type: 'error',
        title: 'Sem conexão',
        message: 'Você precisa estar online para sincronizar.'
      });
      return;
    }

    if (syncing) return;

    setSyncing(true);
    setGlobalSyncing(true);
    const inicio = new Date();

    try {
      await syncAll();
      
      const fim = new Date();
      const duracao = ((fim.getTime() - inicio.getTime()) / 1000).toFixed(1);
      
      // Atualizar último sync (já foi salvo pelo syncAll, mas atualizamos o estado local)
      setUltimoSync(fim);
      
      adicionarLog({
        timestamp: fim.toISOString(),
        sucesso: true,
        detalhes: `Sincronização concluída em ${duracao}s`
      });

      showToast({
        type: 'success',
        title: 'Sincronização concluída',
        message: `Todos os dados foram sincronizados com sucesso em ${duracao}s.`
      });
    } catch (error: any) {
      const fim = new Date();
      const erroMsg = error?.message || 'Erro desconhecido';
      
      adicionarLog({
        timestamp: fim.toISOString(),
        sucesso: false,
        erro: erroMsg,
        detalhes: error?.stack || ''
      });

      showToast({
        type: 'error',
        title: 'Erro na sincronização',
        message: erroMsg
      });
    } finally {
      setSyncing(false);
      setGlobalSyncing(false);
    }
  };

  // Escutar mudanças no estado global de sincronização
  useEffect(() => {
    const listener = (isSyncing: boolean) => {
      setSyncing(isSyncing);
    };
    const syncListeners = (window as any).__syncListeners || new Set();
    syncListeners.add(listener);
    (window as any).__syncListeners = syncListeners;
    
    const handleSyncStateChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ syncing: boolean }>;
      setSyncing(customEvent.detail.syncing);
    };
    
    window.addEventListener('syncStateChange', handleSyncStateChange);
    setSyncing(getGlobalSyncing());
    
    return () => {
      syncListeners.delete(listener);
      window.removeEventListener('syncStateChange', handleSyncStateChange);
    };
  }, []);

  return (
    <div className="p-4 sm:p-4 lg:p-4 max-w-8xl mx-auto">
      {/* Cabeçalho */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg ${getPrimaryCardClass(primaryColor)}`}>
            <Icons.RefreshCw className={`w-6 h-6 ${getTitleTextClass(primaryColor)}`} />
          </div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${getTitleTextClass(primaryColor)}`}>
            Centro de Sincronização
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 ml-12">
          Gerencie a sincronização de dados entre o dispositivo e o servidor
        </p>
      </div>

      {/* Status Geral - Card Principal */}
      <div className={`${getPrimaryCardClass(primaryColor)} rounded-xl p-4 sm:p-4 mb-4 shadow-sm border-2`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${
              online 
                ? 'bg-green-100 dark:bg-green-900/30' 
                : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              {online ? (
                <Icons.Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Icons.WifiOff className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Status da Conexão
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {online ? 'Conectado ao servidor' : 'Sem conexão com o servidor'}
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
            online 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full animate-pulse ${
                online ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm font-semibold">
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Icons.Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Última sincronização</p>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {ultimoSync ? formatarData(ultimoSync) : 'Nunca'}
            </p>
            {ultimoSync && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {Math.floor((Date.now() - ultimoSync.getTime()) / 1000 / 60)} min atrás
              </p>
            )}
          </div>
          <div className={`rounded-lg p-4 border-2 ${
            totalPendencias > 0
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {totalPendencias > 0 ? (
                <Icons.AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <Icons.CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              )}
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pendências locais</p>
            </div>
            <p className={`text-xl font-bold ${
              totalPendencias > 0
                ? 'text-yellow-700 dark:text-yellow-300'
                : 'text-green-700 dark:text-green-300'
            }`}>
              {totalPendencias} {totalPendencias === 1 ? 'registro' : 'registros'}
            </p>
            {totalPendencias === 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Tudo sincronizado!
              </p>
            )}
          </div>
        </div>

        {/* Botão de Sincronização */}
        <div className="flex items-center justify-center pt-3 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={handleSync}
            disabled={!online || syncing}
            className={`
              ${getPrimaryButtonClass(primaryColor)}
              ${(!online || syncing) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 transition-transform'}
              px-6 py-2.5 text-white font-semibold shadow-md flex items-center gap-3 rounded-lg disabled:hover:scale-100`}
          >
            {syncing ? (
              <>
                <Icons.Loader2 className="w-5 h-5 animate-spin" />
                <span>Sincronizando...</span>
              </>
            ) : (
              <>
                <Icons.RefreshCw className="w-5 h-5" />
                <span>Sincronizar Agora</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pendências por Tabela */}
      {totalPendencias > 0 && (
        <div className={`${getPrimaryCardClass(primaryColor)} rounded-xl p-4 mb-5 shadow-sm border-2`}>
          <div className="flex items-center gap-2 mb-3">
            <Icons.AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Pendências por Tabela
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todasTabelas?.map((tabela) => {
              const Icon = tabela.icone;
              return (
                <div
                  key={tabela.nome}
                  className="bg-white dark:bg-slate-800 rounded-lg border-2 border-yellow-200 dark:border-yellow-800 hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors"
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                      <Icon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {tabela.nome}
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                        {tabela.quantidade} {tabela.quantidade === 1 ? 'pendente' : 'pendentes'}
                      </p>
                    </div>
                  </div>
                  {tabela.detalhes && tabela.detalhes.length > 0 && (
                    <div className="px-3 pb-3 border-t border-yellow-200 dark:border-yellow-800">
                      <div className="mt-2 space-y-2">
                        {tabela.detalhes.map((detalhe, idx) => (
                          <div key={idx} className="text-xs bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                            <p className="font-medium text-gray-700 dark:text-gray-300">
                              {tabela.nome === 'Pesagens' && detalhe.dataPesagem && detalhe.peso !== undefined ? (
                                <>Data: {detalhe.dataPesagem} | Peso: {detalhe.peso} kg</>
                              ) : tabela.nome === 'Vacinações' && detalhe.vacina ? (
                                <>Vacina: {detalhe.vacina}</>
                              ) : (
                                <>ID: {detalhe.id?.substring(0, 8)}...</>
                              )}
                            </p>
                            {detalhe.nascimentoId && (
                              <p className="text-gray-500 dark:text-gray-400 mt-1">
                                Nascimento: {detalhe.nascimentoId.substring(0, 8)}...
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fila de Eventos de Sincronização */}
      {filaStats !== undefined && (
        <div className={`${getPrimaryCardClass(primaryColor)} rounded-xl p-4 mb-5 shadow-sm border-2`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icons.RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Fila de Eventos de Sincronização
              </h2>
            </div>
            {filaStats && filaStats.total > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{filaStats.pendentes}</span> pendentes
                </span>
                {filaStats.comErro > 0 && (
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    {filaStats.comErro} com erro
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Estatísticas */}
          {filaStats ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{filaStats.total}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pendentes</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{filaStats.pendentes}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Sincronizados</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{filaStats.sincronizados}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Com Erro</p>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">{filaStats.comErro}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <Icons.Loader2 className="w-6 h-6 text-gray-400 dark:text-gray-500 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Carregando estatísticas da fila...</p>
            </div>
          )}

          {/* Eventos Pendentes Recentes */}
          {filaStats && filaStats.total === 0 ? (
            <div className="text-center py-6">
              <Icons.CheckCircle className="w-12 h-12 text-green-300 dark:text-green-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Nenhum evento na fila de sincronização.
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                Os eventos serão criados automaticamente quando houver alterações pendentes.
              </p>
            </div>
          ) : eventosPendentes && eventosPendentes.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Eventos Pendentes Recentes
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {eventosPendentes.map((evento) => (
                  <div
                    key={evento.id}
                    className={`p-3 rounded-lg border-2 ${
                      evento.tentativas >= 5
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            evento.tipo === 'INSERT' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                            evento.tipo === 'UPDATE' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}>
                            {evento.tipo}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                            {evento.entidade}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          ID: {evento.entityId.substring(0, 8)}...
                        </p>
                        {evento.erro && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                            {evento.erro}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {evento.tentativas} {evento.tentativas === 1 ? 'tentativa' : 'tentativas'}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {formatarData(new Date(evento.createdAt))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logs de Sincronização */}
      <div className={`${getPrimaryCardClass(primaryColor)} rounded-xl p-4 shadow-sm border-2`}>
        <div className="flex items-center gap-2 mb-3">
          <Icons.History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Histórico de Sincronizações Manuais
          </h2>
          {syncLogs.length > 0 && (
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
              {syncLogs.length} {syncLogs.length === 1 ? 'registro' : 'registros'}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 -mt-2">
          Registro apenas de sincronizações iniciadas manualmente pelo botão "Sincronizar Agora"
        </p>
        {syncLogs.length === 0 ? (
          <div className="text-center py-8">
            <Icons.History className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Nenhuma sincronização manual registrada ainda.
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              O histórico será atualizado após cada sincronização manual
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {syncLogs.map((log, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 transition-all ${
                  log.sucesso
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    log.sucesso
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {log.sucesso ? (
                      <Icons.CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Icons.XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-sm font-semibold ${
                          log.sucesso
                            ? 'text-green-700 dark:text-green-300'
                            : 'text-red-700 dark:text-red-300'
                        }`}
                      >
                        {log.sucesso ? '✓ Sincronização Concluída' : '✗ Erro na Sincronização'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-800 px-2 py-1 rounded">
                        {formatarData(new Date(log.timestamp))}
                      </span>
                    </div>
                    {log.detalhes && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                        {log.detalhes}
                      </p>
                    )}
                    {log.erro && (
                      <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-700 dark:text-red-300">
                        <strong>Erro:</strong> {log.erro}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
