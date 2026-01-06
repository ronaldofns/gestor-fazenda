import { db } from '../db/dexieDB';

/**
 * Gera chave única para uma notificação de desmama
 */
export function chaveDesmama(id: string): string {
  return `desmama-${id}`;
}

/**
 * Gera chave única para uma notificação de mortalidade
 */
export function chaveMortalidade(fazendaId: string): string {
  return `mortalidade-${fazendaId}`;
}

/**
 * Gera chave única para uma notificação de dados incompletos
 */
export function chaveDadosIncompletos(id: string): string {
  return `dados-${id}`;
}

/**
 * Gera chave única para uma notificação de matriz sem cadastro
 */
export function chaveMatrizSemCadastro(matrizId: string, fazendaId: string): string {
  return `matriz-${matrizId}-${fazendaId}`;
}

/**
 * Marca uma notificação como lida
 */
export async function marcarNotificacaoComoLida(chave: string, tipo: 'desmama' | 'mortalidade' | 'dados' | 'matriz'): Promise<void> {
  try {
    await db.notificacoesLidas.put({
      id: chave,
      tipo,
      marcadaEm: new Date().toISOString(),
      synced: false,
      remoteId: null
    });
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    throw error;
  }
}

/**
 * Marca todas as notificações de um tipo como lidas
 */
export async function marcarTodasComoLidas(
  tipo: 'desmama' | 'mortalidade' | 'dados' | 'matriz',
  chaves: string[]
): Promise<void> {
  try {
    const notificacoes = chaves.map(chave => ({
      id: chave,
      tipo,
      marcadaEm: new Date().toISOString(),
      synced: false,
      remoteId: null
    }));
    
    await db.notificacoesLidas.bulkPut(notificacoes);
  } catch (error) {
    console.error('Erro ao marcar todas as notificações como lidas:', error);
    throw error;
  }
}

/**
 * Verifica se uma notificação está marcada como lida
 */
export async function isNotificacaoLida(chave: string): Promise<boolean> {
  try {
    const notificacao = await db.notificacoesLidas.get(chave);
    return !!notificacao;
  } catch (error) {
    console.error('Erro ao verificar se notificação está lida:', error);
    return false;
  }
}

/**
 * Busca todas as chaves de notificações lidas
 */
export async function getNotificacoesLidas(): Promise<Set<string>> {
  try {
    const todas = await db.notificacoesLidas.toArray();
    return new Set(todas.map(n => n.id));
  } catch (error) {
    console.error('Erro ao buscar notificações lidas:', error);
    return new Set();
  }
}

/**
 * Remove todas as notificações lidas (útil para reset)
 */
export async function limparNotificacoesLidas(): Promise<void> {
  try {
    await db.notificacoesLidas.clear();
  } catch (error) {
    console.error('Erro ao limpar notificações lidas:', error);
    throw error;
  }
}

