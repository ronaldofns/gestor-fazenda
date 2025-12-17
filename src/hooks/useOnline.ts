import { useState, useEffect } from 'react';

type Listener = (status: boolean) => void;

// Estado compartilhado para evitar múltiplos timers/eventos quando o hook é usado em vários lugares
let onlineState = typeof navigator !== 'undefined' ? navigator.onLine : true;
const listeners = new Set<Listener>();
let monitoringStarted = false;
let intervalId: number | null = null;
let onlineHandler: (() => void) | null = null;
let offlineHandler: (() => void) | null = null;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function notify(status: boolean) {
  onlineState = status;
  listeners.forEach((listener) => listener(status));
}

async function verifyConnectivity() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  // Se o navegador já indica offline, não há por que tentar checar backend
  if (!navigator.onLine) {
    notify(false);
    return;
  }

  // Sem configuração do Supabase, confiar apenas no estado do navegador
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    notify(true);
    return;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/racas_online?select=id&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      }
    );

    // Se houve resposta do backend, consideramos que há conectividade (mesmo que retorne erro de negócio)
    const reachable = response.status > 0;
    notify(reachable && navigator.onLine);
  } catch (err) {
    notify(false);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function startMonitoring() {
  if (monitoringStarted || typeof window === 'undefined') return;
  monitoringStarted = true;

  onlineHandler = () => {
    // Marcamos como online mas ainda confirmamos acessando o backend
    notify(true);
    verifyConnectivity();
  };

  offlineHandler = () => notify(false);

  window.addEventListener('online', onlineHandler);
  window.addEventListener('offline', offlineHandler);

  // Checagem inicial e verificação periódica para captar quedas do backend mesmo com Wi-Fi ligado
  verifyConnectivity();
  intervalId = window.setInterval(verifyConnectivity, 15000);
}

export default function useOnline() {
  const [online, setOnline] = useState<boolean>(onlineState);

  useEffect(() => {
    startMonitoring();

    const listener: Listener = (status) => setOnline(status);
    listeners.add(listener);

    // Sincroniza imediatamente com o estado global atual
    setOnline(onlineState);

    return () => {
      listeners.delete(listener);

      // Se ninguém mais estiver ouvindo, limpamos o intervalo para economizar recursos
      if (listeners.size === 0 && intervalId !== null && typeof window !== 'undefined') {
        window.clearInterval(intervalId);
        intervalId = null;
        monitoringStarted = false;
        if (onlineHandler) window.removeEventListener('online', onlineHandler);
        if (offlineHandler) window.removeEventListener('offline', offlineHandler);
      }
    };
  }, []);

  return online;
}
