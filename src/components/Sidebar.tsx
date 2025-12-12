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
  Download
} from 'lucide-react';
import SyncStatus from './SyncStatus';
import useSync from '../hooks/useSync';
import { useAuth } from '../hooks/useAuth';

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
  const { logout, user, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
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
    { path: '/planilha', label: 'Planilha', icon: FileSpreadsheet },
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
                        flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                        ${active
                          ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className="font-medium">{item.label}</span>
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
                      alert(`Backup exportado com sucesso!\n\nArquivo: ${resultado.nomeArquivo}\n\nTotal de registros:\n- Fazendas: ${resultado.totalRegistros.totalFazendas}\n- Raças: ${resultado.totalRegistros.totalRacas}\n- Nascimentos: ${resultado.totalRegistros.totalNascimentos}\n- Desmamas: ${resultado.totalRegistros.totalDesmamas}\n- Usuários: ${resultado.totalRegistros.totalUsuarios}`);
                    } catch (error) {
                      console.error('Erro ao exportar backup:', error);
                      alert('Erro ao exportar backup. Tente novamente.');
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
                        
                        alert('Cache limpo com sucesso! A página será recarregada.');
                        window.location.reload();
                      } catch (error) {
                        console.error('Erro ao limpar cache:', error);
                        alert('Erro ao limpar cache. Tente limpar manualmente pelo navegador.');
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
    </>
  );
}

