import { useEffect, useRef } from "react";
import useOnline from "./useOnline";
import { useAuth } from "./useAuth";
import { useAppSettings } from "./useAppSettings";
import { syncAll } from "../api/syncService";

/**
 * Hook para sincronização automática.
 * Conforme doc: sync ao abrir o app, quando volta online (evento "online") e a cada intervalo.
 * IMPORTANTE: Só sincroniza outras tabelas (não usuários) após o usuário estar logado.
 * A sincronização de usuários deve ser feita antes do login (em Login.tsx e SetupInicial.tsx).
 */
export default function useSync() {
  const online = useOnline();
  const { user, isOfflineLogin } = useAuth();
  const { appSettings } = useAppSettings();
  const ref = useRef<number | null>(null);

  const intervalMs = (appSettings.intervaloSincronizacao || 30) * 1000;

  useEffect(() => {
    // Não sincronizar: sem conexão, sem usuário ou login offline (Dexie) — sync exige sessão Supabase Auth
    if (!online || !user || isOfflineLogin) {
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
        console.error("sync failed", e);
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
  }, [online, user, isOfflineLogin, intervalMs]);
}
