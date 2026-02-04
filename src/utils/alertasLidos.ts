/**
 * Utilitário para gerenciar o estado de leitura dos alertas
 */

import { db } from '../db/dexieDB';
import { NotificacaoLida } from '../db/models';

/**
 * Marca um alerta como lido
 */
export async function marcarAlertaComoLido(
  alertaId: string,
  tipo: NotificacaoLida['tipo'],
  usuarioId: string
): Promise<void> {
  const notificacao: NotificacaoLida = {
    id: alertaId,
    tipo,
    usuarioId,
    marcadaEm: new Date().toISOString(),
    synced: false,
    remoteId: null
  };

  await db.notificacoesLidas.put(notificacao);
}

/**
 * Marca um alerta como não lido (remove da tabela)
 */
export async function marcarAlertaComoNaoLido(alertaId: string): Promise<void> {
  await db.notificacoesLidas.delete(alertaId);
}

/**
 * Verifica se um alerta está marcado como lido para um usuário
 */
export async function verificarAlertaLido(
  alertaId: string,
  usuarioId: string
): Promise<boolean> {
  const notificacao = await db.notificacoesLidas
    .where('id')
    .equals(alertaId)
    .first();

  if (!notificacao) return false;
  
  // Verifica se foi marcado pelo usuário atual
  return notificacao.usuarioId === usuarioId;
}

/**
 * Marca todos os alertas de um tipo como lidos
 */
export async function marcarTodosAlertasComoLidos(
  alertaIds: string[],
  tipo: NotificacaoLida['tipo'],
  usuarioId: string
): Promise<void> {
  const notificacoes: NotificacaoLida[] = alertaIds.map(id => ({
    id,
    tipo,
    usuarioId,
    marcadaEm: new Date().toISOString(),
    synced: false,
    remoteId: null
  }));

  await db.notificacoesLidas.bulkPut(notificacoes);
}

/**
 * Obtém todos os IDs de alertas lidos por um usuário
 */
export async function obterAlertasLidosPorUsuario(
  usuarioId: string
): Promise<Set<string>> {
  const notificacoes = await db.notificacoesLidas
    .where('usuarioId')
    .equals(usuarioId)
    .toArray();

  return new Set(notificacoes.map(n => n.id));
}

/**
 * Limpa alertas lidos antigos (mais de 30 dias)
 */
export async function limparAlertasLidosAntigos(): Promise<void> {
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
  
  const alertasAntigos = await db.notificacoesLidas
    .filter(n => new Date(n.marcadaEm) < trintaDiasAtras)
    .toArray();

  if (alertasAntigos.length > 0) {
    await db.notificacoesLidas.bulkDelete(alertasAntigos.map(a => a.id));
  }
}
