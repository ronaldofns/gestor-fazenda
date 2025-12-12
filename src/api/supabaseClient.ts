import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('Variáveis de ambiente do Supabase não configuradas. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false, // Desabilitado - usando autenticação local
    autoRefreshToken: false, // Desabilitado - não precisamos mais do refresh token
    detectSessionInUrl: false, // Desabilitado - não usamos mais Auth do Supabase
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'gestor-fazenda-auth'
  }
});
