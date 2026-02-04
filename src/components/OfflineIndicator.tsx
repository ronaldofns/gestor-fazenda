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

  // Contar registros pendentes de sincronização (tabelas em uso)
  const pendingCount = useLiveQuery(async () => {
    try {
      const count = (arr: { synced?: boolean }[]) => arr.filter((x) => !x.synced).length;
      const [a, d, p, v, f, r, c, u, del, rp] = await Promise.all([
        (db.animais?.toArray() ?? Promise.resolve([])).then(count),
        (db.desmamas?.toArray() ?? Promise.resolve([])).then(count),
        (db.pesagens?.toArray() ?? Promise.resolve([])).then(count),
        (db.vacinacoes?.toArray() ?? Promise.resolve([])).then(count),
        (db.fazendas?.toArray() ?? Promise.resolve([])).then(count),
        (db.racas?.toArray() ?? Promise.resolve([])).then(count),
        (db.categorias?.toArray() ?? Promise.resolve([])).then(count),
        (db.usuarios?.toArray() ?? Promise.resolve([])).then(count),
        (db.deletedRecords?.toArray() ?? Promise.resolve([])).then(count),
        (db.rolePermissions?.toArray() ?? Promise.resolve([])).then(count)
      ]);
      return a + d + p + v + f + r + c + u + del + rp;
    } catch {
      return 0;
    }
  }, []) ?? 0;

  useEffect(() => {
    // Detectar mudança de status
    if (online !== previousOnline) {
      // Limpar timeout anterior (só ao iniciar nova transição, não no cleanup)
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Exibir toast temporário na mudança de status
      setShowToast(true);
      timeoutRef.current = window.setTimeout(() => {
        setShowToast(false);
        timeoutRef.current = null;
      }, 4000);

      setPreviousOnline(online);
    }
    // Não limpar o timeout no cleanup: quando setPreviousOnline(online) roda, o efeito
    // é reexecutado e o cleanup acabaria cancelando o timeout que esconde o toast,
    // deixando a mensagem travada na tela.
  }, [online, previousOnline]);

  return (
    <>
      {/* Barra fixa no topo quando offline (item 15 - modo offline aprimorado) */}
      {!online && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 dark:bg-amber-600 text-white text-center py-2 px-4 text-sm font-medium shadow-md flex items-center justify-center gap-2">
          <Icons.WifiOff className="w-4 h-4 shrink-0" />
          <span>Você está offline. Alterações serão salvas localmente e sincronizadas quando a conexão voltar.</span>
          {pendingCount > 0 && (
            <span className="bg-amber-600 dark:bg-amber-700 px-2 py-0.5 rounded-full text-xs tabular-nums">
              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Toast temporário na mudança de status */}
      {showToast && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-[61] transition-all duration-300 ${
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
                      {pendingCount} registro(s) pendente(s). Vá em Sincronização para enviar.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Icons.WifiOff className="w-5 h-5" />
                <div>
                  <div className="font-semibold">Modo Offline ativado</div>
                  <div className="text-xs opacity-90 mt-0.5">
                    Seus dados serão salvos localmente e sincronizados quando voltar online.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Indicador persistente no rodapé quando offline (reduzido; barra no topo é o destaque) */}
      {!online && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[55] animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-medium shadow-lg border border-amber-200 dark:border-amber-700">
            <Icons.WifiOff className="w-3.5 h-3.5" />
            <span>Offline</span>
            {pendingCount > 0 && (
              <span className="tabular-nums">({pendingCount} pend.)</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

