import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icons } from "../utils/iconMapping";
import SyncStatus from "./SyncStatus";
import useSync from "../hooks/useSync";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import { showToast } from "../utils/toast";
import { useAppSettings } from "../hooks/useAppSettings";
import { ColorPaletteKey } from "../hooks/useThemeColors";
import {
  getThemeClasses,
  getTitleTextClass,
  getPrimaryButtonClass,
  getThemeToggleButtonClass,
  getSeparatorBorderClass,
} from "../utils/themeHelpers";
import { useNotifications } from "../hooks/useNotifications";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import ConfirmDialog from "./ConfirmDialog";
import { applyTheme, getInitialTheme, Theme } from "../utils/theme";
import { APP_VERSION } from "../utils/version";
import { setGlobalSyncing, getGlobalSyncing } from "../utils/syncState";

// Re-exportar para compatibilidade com TopBar e Sincronizacao
export { setGlobalSyncing, getGlobalSyncing };

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Estado para sidebar recolhida (inicia recolhida)
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed");
      return saved !== null ? saved === "true" : true; // Inicia recolhida por padrão
    }
    return true;
  });

  // Salvar estado no localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
      // Disparar evento para atualizar o layout do App
      window.dispatchEvent(
        new CustomEvent("sidebarToggle", {
          detail: { collapsed: sidebarCollapsed },
        }),
      );
    }
  }, [sidebarCollapsed]);

  // Escutar eventos de toggle do sidebar (atalho Ctrl+B)
  useEffect(() => {
    const handleSidebarToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ collapsed: boolean }>;
      setSidebarCollapsed(customEvent.detail.collapsed);
    };

    window.addEventListener("sidebarToggle", handleSidebarToggle);
    return () =>
      window.removeEventListener("sidebarToggle", handleSidebarToggle);
  }, []);

  // Estado do modal de confirmação
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    variant?: "danger" | "warning" | "info";
  }>({
    open: false,
    message: "",
    onConfirm: () => {},
  });
  const notificacoes = useNotifications();
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  useKeyboardShortcuts();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Hook de sincronização automática
  useSync();

  // Escutar mudanças no estado global de sincronização
  useEffect(() => {
    const handleSyncStateChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ syncing: boolean }>;
      setSyncing(customEvent.detail.syncing);
    };
    window.addEventListener("syncStateChange", handleSyncStateChange);
    setSyncing(getGlobalSyncing()); // Estado inicial
    return () =>
      window.removeEventListener("syncStateChange", handleSyncStateChange);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleManualSync = async () => {
    setSyncing(true);
    setGlobalSyncing(true);
    try {
      const { syncAll } = await import("../api/syncService");
      await syncAll();
      // Se retornou { ran: false }, outra sync já estava em andamento
    } catch (error) {
      console.error("Erro na sincronização manual:", error);
    } finally {
      // Pequeno delay para mostrar feedback visual
      setTimeout(() => {
        setSyncing(false);
        setGlobalSyncing(false);
      }, 300);
    }
  };

  const menuItems = [
    ...(hasPermission("ver_dashboard")
      ? [
          {
            path: "/dashboard",
            label: "Dashboard",
            icon: Icons.LayoutDashboard,
          },
        ]
      : []),
    ...(hasPermission("ver_notificacoes")
      ? [
          {
            path: "/notificacoes",
            label: "Notificações",
            icon: Icons.Bell,
            badge: notificacoes.total > 0 ? notificacoes.total : undefined,
          },
        ]
      : []),
    ...(hasPermission("ver_planilha")
      ? [
          { path: "/animais", label: "Animais", icon: Icons.Cow },
          {
            path: "/pendencias-curral",
            label: "Pendências do Curral",
            icon: Icons.List,
          },
        ]
      : []),
    ...(hasPermission("ver_confinamentos")
      ? [
          {
            path: "/confinamentos",
            label: "Confinamentos",
            icon: Icons.Warehouse,
          },
        ]
      : []),
    ...(hasPermission("ver_fazendas")
      ? [{ path: "/fazendas", label: "Fazendas", icon: Icons.Building2 }]
      : []),
    ...(hasPermission("ver_sincronizacao")
      ? [
          {
            path: "/sincronizacao",
            label: "Sincronização",
            icon: Icons.RefreshCw,
          },
        ]
      : []),
    ...(hasPermission("gerar_relatorios")
      ? [{ path: "/relatorios", label: "Relatórios", icon: Icons.BarChart3 }]
      : []),
    ...(hasPermission("ver_usuarios") || hasPermission("gerenciar_usuarios")
      ? [{ path: "/usuarios", label: "Usuários", icon: Icons.Users }]
      : []),
    ...(isAdmin()
      ? [{ path: "/permissoes", label: "Permissões", icon: Icons.Shield }]
      : []),
  ];

  const isActive = (path: string) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;

  // Helper para obter classes de gradiente do header
  const getHeaderGradient = () => {
    const gradients: Record<ColorPaletteKey, string> = {
      green:
        "from-green-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900",
      blue: "from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900",
      emerald:
        "from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-900",
      teal: "from-teal-50 to-cyan-50 dark:from-slate-800 dark:to-slate-900",
      indigo: "from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-900",
      purple: "from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-900",
      gray: "from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-900",
    };
    return gradients[primaryColor] || gradients.green;
  };

  // Helper para obter classes de item ativo do menu
  const getActiveMenuClasses = () => {
    const classes: Record<
      ColorPaletteKey,
      { bg: string; text: string; border: string; icon: string }
    > = {
      green: {
        bg: "bg-green-100 dark:bg-green-500/50",
        text: "text-green-700 dark:text-green-300",
        border: "border-green-600 dark:border-green-400",
        icon: "text-green-600 dark:text-green-400",
      },
      blue: {
        bg: "bg-blue-100 dark:bg-blue-500/50",
        text: "text-blue-700 dark:text-blue-300",
        border: "border-blue-600 dark:border-blue-400",
        icon: "text-blue-600 dark:text-blue-400",
      },
      emerald: {
        bg: "bg-emerald-100 dark:bg-emerald-500/50",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-600 dark:border-emerald-400",
        icon: "text-emerald-600 dark:text-emerald-400",
      },
      teal: {
        bg: "bg-teal-100 dark:bg-teal-500/50",
        text: "text-teal-700 dark:text-teal-300",
        border: "border-teal-600 dark:border-teal-400",
        icon: "text-teal-600 dark:text-teal-400",
      },
      indigo: {
        bg: "bg-indigo-100 dark:bg-indigo-500/50",
        text: "text-indigo-700 dark:text-indigo-300",
        border: "border-indigo-600 dark:border-indigo-400",
        icon: "text-indigo-600 dark:text-indigo-400",
      },
      purple: {
        bg: "bg-purple-100 dark:bg-purple-500/50",
        text: "text-purple-700 dark:text-purple-300",
        border: "border-purple-600 dark:border-purple-400",
        icon: "text-purple-600 dark:text-purple-400",
      },
      gray: {
        bg: "bg-gray-100 dark:bg-gray-500/50",
        text: "text-gray-700 dark:text-gray-300",
        border: "border-gray-600 dark:border-gray-400",
        icon: "text-gray-600 dark:text-gray-400",
      },
    };
    return classes[primaryColor] || classes.green;
  };

  // Helper para obter classes de item inativo do menu
  const getInactiveMenuClasses = () => {
    const classes: Record<
      ColorPaletteKey,
      { text: string; hover: string; icon: string }
    > = {
      green: {
        text: "text-green-700 dark:text-green-300",
        hover:
          "hover:bg-green-100 hover:text-green-900 dark:hover:bg-green-500/50 dark:hover:text-green-200",
        icon: "text-green-500 dark:text-green-400 group-hover:text-green-700 dark:group-hover:text-green-200",
      },
      blue: {
        text: "text-blue-700 dark:text-blue-300",
        hover:
          "hover:bg-blue-100 hover:text-blue-900 dark:hover:bg-blue-500/50 dark:hover:text-blue-200",
        icon: "text-blue-500 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-200",
      },
      emerald: {
        text: "text-emerald-700 dark:text-emerald-300",
        hover:
          "hover:bg-emerald-100 hover:text-emerald-900 dark:hover:bg-emerald-500/50 dark:hover:text-emerald-200",
        icon: "text-emerald-500 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-200",
      },
      teal: {
        text: "text-teal-700 dark:text-teal-300",
        hover:
          "hover:bg-teal-100 hover:text-teal-900 dark:hover:bg-teal-500/50 dark:hover:text-teal-200",
        icon: "text-teal-500 dark:text-teal-400 group-hover:text-teal-700 dark:group-hover:text-teal-200",
      },
      indigo: {
        text: "text-indigo-700 dark:text-indigo-300",
        hover:
          "hover:bg-indigo-100 hover:text-indigo-900 dark:hover:bg-indigo-500/50 dark:hover:text-indigo-200",
        icon: "text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-200",
      },
      purple: {
        text: "text-purple-700 dark:text-purple-300",
        hover:
          "hover:bg-purple-100 hover:text-purple-900 dark:hover:bg-purple-500/50 dark:hover:text-purple-200",
        icon: "text-purple-500 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-200",
      },
      gray: {
        text: "text-gray-700 dark:text-gray-300",
        hover:
          "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-500/50 dark:hover:text-gray-200",
        icon: "text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200",
      },
    };
    return classes[primaryColor] || classes.green;
  };

  const activeClasses = getActiveMenuClasses();
  const inactiveClasses = getInactiveMenuClasses();

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
        className="fixed top-3 left-3 p-2 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 lg:hidden z-[70] touch-manipulation"
        aria-label={sidebarOpen ? "Fechar menu" : "Abrir menu"}
      >
        {sidebarOpen ? (
          <Icons.X className="w-4  h-4 text-gray-600 dark:text-slate-300" />
        ) : (
          <Icons.Menu className="w-4 h-4 text-gray-600 dark:text-slate-300" />
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
          fixed top-0 left-0 h-screen bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 shadow-sm
          transform transition-all duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0 w-64 z-50" : "-translate-x-full z-40"}
          lg:translate-x-0 lg:z-[30]
          ${sidebarCollapsed ? "lg:w-16" : "lg:w-64"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header Completo e Profissional */}
          <div
            className={`border-b border-gray-200 dark:border-slate-700 bg-gradient-to-br ${getHeaderGradient()} relative ${sidebarCollapsed && !sidebarOpen ? "p-3" : "p-4"}`}
          >
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
                      target.style.display = "none";
                      if (target.parentElement) {
                        const colorMap: Record<ColorPaletteKey, string> = {
                          green: "from-green-500 to-emerald-600",
                          blue: "from-blue-500 to-indigo-600",
                          emerald: "from-emerald-500 to-teal-600",
                          teal: "from-teal-500 to-cyan-600",
                          indigo: "from-indigo-500 to-blue-600",
                          purple: "from-purple-500 to-pink-600",
                          gray: "from-gray-500 to-gray-600",
                        };
                        target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br ${colorMap[primaryColor] || colorMap.green}"><svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2L3 7v11h4v-6h6v6h4V7l-7-5z"/></svg></div>`;
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
                  <Icons.ChevronLeft
                    className={`w-4 h-4 ${getTitleTextClass(primaryColor)}`}
                  />
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
                          target.style.display = "none";
                          if (target.parentElement) {
                            const colorMap: Record<ColorPaletteKey, string> = {
                              green: "from-green-500 to-green-600",
                              blue: "from-blue-500 to-blue-600",
                              emerald: "from-emerald-500 to-emerald-600",
                              teal: "from-teal-500 to-teal-600",
                              indigo: "from-indigo-500 to-indigo-600",
                              purple: "from-purple-500 to-purple-600",
                              gray: "from-gray-500 to-gray-600",
                            };
                            target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br ${colorMap[primaryColor] || colorMap.green}"><svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2L3 7v11h4v-6h6v6h4V7l-7-5z"/></svg></div>`;
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1
                        className={`text-sm font-bold ${getTitleTextClass(primaryColor)} leading-tight`}
                      >
                        Gerenciador de Fazendas
                      </h1>
                      <p
                        className={`text-xs ${getThemeClasses(primaryColor, "text")} mt-0.5`}
                      >
                        Sistema de Gestão
                      </p>
                    </div>
                  </div>

                  {/* Status e Tema */}
                  <div
                    className={`flex items-center gap-2 mt-3 pt-3 border-t ${getSeparatorBorderClass(primaryColor)}`}
                  >
                    <SyncStatus collapsed={false} />
                    <div className="flex-1"></div>
                    <button
                      onClick={toggleTheme}
                      className={`inline-flex items-center justify-center rounded-lg border ${getThemeToggleButtonClass(primaryColor)} backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium transition-all shadow-sm flex-shrink-0`}
                      title={
                        theme === "dark"
                          ? "Alternar para modo claro"
                          : "Alternar para modo escuro"
                      }
                    >
                      {theme === "dark" ? (
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
                        ${sidebarCollapsed && !sidebarOpen ? "justify-center" : ""}
                        ${
                          active
                            ? `${activeClasses.bg} ${activeClasses.text} border-l-3 ${activeClasses.border} shadow-sm`
                            : `${inactiveClasses.text} ${inactiveClasses.hover}`
                        }
                      `}
                      title={sidebarCollapsed && !sidebarOpen ? item.label : ""}
                      aria-label={item.label}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 transition-colors ${
                          active ? activeClasses.icon : inactiveClasses.icon
                        }`}
                      />
                      {(!sidebarCollapsed || sidebarOpen) && (
                        <>
                          <span className="font-medium text-sm whitespace-nowrap flex-1">
                            {item.label}
                          </span>
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
            <div className="px-3 py-2.5">
              {/* Versão da aplicação */}
              <div
                className={`flex items-center ${sidebarCollapsed && !sidebarOpen ? "justify-center" : "justify-center"} px-2.5 py-1.5 text-[10px] text-gray-400 dark:text-slate-500 font-mono`}
              >
                {sidebarCollapsed && !sidebarOpen ? (
                  <span title={`Versão ${APP_VERSION}`}>v{APP_VERSION}</span>
                ) : (
                  <span>v{APP_VERSION}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Modal de Confirmação */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
}
