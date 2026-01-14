import { useEffect, useRef } from 'react';
import useOnline from './useOnline';
import { useAuth } from './useAuth';
import { useAppSettings } from './useAppSettings';
import { syncAll } from '../api/syncService';

/**
 * Hook para sincronização automática
 * IMPORTANTE: Só sincroniza outras tabelas (não usuários) após o usuário estar logado
 * A sincronização de usuários deve ser feita antes do login (em Login.tsx e SetupInicial.tsx)
 */
export default function useSync() {
  const online = useOnline();
  const { user } = useAuth(); // Verificar se usuário está logado
  const { appSettings } = useAppSettings(); // Obter intervalo de sincronização das configurações
  const ref = useRef<number | null>(null);
  
  // Converter segundos para milissegundos
  const intervalMs = (appSettings.intervaloSincronizacao || 30) * 1000;

  useEffect(() => {
    // Só sincronizar se estiver online E usuário estiver logado
    // A sincronização de usuários é feita separadamente antes do login
    if (!online || !user) {
      if (ref.current) {
        window.clearInterval(ref.current);
        ref.current = null;
      }
      return;
    }

    async function run() {
      try {
        // Sincronizar tudo (exceto usuários, que já foram sincronizados antes do login)
        await syncAll();
      } catch (e) {
        console.error('sync failed', e);
      }
    }

    // Executar imediatamente quando ficar online e logado
    run();
    // E depois a cada intervalo
    ref.current = window.setInterval(run, intervalMs);

    return () => {
      if (ref.current) {
        window.clearInterval(ref.current);
        ref.current = null;
      }
    };
  }, [online, user, intervalMs]);
}
