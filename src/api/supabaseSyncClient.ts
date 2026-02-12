import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

/**
 * Retorna o client Supabase para sync quando há sessão ativa (login via Supabase Auth).
 * O client global já envia o JWT da sessão; RLS usa auth.uid() no servidor.
 * Retorna null se não houver sessão (usuário não logado com signInWithPassword).
 */
export async function getSupabaseForSync(): Promise<SupabaseClient | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? supabase : null;
}
