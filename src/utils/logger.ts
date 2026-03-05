/**
 * Logger centralizado: logs de debug/info só em modo debug; críticos sempre em produção.
 * Modo debug: import.meta.env.DEV === true ou VITE_DEBUG === 'true'
 */
const isDebug =
  typeof import.meta !== "undefined" &&
  (import.meta.env?.DEV === true || import.meta.env?.VITE_DEBUG === "true");

export function getIsDebug(): boolean {
  return isDebug;
}

/** Log só em modo debug (progresso, sucesso, avisos não críticos). */
export function debug(...args: unknown[]): void {
  if (isDebug && typeof console !== "undefined" && console.log) {
    console.log(...args);
  }
}

/** Aviso só em modo debug (ex.: tabela não existe, PGRST301). */
export function warn(...args: unknown[]): void {
  if (isDebug && typeof console !== "undefined" && console.warn) {
    console.warn(...args);
  }
}

/** Log crítico: sempre exibido (erros de sync, auth, falhas que exigem ação). */
export function critical(...args: unknown[]): void {
  if (typeof console !== "undefined" && console.error) {
    console.error(...args);
  }
}
