import { useEffect, useRef } from 'react';
import useOnline from './useOnline';
import { syncAll } from '../api/syncService';

export default function useSync(intervalMs = 30_000) { // Reduzido para 30 segundos para sincronização mais rápida
  const online = useOnline();
  const ref = useRef<number | null>(null);

  useEffect(() => {
    async function run() {
      try {
        await syncAll();
      } catch (e) {
        console.error('sync failed', e);
      }
    }

    if (online) {
      run();
      ref.current = window.setInterval(run, intervalMs);
    }

    return () => {
      if (ref.current) window.clearInterval(ref.current);
    };
  }, [online, intervalMs]);
}
