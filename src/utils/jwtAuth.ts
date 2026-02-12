/**
 * Auth JWT: uso exclusivo da sessão do Supabase Auth.
 *
 * Não há mais geração de JWT no frontend, nem segredos (VITE_EDGE_FUNCTION_SECRET,
 * VITE_SUPABASE_JWT_SECRET). O cliente usa supabase.auth.signInWithPassword e a sessão
 * é enviada automaticamente nas requisições (RLS com auth.uid()).
 */

/** Limpa qualquer cache de token (chame no logout). Mantido por compatibilidade. */
export function clearJwtCache(): void {
  // Nada a limpar: não usamos mais token customizado em cache
}
