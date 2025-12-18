import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import localforage from 'localforage';
import App from './App';
import { migrateOldData } from './db/migration';
import { AuthProvider } from './hooks/useAuth';
import './index.css';
import { applyTheme, getInitialTheme } from './utils/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Dados nunca ficam stale (sempre usar cache local primeiro)
      gcTime: 1000 * 60 * 60 * 24, // Manter cache por 24h
      refetchOnWindowFocus: false, // Não recarregar ao focar janela
      refetchOnReconnect: true, // Recarregar apenas quando reconectar
      refetchOnMount: false, // Não recarregar ao montar componente
      retry: 1, // Menos tentativas para não travar
      networkMode: 'offlineFirst' // Priorizar dados offline
    }
  }
});

// Persist queryCache to localforage
persistQueryClient({
  queryClient,
  persister: {
    persistClient: async (client) => {
      await localforage.setItem('REACT_QUERY_OFFLINE', client);
    },
    restoreClient: async () => {
      return (await localforage.getItem('REACT_QUERY_OFFLINE')) as any;
    },
    removeClient: async () => {
      await localforage.removeItem('REACT_QUERY_OFFLINE');
    }
  }
});

// Executar migração de dados antigos
migrateOldData().catch(console.error);

// Inicializar tema (light/dark) antes do render
if (typeof window !== 'undefined') {
  const initialTheme = getInitialTheme();
  applyTheme(initialTheme);
}

// Limpar sessão antiga do Supabase Auth (se existir) - agora usamos autenticação local
if (typeof window !== 'undefined') {
  try {
    const supabaseAuth = localStorage.getItem('gestor-fazenda-auth');
    if (supabaseAuth) {
      // Limpar apenas se for uma sessão do Supabase Auth antiga
      try {
        const parsed = JSON.parse(supabaseAuth);
        if (parsed?.currentSession?.access_token) {
          // É uma sessão do Supabase Auth antiga, limpar
          localStorage.removeItem('gestor-fazenda-auth');
          console.log('Sessão antiga do Supabase Auth removida');
        }
      } catch (e) {
        // Não é JSON válido, pode ser outra coisa, não fazer nada
      }
    }
  } catch (e) {
    // Ignorar erros ao limpar
  }
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>
);
