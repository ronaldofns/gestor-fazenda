/**
 * Estado global de sincronização - fonte única de verdade para todos os componentes.
 * Usado por syncService, TopBar, Sidebar e página Sincronização.
 */
let globalSyncing = false;

export function setGlobalSyncing(syncing: boolean) {
  globalSyncing = syncing;
  if (typeof window !== 'undefined') {
    (window as any).__globalSyncing = syncing;
    window.dispatchEvent(new CustomEvent('syncStateChange', { detail: { syncing } }));
  }
}

export function getGlobalSyncing() {
  return globalSyncing;
}
