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
                  // Novo service worker instalado e há um controlador ativo (página já carregada)
                  setNeedRefresh(true);
                  showToast({
                    type: 'info',
                    title: 'Nova versão disponível',
                    message: 'Uma nova versão do aplicativo está disponível. Clique em "Atualizar" para aplicar.',
                    duration: 10000,
                  });
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
      // Enviar mensagem para o service worker esperando para ativar
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // A página será recarregada automaticamente pelo evento 'controllerchange'
    } else if (registration) {
      // Forçar atualização e recarregar
      registration.update();
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
    close();
  };

  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {offlineReady && !needRefresh && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/40 rounded-lg shadow-lg p-4 mb-2">
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
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/40 rounded-lg shadow-lg p-4">
          <div className="flex items-start">
            <Icons.Download className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                Nova versão disponível!
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                Uma nova versão do aplicativo está disponível. Clique em "Atualizar" para aplicar as mudanças.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={update}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  Atualizar
                </button>
                <button
                  onClick={close}
                  className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 rounded-md transition-colors"
                >
                  Depois
                </button>
              </div>
            </div>
            <button
              onClick={close}
              className="ml-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

