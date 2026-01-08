import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icons } from '../utils/iconMapping';
import SyncStatus from './SyncStatus';
import useSync from '../hooks/useSync';
import { useAuth } from '../hooks/useAuth';
import { showToast } from '../utils/toast';
import { AlertSettings, useAlertSettings } from '../hooks/useAlertSettings';
import { useNotifications } from '../hooks/useNotifications';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { applyTheme, getInitialTheme, Theme } from '../utils/theme';
import { APP_VERSION } from '../utils/version';

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
  
  // Estado para sidebar recolhida (inicia recolhida)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved !== null ? saved === 'true' : true; // Inicia recolhida por padrão
    }
    return true;
  });
  
  // Salvar estado no localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
      // Disparar evento para atualizar o layout do App
      window.dispatchEvent(new CustomEvent('sidebarToggle', { detail: { collapsed: sidebarCollapsed } }));
    }
  }, [sidebarCollapsed]);
  
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    draftSettings,
    setDraftSettings,
    saveSettings,
    resetSettings
  } = useAlertSettings();
  const notificacoes = useNotifications();
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  useKeyboardShortcuts();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };
  
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
    { path: '/dashboard', label: 'Dashboard', icon: Icons.LayoutDashboard },
    { path: '/notificacoes', label: 'Notificações', icon: Icons.Bell, badge: notificacoes.total > 0 ? notificacoes.total : undefined },
    { path: '/planilha', label: 'Nascimento/Desmama', icon: Icons.FileSpreadsheet },
    { path: '/matrizes', label: 'Matrizes', icon: Icons.ListTree },
    { path: '/fazendas', label: 'Fazendas', icon: Icons.Building2 },
    { path: '/importar-planilha', label: 'Importar Planilha', icon: Icons.Upload },
    ...(isAdmin() ? [{ path: '/usuarios', label: 'Usuários', icon: Icons.Users }] : []),
  ];

      const isActive = (path: string) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
      };

  return (
    <>
      {/* Botão Mobile - Toggle Sidebar */}
      <button
        onClick={() => {
          setSidebarOpen(!sidebarOpen);
          // No mobile, sempre abrir expandida
          if (!sidebarOpen) {
            setSidebarCollapsed(false);
          }
        }}
        className="fixed top-3 left-3 z-50 p-2 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 lg:hidden"
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? (
          <Icons.X className="w-6 h-6 text-gray-600 dark:text-slate-300" />
        ) : (
          <Icons.Menu className="w-6 h-6 text-gray-600 dark:text-slate-300" />
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
          fixed top-0 left-0 h-full bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 shadow-sm z-40
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full'}
          lg:translate-x-0
          ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header Completo e Profissional */}
          <div className={`border-b border-gray-200 dark:border-slate-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 relative ${sidebarCollapsed && !sidebarOpen ? 'p-3' : 'p-4'}`}>
            {sidebarCollapsed && !sidebarOpen ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors z-20 relative"
                  title="Expandir sidebar"
                >
                  <Icons.ChevronRight className="w-4 h-4 text-gray-600 dark:text-slate-300" />
                </button>
                <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-md overflow-hidden">
                  <img 
                    src="/logo.png" 
                    alt="Logo" 
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      // Fallback para ícone se logo não carregar
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.parentElement) {
                        target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600"><svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2L3 7v11h4v-6h6v6h4V7l-7-5z"/></svg></div>';
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Botão de toggle flutuante - apenas em desktop */}
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="hidden lg:block absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors z-20 bg-white/40 dark:bg-slate-800/60 backdrop-blur-sm shadow-sm"
                  title="Recolher sidebar"
                >
                  <Icons.ChevronLeft className="w-4 h-4 text-gray-700 dark:text-slate-300" />
                </button>
                
                {/* Conteúdo do header */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0">
                      <img 
                        src="/logo.png" 
                        alt="Logo" 
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          // Fallback para ícone se logo não carregar
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600"><svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2L3 7v11h4v-6h6v6h4V7l-7-5z"/></svg></div>';
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-tight">Gerenciador de Fazendas</h1>
                      <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">Sistema de Gestão</p>
                    </div>
                  </div>
                  
                  {/* Status e Tema */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200/50 dark:border-slate-700/50">
                    <SyncStatus collapsed={false} />
                    <div className="flex-1"></div>
                    <button
                      onClick={toggleTheme}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm flex-shrink-0"
                      title={theme === 'dark' ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
                    >
                      {theme === 'dark' ? (
                        <>
                          <Icons.Sun className="w-3.5 h-3.5 mr-1.5" />
                          <span>Claro</span>
                        </>
                      ) : (
                        <>
                          <Icons.Moon className="w-3.5 h-3.5 mr-1.5" />
                          <span>Escuro</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto px-2 py-3">
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full relative group
                        ${sidebarCollapsed && !sidebarOpen ? 'justify-center' : ''}
                        ${
                          active
                            ? 'bg-blue-50 text-blue-700 border-l-3 border-blue-600 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-400 shadow-sm'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-slate-700/50 dark:hover:text-white'
                        }
                      `}
                      title={sidebarCollapsed && !sidebarOpen ? item.label : ''}
                      aria-label={item.label}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 transition-colors ${
                          active 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                        }`}
                      />
                      {(!sidebarCollapsed || sidebarOpen) && (
                        <>
                          <span className="font-medium text-sm whitespace-nowrap flex-1">{item.label}</span>
                          {item.badge ? (
                            <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-red-500 text-white shadow-sm">
                              {item.badge}
                            </span>
                          ) : null}
                        </>
                      )}
                      {sidebarCollapsed && !sidebarOpen && item.badge && (
                        <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full bg-red-500 text-white shadow-sm">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer Profissional */}
          <div className="border-t border-gray-200 dark:border-slate-700 bg-gradient-to-b from-gray-50/50 to-white dark:from-slate-900/50 dark:to-slate-900">
            <div className="px-3 py-2.5 space-y-1.5">
              <button
                onClick={() => setSettingsOpen(true)}
                className={`w-full flex items-center ${sidebarCollapsed && !sidebarOpen ? 'justify-center' : 'gap-2'} px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 rounded-md transition-all text-xs font-medium border border-indigo-200 dark:border-indigo-800/50 shadow-sm`}
                title={sidebarCollapsed && !sidebarOpen ? 'Configurações' : ''}
              >
                <Icons.Settings className="w-4 h-4" />
                {(!sidebarCollapsed || sidebarOpen) && <span>Configurações</span>}
              </button>
              
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className={`w-full flex items-center ${sidebarCollapsed && !sidebarOpen ? 'justify-center' : 'gap-2'} px-2.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-xs font-medium relative overflow-hidden`}
                title={sidebarCollapsed && !sidebarOpen ? (syncing ? 'Sincronizando...' : 'Sincronizar') : ''}
                aria-label={syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
              >
                <Icons.RefreshCw 
                  className={`w-4 h-4 transition-transform duration-300 ${
                    syncing ? 'animate-spin' : ''
                  }`}
                />
                {(!sidebarCollapsed || sidebarOpen) && (
                  <span className="relative z-10">
                    {syncing ? 'Sincronizando...' : 'Sincronizar'}
                  </span>
                )}
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
                className={`w-full flex items-center ${sidebarCollapsed && !sidebarOpen ? 'justify-center' : 'gap-2'} px-2.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-300 rounded-md transition-all text-xs font-medium border border-purple-200 dark:border-purple-800/50 shadow-sm`}
                title={sidebarCollapsed && !sidebarOpen ? 'Backup' : ''}
              >
                <Icons.Download className="w-4 h-4" />
                {(!sidebarCollapsed || sidebarOpen) && <span>Backup</span>}
              </button>
              
              <button
                onClick={() => {
                  setConfirmDialog({
                    open: true,
                    title: 'Limpar cache',
                    message: 'Deseja limpar o cache do navegador? Isso irá:\n\n- Limpar IndexedDB\n- Limpar Local Storage\n- Limpar Session Storage\n- Limpar Cache do navegador\n\nA aplicação será recarregada após a limpeza.',
                    variant: 'warning',
                    onConfirm: async () => {
                      setConfirmDialog(prev => ({ ...prev, open: false }));
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
                  });
                }}
                className={`w-full flex items-center ${sidebarCollapsed && !sidebarOpen ? 'justify-center' : 'gap-2'} px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-md transition-all text-xs font-medium border border-gray-200 dark:border-slate-700 shadow-sm`}
                title={sidebarCollapsed && !sidebarOpen ? 'Limpar Cache' : ''}
              >
                <Icons.Trash2 className="w-4 h-4" />
                {(!sidebarCollapsed || sidebarOpen) && <span>Limpar Cache</span>}
              </button>

              <div className="pt-1.5 border-t border-gray-200 dark:border-slate-700 space-y-1.5">
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center ${sidebarCollapsed && !sidebarOpen ? 'justify-center' : 'gap-2'} px-2.5 py-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300 rounded-md transition-all text-xs font-medium border border-red-200 dark:border-red-900/30 shadow-sm`}
                  title={sidebarCollapsed && !sidebarOpen ? 'Sair' : ''}
                  aria-label="Sair"
                >
                  <Icons.LogOut className="w-4 h-4" />
                  {(!sidebarCollapsed || sidebarOpen) && <span>Sair</span>}
                </button>
                
                {/* Versão da aplicação */}
                <div className={`flex items-center ${sidebarCollapsed && !sidebarOpen ? 'justify-center' : 'justify-center'} px-2.5 py-1.5 text-[10px] text-gray-400 dark:text-slate-500 font-mono`}>
                  {sidebarCollapsed && !sidebarOpen ? (
                    <span title={`Versão ${APP_VERSION}`}>v{APP_VERSION}</span>
                  ) : (
                    <span>v{APP_VERSION}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl">
          <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Configurações de alertas</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">Ajuste limites de desmama e mortalidade.</p>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Fechar"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 ml-4 mr-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={async () => {
                  await resetSettings();
                  // Sincronizar após restaurar as configurações
                  try {
                    const { pushPending } = await import('../api/syncService');
                    await pushPending();
                    showToast({
                      type: 'info',
                      title: 'Configuração padrão',
                      message: 'Limites restaurados e sincronizados.'
                    });
                  } catch (error) {
                    console.error('Erro ao sincronizar configurações:', error);
                    showToast({
                      type: 'info',
                      title: 'Configuração padrão',
                      message: 'Limites restaurados. A sincronização será feita automaticamente.'
                    });
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Restaurar padrão
              </button>
              <button
                type="button"
                onClick={async () => {
                  await saveSettings();
                  // Sincronizar após salvar as configurações
                  try {
                    const { pushPending } = await import('../api/syncService');
                    await pushPending();
                    showToast({
                      type: 'success',
                      title: 'Configurações salvas',
                      message: 'Alertas atualizados e sincronizados.'
                    });
                  } catch (error) {
                    console.error('Erro ao sincronizar configurações:', error);
                    showToast({
                      type: 'success',
                      title: 'Configurações salvas',
                      message: 'Alertas atualizados. A sincronização será feita automaticamente.'
                    });
                  }
                  setSettingsOpen(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal de Confirmação */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </>
  );
}

