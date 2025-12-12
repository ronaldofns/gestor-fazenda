import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import localforage from 'localforage';
import App from './App';
import { migrateOldData } from './db/migration';
import './index.css';

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

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
