import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../hooks/useAuth';
import { useFazendaContext } from '../hooks/useFazendaContext';
import { usePermissions } from '../hooks/usePermissions';
import { db } from '../db/dexieDB';
import { Icons } from '../utils/iconMapping';
import { showToast } from '../utils/toast';
import { setGlobalSyncing, getGlobalSyncing } from './Sidebar';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses, getTitleTextClass, getPrimaryButtonClass } from '../utils/themeHelpers';
import ConfirmDialog from './ConfirmDialog';

// Mapeamento de rotas para títulos e subtítulos
const routeMetadata: Record<string, { title: string; subtitle: string; icon?: keyof typeof Icons }> = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Visão geral do seu rebanho',
    icon: 'LayoutDashboard'
  },
  '/animais': {
    title: 'Animais',
    subtitle: 'Cadastro e gestão de animais',
    icon: 'Cow'
  },
  '/pendencias-curral': {
    title: 'Pendências do Curral',
    subtitle: 'Bezerros sem desmama, vacinas vencidas, sem pesagem recente',
    icon: 'List'
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
  '/usuarios': {
    title: 'Usuários',
    subtitle: 'Gerenciar usuários do sistema',
    icon: 'Users'
  },
  '/permissoes': {
    title: 'Permissões',
    subtitle: 'Incluir e remover permissões por role',
    icon: 'Shield'
  },
  '/relatorios': {
    title: 'Relatórios',
    subtitle: 'Comparativos temporais e análises',
    icon: 'BarChart3'
  },
  '/sincronizacao': {
    title: 'Sincronização',
    subtitle: 'Status e fila de sincronização',
    icon: 'RefreshCw'
  },
  '/perfil': {
    title: 'Meu Perfil',
    subtitle: 'Dados e preferências da sua conta',
    icon: 'User'
  },
  '/configuracoes': {
    title: 'Configurações',
    subtitle: 'Preferências do aplicativo',
    icon: 'Settings'
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
  const { hasPermission } = usePermissions();
  const podeExportarDados = hasPermission('exportar_dados');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [fazendaMenuOpen, setFazendaMenuOpen] = useState(false);
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
  const fazendaButtonRef = useRef<HTMLButtonElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const [fazendaDropdownPosition, setFazendaDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const [userDropdownPosition, setUserDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const { appSettings, saveSettings } = useAppSettings();
  
  // Buscar fazendas disponíveis
  const fazendas = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const fazendaAtiva = fazendas.find(f => f.id === fazendaAtivaId);

  // Função para calcular posição do dropdown de fazendas
  const calculateFazendaPosition = useCallback(() => {
    if (fazendaButtonRef.current) {
      const rect = fazendaButtonRef.current.getBoundingClientRect();
      const dropdownWidth = 256; // w-64 = 256px
      const right = window.innerWidth - rect.right;
      const left = rect.left;
      
      // Se não couber à direita, ajustar para a esquerda
      const finalRight = right + dropdownWidth > window.innerWidth - 16 
        ? window.innerWidth - left - 16 
        : right;
      
      setFazendaDropdownPosition({
        top: rect.bottom + 8,
        right: Math.max(16, finalRight)
      });
    }
  }, []);

  // Função para calcular posição do dropdown do usuário
  const calculateUserPosition = useCallback(() => {
    if (userButtonRef.current) {
      const rect = userButtonRef.current.getBoundingClientRect();
      const dropdownWidth = 256; // w-64 = 256px
      const right = window.innerWidth - rect.right;
      const left = rect.left;
      
      // Se não couber à direita, ajustar para a esquerda
      const finalRight = right + dropdownWidth > window.innerWidth - 16 
        ? window.innerWidth - left - 16 
        : right;
      
      setUserDropdownPosition({
        top: rect.bottom + 8,
        right: Math.max(16, finalRight)
      });
    }
  }, []);

  // Calcular posição dos dropdowns quando abrem
  useEffect(() => {
    if (fazendaMenuOpen) {
      calculateFazendaPosition();
      window.addEventListener('resize', calculateFazendaPosition);
      window.addEventListener('scroll', calculateFazendaPosition, true);
      return () => {
        window.removeEventListener('resize', calculateFazendaPosition);
        window.removeEventListener('scroll', calculateFazendaPosition, true);
      };
    } else {
      setFazendaDropdownPosition(null);
    }
  }, [fazendaMenuOpen, calculateFazendaPosition]);

  useEffect(() => {
    if (userMenuOpen) {
      calculateUserPosition();
      window.addEventListener('resize', calculateUserPosition);
      window.addEventListener('scroll', calculateUserPosition, true);
      return () => {
        window.removeEventListener('resize', calculateUserPosition);
        window.removeEventListener('scroll', calculateUserPosition, true);
      };
    } else {
      setUserDropdownPosition(null);
    }
  }, [userMenuOpen, calculateUserPosition]);

  // Obter metadados da rota atual
  const currentRoute = location.pathname;
  const metadata = routeMetadata[currentRoute] || {
    title: 'Gestor Fazenda',
    subtitle: 'Sistema de Gestão de Rebanho'
  };

  // Fechar menus ao clicar fora (excluir cliques dentro dos portais que estão em document.body)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuOpen && menuRef.current && !menuRef.current.contains(target)) {
        const inPortal = (target as Element).closest?.('[data-portal="user-menu"]');
        if (!inPortal) setUserMenuOpen(false);
      }
      if (fazendaMenuOpen && fazendaMenuRef.current && !fazendaMenuRef.current.contains(target)) {
        const inPortal = (target as Element).closest?.('[data-portal="fazenda-menu"]');
        if (!inPortal) setFazendaMenuOpen(false);
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
      const { ran } = await syncAll();
      if (ran) {
        showToast({
          type: 'success',
          title: 'Sincronização concluída',
          message: 'Todos os dados foram sincronizados com sucesso.'
        });
      } else {
        showToast({
          type: 'info',
          title: 'Sincronização em andamento',
          message: 'Uma sincronização já está em execução. Aguarde a conclusão.'
        });
      }
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
  const primaryColor = (appSettings?.primaryColor || 'gray') as ColorPaletteKey;

  // Verificar se sidebar está recolhida em telas menores
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  useEffect(() => {
    const handleSidebarToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ collapsed: boolean }>;
      setSidebarCollapsed(customEvent.detail.collapsed);
    };
    
    window.addEventListener('sidebarToggle', handleSidebarToggle);
    return () => window.removeEventListener('sidebarToggle', handleSidebarToggle);
  }, []);

  return (
    <header className="sticky top-0 z-[60] bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-slate-700 shadow-sm overflow-x-hidden">
      <div className={`flex items-center justify-between pr-2 sm:pr-4 md:px-6 lg:px-8 h-16 w-full min-w-0 overflow-x-hidden pl-14 md:pl-16 lg:pl-0`}>
        {/* Título e Subtítulo (Esquerda) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {IconComponent && (
            <div className={`hidden sm:flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${getThemeClasses(primaryColor, 'gradient-from')} ${getThemeClasses(primaryColor, 'text')} flex-shrink-0 shadow-sm`}>
              <IconComponent className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1 overflow-hidden">
            <h1 className={`text-sm sm:text-base md:text-lg font-semibold ${getTitleTextClass(primaryColor)} truncate`}>
              {metadata.title}
            </h1>
            <p className={`text-xs ${getThemeClasses(primaryColor, 'text')} truncate mt-0.5`}>
              {metadata.subtitle}
            </p>
          </div>
        </div>

        {/* Informações do Usuário (Direita) */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 flex-shrink-0 min-w-0">
          {/* Seletor de Fazenda */}
          <div className="relative flex-shrink-0" ref={fazendaMenuRef} style={{ zIndex: 9999 }}>
            <button
              ref={fazendaButtonRef}
              onClick={() => setFazendaMenuOpen(!fazendaMenuOpen)}
              className={`flex items-center gap-1 sm:gap-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl px-2 sm:px-3 py-2 transition-all ${getThemeClasses(primaryColor, 'hover-bg-light')} min-w-0`}
              title="Selecionar fazenda"
            >
              <Icons.Building2 className={`w-4 h-4 flex-shrink-0 ${getThemeClasses(primaryColor, 'text')}`} />
              <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-slate-300 truncate max-w-[120px] lg:max-w-[200px]">
                {fazendaAtiva ? fazendaAtiva.nome : 'Todas'}
              </span>
              <Icons.ChevronDown 
                className={`w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-slate-400 transition-transform ${fazendaMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown de Fazendas */}
            {fazendaMenuOpen && fazendaDropdownPosition && createPortal(
              <div data-portal="fazenda-menu">
                <div className="fixed inset-0 z-[9998]" onClick={() => setFazendaMenuOpen(false)} aria-hidden="true" />
                <div 
                  className="fixed rounded-xl shadow-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 py-2 max-h-80 overflow-y-auto overflow-x-hidden"
                  style={{ 
                    top: `${fazendaDropdownPosition.top}px`, 
                    right: `${fazendaDropdownPosition.right}px`,
                    width: `${Math.min(256, Math.max(200, window.innerWidth - fazendaDropdownPosition.right - 16))}px`,
                    maxWidth: 'calc(100vw - 32px)',
                    minWidth: '200px',
                    zIndex: 9999
                  }}
                >
                <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-50 min-w-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide truncate">
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
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors min-w-0 ${
                    !fazendaAtivaId 
                      ? `${getThemeClasses(primaryColor, 'bg-light')} ${getThemeClasses(primaryColor, 'text')}`
                      : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <Icons.Building2 className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left truncate min-w-0">Todas as Fazendas</span>
                  {!fazendaAtivaId && <Icons.Check className="w-4 h-4 flex-shrink-0" />}
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
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg mx-1 min-w-0 ${
                        fazendaAtivaId === fazenda.id
                          ? `${getThemeClasses(primaryColor, 'bg-light')} ${getThemeClasses(primaryColor, 'text')}`
                          : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <Icons.MapPin className={`w-4 h-4 flex-shrink-0 ${fazendaAtivaId === fazenda.id ? '' : 'text-gray-500 dark:text-slate-400'}`} />
                      <span className="flex-1 text-left truncate min-w-0">{fazenda.nome}</span>
                      {fazendaAtivaId === fazenda.id && <Icons.Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  ))
                )}
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Toggle Modo Curral (v0.4) */}
          <button
            onClick={() => saveSettings({ modoCurral: !appSettings.modoCurral })}
            className={`flex items-center gap-1 sm:gap-2 rounded-xl px-2 sm:px-3 py-2 transition-all border flex-shrink-0 ${
              appSettings.modoCurral
                ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
            title={appSettings.modoCurral ? 'Modo Curral ativo (clique para desativar)' : 'Ativar Modo Curral (fonte maior, alto contraste)'}
            aria-label={appSettings.modoCurral ? 'Desativar modo Curral' : 'Ativar modo Curral'}
          >
            <Icons.Sun className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline text-sm font-medium">
              {appSettings.modoCurral ? 'Curral' : 'Escritório'}
            </span>
          </button>

          {/* Avatar e Menu do Usuário */}
          <div className="relative flex-shrink-0" ref={menuRef} style={{ zIndex: 9999 }}>
            <button
              ref={userButtonRef}
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2.5 py-1.5 rounded-lg transition-colors dark:focus:ring-offset-slate-900 border border-transparent min-w-0"
              aria-label="Menu do usuário"
              aria-expanded={userMenuOpen}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full ${getAvatarColor(user.nome)} flex items-center justify-center text-white font-semibold text-xs sm:text-sm shadow-md ring-2 ring-white dark:ring-slate-800 flex-shrink-0`}>
                {getUserInitials(user.nome)}
              </div>
              
              {/* Nome (apenas em telas maiores) */}
              <div className="hidden lg:block text-left min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate max-w-[120px] xl:max-w-[140px]">
                  {user.nome}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate max-w-[120px] xl:max-w-[140px]">
                  {user.email}
                </p>
              </div>

              {/* Ícone de dropdown */}
              <Icons.ChevronDown 
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 dark:text-slate-400 ${getThemeClasses(primaryColor, 'hover-text')} transition-transform flex-shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && userDropdownPosition && createPortal(
              <div data-portal="user-menu">
                <div className="fixed inset-0 z-[9998]" onClick={() => setUserMenuOpen(false)} aria-hidden="true" />
                <div 
                  className="fixed rounded-xl shadow-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 py-2 backdrop-blur-sm overflow-x-hidden"
                  style={{ 
                    top: `${userDropdownPosition.top}px`, 
                    right: `${userDropdownPosition.right}px`,
                    width: `${Math.min(256, Math.max(200, window.innerWidth - userDropdownPosition.right - 16))}px`,
                    maxWidth: 'calc(100vw - 32px)',
                    minWidth: '200px',
                    zIndex: 9999
                  }}
                >
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
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-1 min-w-0"
                  >
                    <Icons.User className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate min-w-0">Meu Perfil</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/configuracoes');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-1 min-w-0"
                  >
                    <Icons.Settings className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate min-w-0">Configurações</span>
                  </button>

                  <button
                    onClick={handleManualSync}
                    disabled={syncing}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'hover-text')} transition-colors rounded-lg mx-1 disabled:opacity-50 disabled:cursor-not-allowed relative min-w-0`}
                  >
                    <Icons.RefreshCw 
                      className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${syncing ? 'animate-spin' : ''}`}
                    />
                    <span className="truncate min-w-0">{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                  </button>

                  {podeExportarDados && (
                  <button
                    onClick={async () => {
                      setUserMenuOpen(false);
                      try {
                        const { exportarBackupCompleto } = await import('../utils/exportarDados');
                        const resultado = await exportarBackupCompleto();
                        const totais = resultado.totalRegistros;
                        const detalhes = [
                          `Fazendas: ${totais.totalFazendas}`,
                          `Raças: ${totais.totalRacas}`,
                          `Categorias: ${totais.totalCategorias}`,
                          `Matrizes: ${totais.totalMatrizes}`,
                          `Nascimentos: ${totais.totalNascimentos}`,
                          `Desmamas: ${totais.totalDesmamas}`,
                          `Pesagens: ${totais.totalPesagens}`,
                          `Vacinações: ${totais.totalVacinacoes}`,
                          `Usuários: ${totais.totalUsuarios}`
                        ].join('\n');
                        
                        showToast({
                          type: 'success',
                          title: 'Backup exportado com sucesso!',
                          message: `Arquivo: ${resultado.nomeArquivo}\n\n${detalhes}`,
                          duration: 5000
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
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors rounded-lg mx-1 min-w-0"
                  >
                    <Icons.Download className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate min-w-0">Exportar Backup</span>
                  </button>
                  )}

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      // Criar input file invisível
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.json';
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;

                        try {
                          const { importarBackup } = await import('../utils/exportarDados');
                          const resultado = await importarBackup(file);
                          
                          if (resultado.sucesso) {
                            const totais = resultado.totais?.importados;
                            if (totais) {
                              const detalhes = Object.entries(totais)
                                .filter(([, value]) => (value as number) > 0)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join('\n');
                              
                              showToast({
                                type: 'success',
                                title: 'Backup importado!',
                                message: detalhes || resultado.mensagem,
                                duration: 5000
                              });
                            } else {
                              showToast({
                                type: 'info',
                                title: 'Backup processado',
                                message: resultado.mensagem
                              });
                            }
                          } else {
                            showToast({
                              type: 'error',
                              title: 'Erro ao importar',
                              message: resultado.mensagem
                            });
                          }
                        } catch (error) {
                          console.error('Erro ao importar backup:', error);
                          showToast({
                            type: 'error',
                            title: 'Erro ao importar',
                            message: 'Não foi possível importar o backup.'
                          });
                        }
                      };
                      input.click();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors rounded-lg mx-1 min-w-0"
                  >
                    <Icons.Upload className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate min-w-0">Importar Backup</span>
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
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors rounded-lg mx-1 min-w-0"
                  >
                    <Icons.Trash2 className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate min-w-0">Limpar Cache</span>
                  </button>

                  <div className="border-t border-gray-200 dark:border-slate-700 my-1.5" />

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-lg mx-1 min-w-0"
                  >
                    <Icons.LogOut className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate min-w-0">Sair</span>
                  </button>
                </div>
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

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
