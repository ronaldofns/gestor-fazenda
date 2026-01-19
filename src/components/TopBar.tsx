import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../hooks/useAuth';
import { useFazendaContext } from '../hooks/useFazendaContext';
import { db } from '../db/dexieDB';
import { Icons } from '../utils/iconMapping';
import { showToast } from '../utils/toast';
import { setGlobalSyncing, getGlobalSyncing } from './Sidebar';
import { useAppSettings, AppSettings } from '../hooks/useAppSettings';
import { COLOR_PALETTES, ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses, getTitleTextClass, getPrimaryButtonClass } from '../utils/themeHelpers';
import { useAlertSettings, AlertSettings } from '../hooks/useAlertSettings';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';

// Mapeamento de rotas para títulos e subtítulos
const routeMetadata: Record<string, { title: string; subtitle: string; icon?: keyof typeof Icons }> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Visão geral do seu rebanho',
    icon: 'LayoutDashboard'
  },
  '/planilha': {
    title: 'Nascimento/Desmama',
    subtitle: 'Gerenciar nascimentos e desmamas',
    icon: 'FileSpreadsheet'
  },
  '/matrizes': {
    title: 'Matrizes',
    subtitle: 'Gerenciar matrizes do rebanho',
    icon: 'ListTree'
  },
  '/notificacoes': {
    title: 'Notificações',
    subtitle: 'Alertas e avisos do sistema',
    icon: 'Bell'
  },
  '/fazendas': {
    title: 'Fazendas',
    subtitle: 'Gerenciar fazendas',
    icon: 'Building2'
  },
  '/importar-planilha': {
    title: 'Importar Planilha',
    subtitle: 'Importar dados de planilhas Excel',
    icon: 'Upload'
  },
  '/usuarios': {
    title: 'Usuários',
    subtitle: 'Gerenciar usuários do sistema',
    icon: 'Users'
  },
  '/permissoes': {
    title: 'Permissões',
    subtitle: 'Gerenciar permissões por role',
    icon: 'Shield'
  }
};

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  peao: 'Peão',
  visitante: 'Visitante'
};

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { fazendaAtivaId, setFazendaAtiva } = useFazendaContext();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [fazendaMenuOpen, setFazendaMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
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
  const menuRef = useRef<HTMLDivElement>(null);
  const fazendaMenuRef = useRef<HTMLDivElement>(null);
  const { draftSettings: draftAppSettings, setDraftSettings: setDraftAppSettings, saveSettings: saveAppSettings, resetSettings: resetAppSettings } = useAppSettings();
  const { draftSettings, setDraftSettings, saveSettings, resetSettings } = useAlertSettings();
  
  // Buscar fazendas disponíveis
  const fazendas = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const fazendaAtiva = fazendas.find(f => f.id === fazendaAtivaId);

  // Obter metadados da rota atual
  const currentRoute = location.pathname;
  const metadata = routeMetadata[currentRoute] || {
    title: 'Gestor Fazenda',
    subtitle: 'Sistema de Gestão de Rebanho'
  };

  // Fechar menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (fazendaMenuRef.current && !fazendaMenuRef.current.contains(event.target as Node)) {
        setFazendaMenuOpen(false);
      }
    };

    if (userMenuOpen || fazendaMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen, fazendaMenuOpen]);

  // Obter iniciais do nome do usuário
  const getUserInitials = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Obter cor do avatar baseado no nome (para consistência)
  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-green-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-red-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Escutar mudanças no estado global de sincronização
  useEffect(() => {
    const listener = (isSyncing: boolean) => {
      setSyncing(isSyncing);
    };
    const syncListeners = (window as any).__syncListeners || new Set();
    syncListeners.add(listener);
    (window as any).__syncListeners = syncListeners;
    
    // Escutar eventos customizados de mudança de estado
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

  const handleManualSync = async () => {
    try {
      setUserMenuOpen(false);
      setGlobalSyncing(true);
      const { syncAll } = await import('../api/syncService');
      await syncAll();
      showToast({
        type: 'success',
        title: 'Sincronização concluída',
        message: 'Todos os dados foram sincronizados com sucesso.'
      });
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      showToast({
        type: 'error',
        title: 'Erro na sincronização',
        message: 'Não foi possível sincronizar. Tente novamente.'
      });
    } finally {
      setTimeout(() => {
        setGlobalSyncing(false);
      }, 300);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    showToast({
      type: 'info',
      title: 'Logout realizado',
      message: 'Você foi desconectado com sucesso.'
    });
  };

  if (!user) return null;

  const IconComponent = metadata.icon ? Icons[metadata.icon] : Icons.LayoutDashboard;
  const primaryColor = (draftAppSettings?.primaryColor || 'gray') as ColorPaletteKey;

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between px-14 sm:px-6 lg:px-8 h-16">
        {/* Título e Subtítulo (Esquerda) */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {IconComponent && (
            <div className={`hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${getThemeClasses(primaryColor, 'gradient-from')} ${getThemeClasses(primaryColor, 'text')} flex-shrink-0 shadow-sm`}>
              <IconComponent className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className={`text-base sm:text-lg font-semibold ${getTitleTextClass(primaryColor)} truncate`}>
              {metadata.title}
            </h1>
            <p className={`text-xs ${getThemeClasses(primaryColor, 'text')} truncate mt-0.5`}>
              {metadata.subtitle}
            </p>
          </div>
        </div>

        {/* Informações do Usuário (Direita) */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Seletor de Fazenda */}
          <div className="relative" ref={fazendaMenuRef}>
            <button
              onClick={() => setFazendaMenuOpen(!fazendaMenuOpen)}
              className={`flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl px-3 py-2 transition-all ${getThemeClasses(primaryColor, 'hover-bg-light')}`}
              title="Selecionar fazenda"
            >
              <Icons.Building2 className={`w-4 h-4 flex-shrink-0 ${getThemeClasses(primaryColor, 'text')}`} />
              <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-slate-300 truncate max-w-[200px]">
                {fazendaAtiva ? fazendaAtiva.nome : 'Todas'}
              </span>
              <Icons.ChevronDown 
                className={`w-3.5 h-3.5 text-gray-500 dark:text-slate-400 transition-transform ${fazendaMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown de Fazendas */}
            {fazendaMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 py-2 z-50 max-h-80 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    Selecione a fazenda
                  </p>
                </div>
                
                {/* Opção "Todas as Fazendas" */}
                <button
                  onClick={() => {
                    setFazendaAtiva(null);
                    setFazendaMenuOpen(false);
                    showToast({ message: 'Visualizando todas as fazendas', type: 'success' });
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    !fazendaAtivaId 
                      ? `${getThemeClasses(primaryColor, 'bg-light')} ${getThemeClasses(primaryColor, 'text')}`
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <Icons.Building2 className="w-4 h-4" />
                  <span className="flex-1 text-left">Todas as Fazendas</span>
                  {!fazendaAtivaId && <Icons.Check className="w-4 h-4" />}
                </button>

                {/* Lista de Fazendas */}
                {fazendas.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      Nenhuma fazenda cadastrada
                    </p>
                  </div>
                ) : (
                  fazendas.map((fazenda) => (
                    <button
                      key={fazenda.id}
                      onClick={() => {
                        setFazendaAtiva(fazenda.id);
                        setFazendaMenuOpen(false);
                        showToast({ message: `Visualizando: ${fazenda.nome}`, type: 'success' });
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                        fazendaAtivaId === fazenda.id
                          ? `${getThemeClasses(primaryColor, 'bg-light')} ${getThemeClasses(primaryColor, 'text')}`
                          : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <Icons.MapPin className="w-4 h-4" />
                      <span className="flex-1 text-left truncate">{fazenda.nome}</span>
                      {fazendaAtivaId === fazenda.id && <Icons.Check className="w-4 h-4" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Avatar e Menu do Usuário */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors dark:focus:ring-offset-slate-900 border border-transparent"
              aria-label="Menu do usuário"
              aria-expanded={userMenuOpen}
            >
              {/* Avatar */}
              <div className={`w-9 h-9 rounded-full ${getAvatarColor(user.nome)} flex items-center justify-center text-white font-semibold text-sm shadow-md ring-2 ring-white dark:ring-slate-800`}>
                {getUserInitials(user.nome)}
              </div>
              
              {/* Nome (apenas em telas maiores) */}
              <div className="hidden lg:block text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate max-w-[140px]">
                  {user.nome}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[140px]">
                  {user.email}
                </p>
              </div>

              {/* Ícone de dropdown */}
              <Icons.ChevronDown 
                className={`w-4 h-4 text-gray-500 dark:text-slate-400 ${getThemeClasses(primaryColor, 'hover-text')} transition-transform flex-shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 py-2 z-50 backdrop-blur-sm">
                {/* Header do Menu */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${getAvatarColor(user.nome)} flex items-center justify-center text-white font-semibold text-sm shadow-md flex-shrink-0`}>
                      {getUserInitials(user.nome)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {user.nome}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">
                        {user.email}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Icons.Shield className={`w-3 h-3 ${getThemeClasses(primaryColor, 'text')}`} />
                        <span className="text-xs font-medium text-gray-600 dark:text-slate-400">
                          {roleLabels[user.role] || user.role}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Opções do Menu */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/perfil');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-1"
                  >
                    <Icons.User className="w-4 h-4" />
                    <span>Meu Perfil</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      setSettingsOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-1"
                  >
                    <Icons.Settings className="w-4 h-4" />
                    <span>Configurações</span>
                  </button>

                  <button
                    onClick={handleManualSync}
                    disabled={syncing}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'hover-text')} transition-colors rounded-lg mx-1 disabled:opacity-50 disabled:cursor-not-allowed relative`}
                  >
                    <Icons.RefreshCw 
                      className={`w-4 h-4 transition-transform duration-300 ${syncing ? 'animate-spin' : ''}`}
                    />
                    <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                  </button>

                  <button
                    onClick={async () => {
                      setUserMenuOpen(false);
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
                          title: 'Erro ao exportar',
                          message: 'Não foi possível exportar o backup.'
                        });
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors rounded-lg mx-1"
                  >
                    <Icons.Download className="w-4 h-4" />
                    <span>Backup</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
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
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-1"
                  >
                    <Icons.Trash2 className="w-4 h-4" />
                    <span>Limpar Cache</span>
                  </button>

                  <div className="border-t border-gray-200 dark:border-slate-700 my-1.5" />

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-lg mx-1"
                  >
                    <Icons.LogOut className="w-4 h-4" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Configurações */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header Moderno */}
          <div className="bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-gray-200 dark:border-slate-700 px-8 py-6 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Icons.Settings className="w-5 h-5" />
                Configurações
              </h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5">Personalize alertas, sincronização e aparência do sistema</p>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all duration-200"
              aria-label="Fechar"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-8 space-y-6 overflow-y-auto flex-1">
            {/* Card de Alertas */}
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className={`p-2.5 rounded-lg bg-orange-100 dark:bg-orange-900/20 ${getThemeClasses(primaryColor, 'bg')}`}>
                  <Icons.AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100">Configurações de Alertas</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Defina limites e parâmetros para notificações</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
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
                    className={`w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:shadow-md transition-all ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} dark:bg-slate-800 dark:text-slate-100`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
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
                    className={`w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:shadow-md transition-all ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} dark:bg-slate-800 dark:text-slate-100`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
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
                    className={`w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:shadow-md transition-all ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} dark:bg-slate-800 dark:text-slate-100`}
                  />
                </div>
              </div>
            </div>

            {/* Card de Sincronização */}
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className={`p-2.5 rounded-lg bg-green-100 dark:bg-green-900/20 ${getThemeClasses(primaryColor, 'bg')}`}>
                  <Icons.RefreshCw className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100">Sincronização Automática</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Configure a frequência de sincronização</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Intervalo de sincronização (segundos)
                </label>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={draftAppSettings?.intervaloSincronizacao ?? 30}
                  onChange={(e) => {
                    if (setDraftAppSettings) {
                      setDraftAppSettings((prev: AppSettings) => ({
                        ...prev,
                        intervaloSincronizacao: Number(e.target.value)
                      }));
                    }
                  }}
                  className={`w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:shadow-md transition-all ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} dark:bg-slate-800 dark:text-slate-100`}
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                  <Icons.Info className="w-3.5 h-3.5" />
                  O sistema sincronizará automaticamente a cada {draftAppSettings?.intervaloSincronizacao ?? 30} segundos quando estiver online.
                </p>
              </div>
            </div>

            {/* Card de Aparência */}
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center gap-3 mb-5">
                <div className={`p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/20 ${getThemeClasses(primaryColor, 'bg')}`}>
                  <Icons.Palette className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100">Aparência</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Personalize cores e tema do sistema</p>
                </div>
              </div>
              
              {/* Seleção de Cor Primária */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                  Cor Primária do Tema
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {COLOR_PALETTES && Object.entries(COLOR_PALETTES).map(([key, palette]) => {
                    const isSelected = ((draftAppSettings?.primaryColor) || 'gray') === key;
                    const colorMap: Record<string, string> = {
                      green: '#10b981',
                      blue: '#3b82f6',
                      emerald: '#10b981',
                      teal: '#14b8a6',
                      indigo: '#6366f1',
                      purple: '#a855f7',
                      gray: '#6b7280',
                    };
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (setDraftAppSettings) {
                            setDraftAppSettings((prev: AppSettings) => ({
                              ...prev,
                              primaryColor: key as ColorPaletteKey
                            }));
                          }
                        }}
                        className={`
                          relative flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all duration-200 transform
                          ${isSelected 
                            ? `border-${primaryColor}-500 dark:border-${primaryColor}-400 bg-${primaryColor}-50 dark:bg-${primaryColor}-900/20 shadow-lg scale-105` 
                            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:shadow-md hover:scale-102'
                          }
                        `}
                        title={palette.name}
                      >
                        <div 
                          className={`w-10 h-10 rounded-full shadow-md transition-transform duration-200 ${isSelected ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500' : ''}`}
                          style={{ backgroundColor: colorMap[palette.value] || colorMap.green }}
                        />
                        <span className={`text-xs font-semibold transition-colors ${isSelected ? 'text-gray-900 dark:text-slate-100' : 'text-gray-600 dark:text-slate-400'}`}>
                          {palette.name}
                        </span>
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 bg-gray-900 dark:bg-slate-100 rounded-full p-1 shadow-lg">
                            <Icons.Check className="w-3 h-3 text-white dark:text-gray-900" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Timeout de Inatividade */}
              <div className="pt-5 border-t border-gray-200 dark:border-slate-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Timeout de Inatividade (minutos)
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={draftAppSettings?.timeoutInatividade ?? 15}
                  onChange={(e) => {
                    if (setDraftAppSettings) {
                      setDraftAppSettings((prev: AppSettings) => ({
                        ...prev,
                        timeoutInatividade: Number(e.target.value)
                      }));
                    }
                  }}
                  className={`w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:shadow-md transition-all ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} dark:bg-slate-800 dark:text-slate-100`}
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                  <Icons.Info className="w-3.5 h-3.5" />
                  Logout automático após {draftAppSettings?.timeoutInatividade ?? 15} minutos de inatividade.
                </p>
              </div>
            </div>

            {/* Footer Moderno */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-slate-700 flex-shrink-0 bg-gray-50/50 dark:bg-slate-900/50 -mx-8 -mb-8 px-8 pb-6">
              <button
                type="button"
                onClick={async () => {
                  await resetSettings();
                  await resetAppSettings();
                  // Sincronizar após restaurar as configurações
                  try {
                    const { pushPending } = await import('../api/syncService');
                    await pushPending();
                    showToast({
                      type: 'info',
                      title: 'Configuração padrão',
                      message: 'Configurações restauradas e sincronizadas.'
                    });
                  } catch (error) {
                    console.error('Erro ao sincronizar configurações:', error);
                    showToast({
                      type: 'info',
                      title: 'Configuração padrão',
                      message: 'Configurações restauradas. A sincronização será feita automaticamente.'
                    });
                  }
                }}
                className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 hover:shadow-md transition-all duration-200"
              >
                Restaurar padrão
              </button>
              <button
                type="button"
                onClick={async () => {
                  await saveSettings();
                  await saveAppSettings();
                  // Sincronizar após salvar as configurações
                  try {
                    const { pushPending } = await import('../api/syncService');
                    await pushPending();
                    showToast({
                      type: 'success',
                      title: 'Configurações salvas',
                      message: 'Configurações atualizadas e sincronizadas.'
                    });
                  } catch (error) {
                    console.error('Erro ao sincronizar configurações:', error);
                    showToast({
                      type: 'success',
                      title: 'Configurações salvas',
                      message: 'Configurações atualizadas. A sincronização será feita automaticamente.'
                    });
                  }
                  setSettingsOpen(false);
                }}
                className={`px-6 py-2.5 text-sm font-semibold text-white ${getPrimaryButtonClass(primaryColor)} rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 hover:shadow-lg transform hover:scale-105 transition-all duration-200`}
              >
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ConfirmDialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title || 'Confirmar ação'}
        message={confirmDialog.message}
        variant={confirmDialog.variant || 'danger'}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </header>
  );
}
