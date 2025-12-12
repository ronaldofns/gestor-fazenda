import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './routes/Home';
import Dashboard from './routes/Dashboard';
import EditarNascimento from './routes/EditarNascimento';
import CadastroDesmama from './routes/CadastroDesmama';
import ListaFazendas from './routes/ListaFazendas';
import CadastroFazenda from './routes/CadastroFazenda';
import ImportarPlanilha from './routes/ImportarPlanilha';
import Login from './routes/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="flex min-h-screen">
                <Sidebar />
                <main className="flex-1 lg:ml-64 min-h-screen">
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/" element={<Home />} />
                    <Route path="/editar-nascimento/:id" element={<EditarNascimento />} />
                    <Route path="/desmama/:nascimentoId" element={<CadastroDesmama />} />
                    <Route path="/fazendas" element={<ListaFazendas />} />
                    <Route path="/nova-fazenda" element={<CadastroFazenda />} />
                    <Route path="/editar-fazenda/:id" element={<CadastroFazenda />} />
                    <Route path="/importar-planilha" element={<ImportarPlanilha />} />
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
