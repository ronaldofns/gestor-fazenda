/**
 * Checkpoints de sincronização - pull incremental por tabela
 * Maior ganho de performance: só busca registros alterados desde última sync
 */

const PREFIX = 'sync_lastPulled_';

export function getLastPulledAt(tableName: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PREFIX + tableName);
}

export function setLastPulledAt(tableName: string, isoTimestamp: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFIX + tableName, isoTimestamp);
}

export function clearLastPulledAt(tableName?: string): void {
  if (typeof window === 'undefined') return;
  if (tableName) {
    localStorage.removeItem(PREFIX + tableName);
  } else {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }
}

/**
 * Retorna timestamp ISO para query incremental
 * Se nunca sincronizou, retorna null (full pull)
 */
export function getLastPulledForQuery(tableName: string): string | null {
  const last = getLastPulledAt(tableName);
  if (!last) return null;
  return last;
}
