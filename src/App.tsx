import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './routes/Home';
import Dashboard from './routes/Dashboard';
import CadastroDesmama from './routes/CadastroDesmama';
import ListaFazendas from './routes/ListaFazendas';
import CadastroFazenda from './routes/CadastroFazenda';
import ImportarPlanilha from './routes/ImportarPlanilha';
import Login from './routes/Login';
import SetupInicial from './routes/SetupInicial';
import ListaUsuarios from './routes/ListaUsuarios';
import CadastroUsuario from './routes/CadastroUsuario';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import InstallPrompt from './components/InstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import SplashScreen from './components/SplashScreen';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SplashScreen />
      <OfflineIndicator />
      <InstallPrompt />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<SetupInicial />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="flex min-h-screen">
                <Sidebar />
                <main className="flex-1 lg:ml-64 min-h-screen">
                <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/planilha" element={<Home />} />
                  <Route path="/desmama/:nascimentoId" element={<CadastroDesmama />} />
                  <Route path="/fazendas" element={<ListaFazendas />} />
                  <Route path="/nova-fazenda" element={<CadastroFazenda />} />
                  <Route path="/editar-fazenda/:id" element={<CadastroFazenda />} />
                  <Route path="/importar-planilha" element={<ImportarPlanilha />} />
                    <Route path="/usuarios" element={<ProtectedRoute requiredRole="admin"><ListaUsuarios /></ProtectedRoute>} />
                    <Route path="/novo-usuario" element={<ProtectedRoute requiredRole="admin"><CadastroUsuario /></ProtectedRoute>} />
                    <Route path="/editar-usuario/:id" element={<ProtectedRoute requiredRole="admin"><CadastroUsuario /></ProtectedRoute>} />
                </Routes>
              </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}
