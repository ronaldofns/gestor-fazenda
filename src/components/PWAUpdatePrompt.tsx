import { useEffect, useState } from 'react';
import { Icons } from '../utils/iconMapping';
import { showToast } from '../utils/toast';

export default function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Obter o service worker registrado
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);
        
        // Verificar atualizações periodicamente (a cada 1 hora)
        setInterval(() => {
          reg.update();
        }, 60 * 60 * 1000);

        // Verificar atualizações imediatamente ao carregar
        reg.update();

        // Escutar quando um novo service worker está sendo instalado
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // Novo service worker instalado — mostrar apenas o card com botão "Atualizar" (sem toast no topo)
                  setNeedRefresh(true);
                } else {
                  // Primeira instalação - app pronto para offline
                  setOfflineReady(true);
                }
              }
            });
          }
        });

        // Verificar se já há um service worker esperando
        if (reg.waiting) {
          setNeedRefresh(true);
        }
      });

      // Escutar quando o service worker muda (atualização aplicada)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Service worker mudou, recarregar página para aplicar atualização
        window.location.reload();
      });
    }
  }, []);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const update = () => {
    if (registration?.waiting) {
      // Enviar mensagem para o service worker esperando ativar (sw.ts escuta SKIP_WAITING e chama skipWaiting())
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // A página será recarregada automaticamente pelo evento 'controllerchange'
      close();
    } else if (registration) {
      // Fallback: sem worker em waiting (ex.: já ativou), forçar update e recarregar
      registration.update();
      close();
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } else {
      showToast({
        type: 'warning',
        title: 'Atualização',
        message: 'Service worker ainda não está pronto. Tente novamente em instantes.',
      });
    }
  };

  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {offlineReady && !needRefresh && (
        <div className="bg-green-600 dark:bg-green-900/20 border border-green-700 dark:border-green-500/40 rounded-lg shadow-lg p-4 mb-2">
          <div className="flex items-start">
            <Icons.CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                App pronto para uso offline
              </p>
            </div>
            <button
              onClick={close}
              className="ml-4 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {needRefresh && (
        <div className="rounded-xl shadow-2xl ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 bg-blue-600 dark:bg-blue-700 p-4 border-0">
          <div className="flex items-start">
            <Icons.Download className="w-5 h-5 text-white mt-0.5 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <p className="text-sm font-bold text-white mb-1">
                Nova versão disponível!
              </p>
              <p className="text-xs text-blue-100 mb-3">
                Clique em &quot;Atualizar&quot; para aplicar as mudanças.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={update}
                  className="px-4 py-2 text-sm font-semibold text-blue-600 bg-white rounded-lg shadow-md hover:bg-blue-50 transition-colors"
                >
                  Atualizar
                </button>
                <button
                  onClick={close}
                  className="px-4 py-2 text-sm font-medium text-white/90 hover:text-white border border-white/40 rounded-lg transition-colors"
                >
                  Depois
                </button>
              </div>
            </div>
            <button
              onClick={close}
              className="ml-4 p-1 rounded-md text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

