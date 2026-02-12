import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('Variáveis de ambiente do Supabase não configuradas. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
}

/** Ref para o client, usada no fetch para obter a sessão (evita dependência circular). */
let supabaseRef: SupabaseClient | null = null;

/**
 * Fetch que envia o JWT da sessão Supabase Auth em requisições ao PostgREST.
 * Assim RLS usa auth.uid() sem segredos no frontend.
 */
async function fetchWithSession(input: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const isRest = url.includes('/rest/');
  if (isRest && supabaseRef) {
    try {
      const { data: { session } } = await supabaseRef.auth.getSession();
      if (session?.access_token) {
        const headers = new Headers(options?.headers);
        headers.set('Authorization', `Bearer ${session.access_token}`);
        return fetch(input, { ...(options ?? {}), headers });
      }
    } catch (e) {
      console.warn('[Supabase] Erro ao obter sessão no fetch:', e);
    }
  }
  return fetch(input, options);
}

// sessionStorage: sessão termina ao fechar aba/janela (usuário precisa logar de novo)
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    storageKey: 'gestor-fazenda-auth',
  },
  global: {
    fetch: fetchWithSession,
  },
});

supabaseRef = supabase;
