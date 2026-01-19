import { useState, useEffect, useRef } from 'react';
import { Icons } from '../utils/iconMapping';
import useOnline from '../hooks/useOnline';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';

export default function OfflineIndicator() {
  const online = useOnline();
  const [showToast, setShowToast] = useState(false);
  const [previousOnline, setPreviousOnline] = useState(online);
  const timeoutRef = useRef<number | null>(null);

  // Contar registros pendentes de sincronização
  const pendingCount = useLiveQuery(async () => {
    try {
      const [nascimentos, desmamas, pesagens, vacinacoes, matrizes, fazendas, racas, categorias, usuarios] = await Promise.all([
        db.nascimentos.where('synced').equals(0).count(),
        db.desmamas.where('synced').equals(0).count(),
        db.pesagens.where('synced').equals(0).count(),
        db.vacinacoes.where('synced').equals(0).count(),
        db.matrizes.where('synced').equals(0).count(),
        db.fazendas.where('synced').equals(0).count(),
        db.racas.where('synced').equals(0).count(),
        db.categorias.where('synced').equals(0).count(),
        db.usuarios.where('synced').equals(0).count()
      ]);
      return nascimentos + desmamas + pesagens + vacinacoes + matrizes + fazendas + racas + categorias + usuarios;
    } catch {
      return 0;
    }
  }, []) || 0;

  useEffect(() => {
    // Detectar mudança de status
    if (online !== previousOnline) {
      // Limpar timeout anterior
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      // Exibir toast temporário na mudança de status
      setShowToast(true);
      timeoutRef.current = window.setTimeout(() => {
        setShowToast(false);
      }, 4000);

      setPreviousOnline(online);
    }

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [online, previousOnline]);

  return (
    <>
      {/* Toast temporário na mudança de status */}
      {showToast && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-[60] transition-all duration-300 ${
            showToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
        >
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl text-sm font-medium ${
              online 
                ? 'bg-green-600 dark:bg-green-700 text-white' 
                : 'bg-amber-600 dark:bg-amber-700 text-white'
            }`}
          >
            {online ? (
              <>
                <Icons.CheckCircle className="w-5 h-5" />
                <div>
                  <div className="font-semibold">Conexão restaurada</div>
                  {pendingCount > 0 && (
                    <div className="text-xs opacity-90 mt-0.5">
                      {pendingCount} registro(s) pendente(s) de sincronização
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Icons.WifiOff className="w-5 h-5" />
                <div>
                  <div className="font-semibold">Modo Offline</div>
                  <div className="text-xs opacity-90 mt-0.5">
                    Seus dados serão salvos localmente
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Indicador persistente quando offline */}
      {!online && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[55] animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-medium shadow-lg border border-amber-200 dark:border-amber-700">
            <div className="relative flex">
              <Icons.WifiOff className="w-3.5 h-3.5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-full animate-pulse"></span>
            </div>
            <span>Offline</span>
            {pendingCount > 0 && (
              <>
                <span className="text-amber-400 dark:text-amber-500">•</span>
                <span className="tabular-nums">{pendingCount} pendente(s)</span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

