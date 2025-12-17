import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Building2, 
  Upload,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Users,
  Download,
  Settings,
  Bell,
  ListTree
} from 'lucide-react';
import SyncStatus from './SyncStatus';
import useSync from '../hooks/useSync';
import { useAuth } from '../hooks/useAuth';
import { showToast } from '../utils/toast';
import { AlertSettings, useAlertSettings } from '../hooks/useAlertSettings';
import { useNotifications } from '../hooks/useNotifications';
import Modal from './Modal';

// Variável global para rastrear estado de sincronização
let globalSyncing = false;
const syncListeners = new Set<(syncing: boolean) => void>();

export function setGlobalSyncing(syncing: boolean) {
  globalSyncing = syncing;
  syncListeners.forEach(listener => listener(syncing));
  // Também atualizar via window para compatibilidade
  if (typeof window !== 'undefined') {
    (window as any).__globalSyncing = syncing;
    window.dispatchEvent(new CustomEvent('syncStateChange', { detail: { syncing } }));
  }
}

export function getGlobalSyncing() {
  return globalSyncing;
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    draftSettings,
    setDraftSettings,
    saveSettings,
    resetSettings
  } = useAlertSettings();
  const notificacoes = useNotifications();
  
  // Hook de sincronização automática
  useSync();
  
  // Escutar mudanças no estado global de sincronização
  useEffect(() => {
    const listener = (isSyncing: boolean) => {
      setSyncing(isSyncing);
    };
    syncListeners.add(listener);
    setSyncing(globalSyncing); // Sincronizar estado inicial
    
    // Escutar eventos customizados de mudança de estado
    const handleSyncStateChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ syncing: boolean }>;
      setSyncing(customEvent.detail.syncing);
    };
    
    window.addEventListener('syncStateChange', handleSyncStateChange);
    
    return () => {
      syncListeners.delete(listener);
      window.removeEventListener('syncStateChange', handleSyncStateChange);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setGlobalSyncing(true);
    try {
      const { syncAll } = await import('../api/syncService');
      await syncAll();
    } catch (error) {
      console.error('Erro na sincronização manual:', error);
    } finally {
      // Pequeno delay para mostrar feedback visual
      setTimeout(() => {
        setSyncing(false);
        setGlobalSyncing(false);
      }, 300);
    }
  };

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/notificacoes', label: 'Notificações', icon: Bell, badge: notificacoes.total },
    { path: '/planilha', label: 'Planilha', icon: FileSpreadsheet },
    { path: '/matrizes', label: 'Matrizes', icon: ListTree },
    { path: '/fazendas', label: 'Fazendas', icon: Building2 },
    { path: '/importar-planilha', label: 'Importar Planilha', icon: Upload },
    ...(isAdmin() ? [{ path: '/usuarios', label: 'Usuários', icon: Users }] : []),
  ];

      const isActive = (path: string) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
      };

  return (
    <>
      {/* Botão Mobile - Toggle Sidebar */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md lg:hidden"
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? (
          <X className="w-6 h-6 text-gray-600" />
        ) : (
          <Menu className="w-6 h-6 text-gray-600" />
        )}
      </button>

      {/* Overlay Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-sm z-40
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          w-64
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Gestor Fazenda</h1>
            <p className="text-sm text-gray-600 mt-1">Sistema de Gestão</p>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg transition-colors w-full
                        ${active
                          ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className="font-medium whitespace-nowrap flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[22px] h-5 px-1 text-[11px] font-semibold rounded-full bg-red-500 text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Sync Status e Botão Manual */}
          <div className="p-4 border-t border-gray-200 space-y-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Sincronização</span>
              <SyncStatus />
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors text-sm border border-indigo-100"
            >
              <Settings className="w-4 h-4" />
              <span>Configurações de alertas</span>
            </button>
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm relative overflow-hidden"
            >
              <RefreshCw 
                className={`w-4 h-4 transition-transform duration-300 ${
                  syncing ? 'animate-spin' : ''
                }`}
                style={{
                  animation: syncing ? 'spin 1s linear infinite' : 'none'
                }}
              />
              <span className="relative z-10">
                {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
              </span>
              {syncing && (
                <span className="absolute inset-0 bg-blue-700 opacity-20 animate-pulse" />
              )}
            </button>
                <button
                  onClick={async () => {
                    try {
                      const { exportarBackupCompleto } = await import('../utils/exportarDados');
                      const resultado = await exportarBackupCompleto();
                      showToast({
                        type: 'success',
                        title: 'Backup exportado',
                        message: `Arquivo: ${resultado.nomeArquivo}\nFazendas: ${resultado.totalRegistros.totalFazendas}\nRaças: ${resultado.totalRegistros.totalRacas}\nNascimentos: ${resultado.totalRegistros.totalNascimentos}\nDesmamas: ${resultado.totalRegistros.totalDesmamas}\nUsuários: ${resultado.totalRegistros.totalUsuarios}`
                      });
                    } catch (error) {
                      console.error('Erro ao exportar backup:', error);
                      showToast({
                        type: 'error',
                        title: 'Erro ao exportar backup',
                        message: 'Tente novamente.'
                      });
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors shadow-sm text-sm"
                  title="Exportar backup completo dos dados"
                >
                  <Download className="w-4 h-4" />
                  <span>Backup Completo</span>
                </button>
                <button
                  onClick={async () => {
                    if (confirm('Deseja limpar o cache do navegador? Isso irá:\n\n- Limpar IndexedDB\n- Limpar Local Storage\n- Limpar Session Storage\n- Limpar Cache do navegador\n\nA aplicação será recarregada após a limpeza.')) {
                      try {
                        // Limpar IndexedDB
                        if ('indexedDB' in window) {
                          const databases = await indexedDB.databases();
                          for (const db of databases) {
                            if (db.name) {
                              indexedDB.deleteDatabase(db.name);
                            }
                          }
                        }
                        
                        // Limpar Local Storage
                        localStorage.clear();
                        
                        // Limpar Session Storage
                        sessionStorage.clear();
                        
                        // Limpar Cache (se suportado)
                        if ('caches' in window) {
                          const cacheNames = await caches.keys();
                          await Promise.all(
                            cacheNames.map(name => caches.delete(name))
                          );
                        }
                        
                        showToast({
                          type: 'success',
                          title: 'Cache limpo',
                          message: 'O cache foi limpo. A página será recarregada.'
                        });
                        window.location.reload();
                      } catch (error) {
                        console.error('Erro ao limpar cache:', error);
                        showToast({
                          type: 'error',
                          title: 'Erro ao limpar cache',
                          message: 'Tente limpar manualmente pelo navegador.'
                        });
                      }
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors shadow-sm text-sm"
                  title="Limpar cache do navegador"
                >
                  <span>🗑️ Limpar Cache</span>
                </button>
          </div>

          {/* Logout */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Configurações de alertas</h3>
              <p className="text-sm text-gray-600">Ajuste limites de desmama e mortalidade.</p>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meses sem desmama
              </label>
              <input
                type="number"
                min={1}
                max={36}
                value={draftSettings.limiteMesesDesmama}
                onChange={(e) =>
                  setDraftSettings((prev: AlertSettings) => ({
                    ...prev,
                    limiteMesesDesmama: Number(e.target.value)
                  }))
                }
                className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Janela mortalidade (meses)
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={draftSettings.janelaMesesMortalidade}
                onChange={(e) =>
                  setDraftSettings((prev: AlertSettings) => ({
                    ...prev,
                    janelaMesesMortalidade: Number(e.target.value)
                  }))
                }
                className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Limiar mortalidade (%)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={draftSettings.limiarMortalidade}
                onChange={(e) =>
                  setDraftSettings((prev: AlertSettings) => ({
                    ...prev,
                    limiarMortalidade: Number(e.target.value)
                  }))
                }
                className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetSettings();
                showToast({
                  type: 'info',
                  title: 'Configuração padrão',
                  message: 'Limites restaurados.'
                });
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Restaurar padrão
            </button>
            <button
              type="button"
              onClick={() => {
                saveSettings();
                showToast({
                  type: 'success',
                  title: 'Configurações salvas',
                  message: 'Alertas atualizados.'
                });
                setSettingsOpen(false);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Salvar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

