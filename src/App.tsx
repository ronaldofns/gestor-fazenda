import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import SplashScreen from './components/SplashScreen';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import { ToastContainer } from './components/Toast';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import TopBar from './components/TopBar';
import { cleanupExpiredLocks } from './utils/recordLock';
import { FazendaContextProvider } from './hooks/useFazendaContext';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';

// Lazy loading das rotas para melhorar performance inicial
const Login = lazy(() => import('./routes/Login'));
const SetupInicial = lazy(() => import('./routes/SetupInicial'));
const Dashboard = lazy(() => import('./routes/Dashboard'));
const Home = lazy(() => import('./routes/Home'));
const Matrizes = lazy(() => import('./routes/Matrizes'));
const Notificacoes = lazy(() => import('./routes/Notificacoes'));
const CadastroDesmama = lazy(() => import('./routes/CadastroDesmama'));
const ListaFazendas = lazy(() => import('./routes/ListaFazendas'));
const ImportarPlanilha = lazy(() => import('./routes/ImportarPlanilha'));
const ListaUsuarios = lazy(() => import('./routes/ListaUsuarios'));
const Permissoes = lazy(() => import('./routes/Permissoes'));
const Perfil = lazy(() => import('./routes/Perfil'));
const Configuracoes = lazy(() => import('./routes/Configuracoes'));
const Sincronizacao = lazy(() => import('./routes/Sincronizacao'));

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
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={<SetupInicial />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="flex min-h-screen">
                    <Sidebar />
                    <div className={`flex-1 min-h-screen transition-all duration-300 flex flex-col ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
                      <TopBar />
                      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-slate-950">
                        <Suspense fallback={<RouteLoader />}>
                          <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={
                              <ProtectedRoute requiredPermission="ver_dashboard">
                                <Dashboard />
                              </ProtectedRoute>
                            } />
                            <Route path="/planilha" element={
                              <ProtectedRoute requiredPermission="ver_planilha">
                                <Home />
                              </ProtectedRoute>
                            } />
                            <Route path="/matrizes" element={
                              <ProtectedRoute requiredPermission="ver_matrizes">
                                <Matrizes />
                              </ProtectedRoute>
                            } />
                            <Route path="/notificacoes" element={
                              <ProtectedRoute requiredPermission="ver_notificacoes">
                                <Notificacoes />
                              </ProtectedRoute>
                            } />
                            <Route path="/desmama/:nascimentoId" element={
                              <ProtectedRoute requiredPermission={["cadastrar_desmama", "editar_desmama"]}>
                                <CadastroDesmama />
                              </ProtectedRoute>
                            } />
                            <Route path="/fazendas" element={
                              <ProtectedRoute requiredPermission="ver_fazendas">
                                <ListaFazendas />
                              </ProtectedRoute>
                            } />
                            <Route path="/importar-planilha" element={
                              <ProtectedRoute requiredPermission="importar_planilha">
                                <ImportarPlanilha />
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
                            <Route path="/perfil" element={<Perfil />} />
                            <Route path="/configuracoes" element={<Configuracoes />} />
                            <Route path="/sincronizacao" element={
                              <ProtectedRoute requiredPermission="ver_sincronizacao">
                                <Sincronizacao />
                              </ProtectedRoute>
                            } />
                          </Routes>
                        </Suspense>
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </div>
    </FazendaContextProvider>
  );
}
