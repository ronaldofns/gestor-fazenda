import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import SplashScreen from './components/SplashScreen';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import { ToastContainer } from './components/Toast';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import useOnline from './hooks/useOnline';
import { useAppSettings } from './hooks/useAppSettings';
import TopBar from './components/TopBar';
import { cleanupExpiredLocks } from './utils/recordLock';
import { FazendaContextProvider } from './hooks/useFazendaContext';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';
import ErrorPage from './components/ErrorPage';

// Lazy loading das rotas para melhorar performance inicial
const Login = lazy(() => import('./routes/Login'));
const SetupInicial = lazy(() => import('./routes/SetupInicial'));
const Dashboard = lazy(() => import('./routes/Dashboard'));
const Notificacoes = lazy(() => import('./routes/Notificacoes'));
const ListaFazendas = lazy(() => import('./routes/ListaFazendas'));
const ListaUsuarios = lazy(() => import('./routes/ListaUsuarios'));
const Permissoes = lazy(() => import('./routes/Permissoes'));
const Perfil = lazy(() => import('./routes/Perfil'));
const Configuracoes = lazy(() => import('./routes/Configuracoes'));
const Sincronizacao = lazy(() => import('./routes/Sincronizacao'));
const Animais = lazy(() => import('./routes/Animais'));
const PendenciasCurral = lazy(() => import('./routes/PendenciasCurral'));
const Relatorios = lazy(() => import('./routes/Relatorios'));
const ListaConfinamentos = lazy(() => import('./routes/ListaConfinamentos'));
const DetalheConfinamento = lazy(() => import('./routes/DetalheConfinamento'));

// Componente de loading para Suspense
function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-green-600 dark:border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-gray-600 dark:text-slate-400 text-sm">Carregando...</div>
      </div>
    </div>
  );
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved !== null ? saved === 'true' : true; // Inicia recolhida por padrão
    }
    return true;
  });

  // Hook para detectar inatividade e fazer logout automático
  useInactivityTimeout();
  
  // Hook para atalhos globais de teclado
  useGlobalShortcuts();
  const online = useOnline();
  const { appSettings } = useAppSettings();

  // Limpar locks expirados ao iniciar o app e periodicamente
  useEffect(() => {
    // Limpar imediatamente ao iniciar
    cleanupExpiredLocks().catch(console.error);

    // Limpar a cada 5 minutos
    const interval = setInterval(() => {
      cleanupExpiredLocks().catch(console.error);
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleSidebarToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ collapsed: boolean }>;
      setSidebarCollapsed(customEvent.detail.collapsed);
    };

    window.addEventListener('sidebarToggle', handleSidebarToggle);
    return () => window.removeEventListener('sidebarToggle', handleSidebarToggle);
  }, []);

  return (
    <FazendaContextProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
        <ToastContainer />
        <SplashScreen />
        <OfflineIndicator />
        <InstallPrompt />
        <PWAUpdatePrompt />
        <KeyboardShortcutsHelp />
        <ErrorBoundary>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={<SetupInicial />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className={`flex min-h-screen transition-[padding] ${!online ? 'pt-12' : ''} ${appSettings.modoCurral ? 'mode-curral' : ''} overflow-x-hidden`}>
                    <Sidebar />
                    <div className={`flex-1 min-h-screen transition-all duration-300 flex flex-col ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'} overflow-x-hidden`}>
                      <TopBar />
                      <main className="flex-1 overflow-auto overflow-x-hidden bg-gray-50 dark:bg-slate-950 pt-16">
                        <ErrorBoundary>
                          <Suspense fallback={<RouteLoader />}>
                            <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={
                              <ProtectedRoute requiredPermission="ver_dashboard">
                                <Dashboard />
                              </ProtectedRoute>
                            } />
                            <Route path="/planilha" element={<Navigate to="/animais" replace />} />
                            <Route path="/matrizes" element={<Navigate to="/animais" replace />} />
                            <Route path="/desmama/:animalId" element={<Navigate to="/animais" replace />} />
                            <Route path="/animais" element={
                              <ProtectedRoute requiredPermission="ver_planilha">
                                <Animais />
                              </ProtectedRoute>
                            } />
                            <Route path="/pendencias-curral" element={
                              <ProtectedRoute requiredPermission="ver_planilha">
                                <PendenciasCurral />
                              </ProtectedRoute>
                            } />
                            <Route path="/notificacoes" element={
                              <ProtectedRoute requiredPermission="ver_notificacoes">
                                <Notificacoes />
                              </ProtectedRoute>
                            } />
                            <Route path="/fazendas" element={
                              <ProtectedRoute requiredPermission="ver_fazendas">
                                <ListaFazendas />
                              </ProtectedRoute>
                            } />
                            <Route path="/usuarios" element={
                              <ProtectedRoute requiredPermission="ver_usuarios">
                                <ListaUsuarios />
                              </ProtectedRoute>
                            } />
                            <Route path="/permissoes" element={
                              <ProtectedRoute requiredRole="admin">
                                <Permissoes />
                              </ProtectedRoute>
                            } />
                            <Route path="/relatorios" element={
                              <ProtectedRoute requiredPermission="gerar_relatorios">
                                <Relatorios />
                              </ProtectedRoute>
                            } />
                            <Route path="/confinamentos" element={
                              <ProtectedRoute requiredPermission="ver_confinamentos">
                                <ListaConfinamentos />
                              </ProtectedRoute>
                            } />
                            <Route path="/confinamentos/:confinamentoId" element={
                              <ProtectedRoute requiredPermission="ver_confinamentos">
                                <DetalheConfinamento />
                              </ProtectedRoute>
                            } />
                            <Route path="/perfil" element={<Perfil />} />
                            <Route path="/configuracoes" element={<Configuracoes />} />
                            <Route path="/sincronizacao" element={
                              <ProtectedRoute requiredPermission="ver_sincronizacao">
                                <Sincronizacao />
                              </ProtectedRoute>
                            } />
                            <Route path="*" element={<ErrorPage variant="not_found" code={404} />} />
                            </Routes>
                          </Suspense>
                        </ErrorBoundary>
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </FazendaContextProvider>
  );
}
