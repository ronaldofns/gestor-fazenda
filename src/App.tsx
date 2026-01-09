import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './routes/Home';
import Dashboard from './routes/Dashboard';
import CadastroDesmama from './routes/CadastroDesmama';
import ListaFazendas from './routes/ListaFazendas';
import ImportarPlanilha from './routes/ImportarPlanilha';
import Login from './routes/Login';
import SetupInicial from './routes/SetupInicial';
import ListaUsuarios from './routes/ListaUsuarios';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import SplashScreen from './components/SplashScreen';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import { ToastContainer } from './components/Toast';
import Notificacoes from './routes/Notificacoes';
import Matrizes from './routes/Matrizes';
import Permissoes from './routes/Permissoes';
import Perfil from './routes/Perfil';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import TopBar from './components/TopBar';

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

  useEffect(() => {
    const handleSidebarToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ collapsed: boolean }>;
      setSidebarCollapsed(customEvent.detail.collapsed);
    };

    window.addEventListener('sidebarToggle', handleSidebarToggle);
    return () => window.removeEventListener('sidebarToggle', handleSidebarToggle);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <ToastContainer />
      <SplashScreen />
      <OfflineIndicator />
      <InstallPrompt />
      <PWAUpdatePrompt />
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
                    <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/planilha" element={<Home />} />
                    <Route path="/matrizes" element={<Matrizes />} />
                    <Route path="/notificacoes" element={<Notificacoes />} />
                  <Route path="/desmama/:nascimentoId" element={<CadastroDesmama />} />
                  <Route path="/fazendas" element={<ListaFazendas />} />
                    <Route path="/importar-planilha" element={<ImportarPlanilha />} />
                    <Route path="/usuarios" element={<ProtectedRoute requiredRole="admin"><ListaUsuarios /></ProtectedRoute>} />
                    <Route path="/permissoes" element={<ProtectedRoute requiredRole="admin"><Permissoes /></ProtectedRoute>} />
                    <Route path="/perfil" element={<Perfil />} />
                    </Routes>
                  </main>
                </div>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
