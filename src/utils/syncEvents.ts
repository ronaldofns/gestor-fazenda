import { db } from '../db/dexieDB';
import { SyncEvent, SyncEventType, SyncEntity } from '../db/models';
import { uuid } from './uuid';

const MAX_TENTATIVAS = 5; // Máximo de tentativas antes de marcar como erro permanente
const MAX_CONCURRENCY = 3; // Batches concorrentes (2-3 ideal)
const BATCH_SIZE = 50; // Tamanho do lote para INSERT/UPDATE/DELETE

// Mapeamento entidade -> tabela Supabase
const tableMap: Record<SyncEntity, string> = {
  fazenda: 'fazendas_online',
  raca: 'racas_online',
  categoria: 'categorias_online',
  nascimento: 'nascimentos_online',
  desmama: 'desmamas_online',
  matriz: 'matrizes_online',
  usuario: 'usuarios_online',
  audit: 'audits_online',
  notificacaoLida: 'notificacoes_lidas_online',
  alertSettings: 'alert_settings_online',
  appSettings: 'app_settings_online',
  rolePermission: 'role_permissions_online',
  pesagem: 'pesagens_online',
  vacina: 'vacinacoes_online',
  confinamento: 'confinamentos_online',
  confinamentoAnimal: 'confinamento_animais_online',
  confinamentoPesagem: 'confinamento_pesagens_online',
  confinamentoAlimentacao: 'confinamento_alimentacao_online'
};

// Campo de conflito para upsert (uuid ou id)
const uuidFieldMap: Record<SyncEntity, string> = {
  fazenda: 'uuid',
  raca: 'uuid',
  categoria: 'uuid',
  nascimento: 'uuid',
  desmama: 'uuid',
  matriz: 'uuid',
  usuario: 'id',
  audit: 'uuid',
  notificacaoLida: 'id',
  alertSettings: 'id',
  appSettings: 'id',
  rolePermission: 'id',
  pesagem: 'uuid',
  vacina: 'uuid',
  confinamento: 'uuid',
  confinamentoAnimal: 'uuid',
  confinamentoPesagem: 'uuid',
  confinamentoAlimentacao: 'uuid'
};

/**
 * Cria um evento de sincronização na fila
 */
export async function createSyncEvent(
  tipo: SyncEventType,
  entidade: SyncEntity,
  entityId: string,
  payload?: any
): Promise<string> {
  const now = new Date().toISOString();
  const eventId = uuid();

  const event: SyncEvent = {
    id: eventId,
    tipo,
    entidade,
    entityId,
    payload: payload ? JSON.stringify(payload) : '',
    tentativas: 0,
    erro: null,
    synced: false,
    createdAt: now,
    updatedAt: now,
    remoteId: null
  };

  try {
    await db.syncEvents.add(event);
    return eventId;
  } catch (error) {
    console.error('Erro ao criar evento de sincronização:', error);
    throw error;
  }
}

/**
 * Marca batch com erro (incrementa tentativas, não quebra o fluxo)
 */
async function markBatchError(
  events: SyncEvent[],
  message: string,
  now: string
): Promise<void> {
  if (events.length === 0) return;
  await db.syncEvents.bulkUpdate(
    events.map(e => ({
      key: e.id,
      changes: {
        tentativas: e.tentativas + 1,
        erro: message,
        updatedAt: now
      }
    }))
  );
}

/**
 * Processa batch de DELETE em lote
 */
async function processDeleteBatch(
  events: SyncEvent[],
  now: string
): Promise<{ sucesso: number; falhas: number; erros: Array<{ event: SyncEvent; error: string }> }> {
  const resultados = { sucesso: 0, falhas: 0, erros: [] as Array<{ event: SyncEvent; error: string }> };

  const ids = events.map(e => e.remoteId).filter(id => id != null) as (number | string)[];

  // Eventos sem remoteId: nunca foram ao servidor, marcar como sincronizados
  const semRemoteId = events.filter(e => e.remoteId == null);
  if (semRemoteId.length > 0) {
    await db.syncEvents.bulkUpdate(
      semRemoteId.map(e => ({
        key: e.id,
        changes: { synced: true, tentativas: e.tentativas + 1, updatedAt: now }
      }))
    );
    resultados.sucesso += semRemoteId.length;
  }

  if (ids.length === 0) {
    return resultados;
  }

  try {
    const { supabase } = await import('../api/supabaseClient');
    const table = tableMap[events[0].entidade];
    if (!table) {
      await markBatchError(events.filter(e => e.remoteId != null), `Tabela não encontrada: ${events[0].entidade}`, now);
      resultados.falhas += ids.length;
      events.filter(e => e.remoteId != null).forEach(e => resultados.erros.push({ event: e, error: 'Tabela não encontrada' }));
      return resultados;
    }

    const { error } = await supabase.from(table).delete().in('id', ids);

    if (error) {
      const comRemoteId = events.filter(e => e.remoteId != null);
      await markBatchError(comRemoteId, error.message || 'Erro ao deletar em lote', now);
      resultados.falhas += ids.length;
      comRemoteId.forEach(e => resultados.erros.push({ event: e, error: error.message || 'Erro' }));
      return resultados;
    }

    const comRemoteId = events.filter(e => e.remoteId != null);
    await db.syncEvents.bulkUpdate(
      comRemoteId.map(e => ({
        key: e.id,
        changes: {
          synced: true,
          erro: null,
          tentativas: e.tentativas + 1,
          updatedAt: now
        }
      }))
    );
    resultados.sucesso += ids.length;
  } catch (err: any) {
    const comRemoteId = events.filter(e => e.remoteId != null);
    await markBatchError(comRemoteId, err?.message || 'Erro ao processar DELETE', now);
    resultados.falhas += ids.length;
    comRemoteId.forEach(e => resultados.erros.push({ event: e, error: err?.message || 'Erro' }));
  }

  return resultados;
}

/**
 * Processa batch de INSERT/UPDATE em lote (upsert)
 */
async function processUpsertBatch(
  events: SyncEvent[],
  now: string
): Promise<{ sucesso: number; falhas: number; erros: Array<{ event: SyncEvent; error: string }> }> {
  const resultados = { sucesso: 0, falhas: 0, erros: [] as Array<{ event: SyncEvent; error: string }> };

  if (events.length === 0) return resultados;

  const sample = events[0];
  const table = tableMap[sample.entidade];
  const conflictField = uuidFieldMap[sample.entidade] === 'uuid' ? 'uuid' : 'id';

  if (!table) {
    await markBatchError(events, `Tabela não encontrada: ${sample.entidade}`, now);
    resultados.falhas = events.length;
    events.forEach(e => resultados.erros.push({ event: e, error: 'Tabela não encontrada' }));
    return resultados;
  }

  const parsed: { event: SyncEvent; payload: Record<string, unknown> }[] = [];
  const invalidos: SyncEvent[] = [];
  for (const e of events) {
    try {
      const p = e.payload ? JSON.parse(e.payload) : {};
      if (Object.keys(p).length > 0) {
        parsed.push({ event: e, payload: p });
      } else {
        invalidos.push(e);
      }
    } catch {
      invalidos.push(e);
    }
  }

  if (invalidos.length > 0) {
    await markBatchError(invalidos, 'Payload inválido ou vazio', now);
    resultados.falhas = invalidos.length;
    invalidos.forEach(e => resultados.erros.push({ event: e, error: 'Payload inválido' }));
  }

  if (parsed.length === 0) {
    return resultados;
  }

  const payloads = parsed.map(p => p.payload);
  const eventosValidos = parsed.map(p => p.event);

  try {
    const { supabase } = await import('../api/supabaseClient');

    // Upsert sem .select() para melhor performance
    const { error } = await supabase.from(table).upsert(payloads, { onConflict: conflictField });

    if (error) {
      await markBatchError(eventosValidos, error.message || 'Erro no upsert', now);
      resultados.falhas = eventosValidos.length;
      eventosValidos.forEach(e => resultados.erros.push({ event: e, error: error.message || 'Erro' }));
      return resultados;
    }

    await db.syncEvents.bulkUpdate(
      eventosValidos.map(e => ({
        key: e.id,
        changes: {
          synced: true,
          erro: null,
          tentativas: e.tentativas + 1,
          updatedAt: now
        }
      }))
    );
    resultados.sucesso = eventosValidos.length;
  } catch (err: any) {
    await markBatchError(eventosValidos, err?.message || 'Erro ao processar upsert', now);
    resultados.falhas = eventosValidos.length;
    eventosValidos.forEach(e => resultados.erros.push({ event: e, error: err?.message || 'Erro' }));
  }

  return resultados;
}

/**
 * Processa um batch (DELETE ou UPSERT)
 */
async function processBatch(
  events: SyncEvent[],
  now: string
): Promise<{ sucesso: number; falhas: number; erros: Array<{ event: SyncEvent; error: string }> }> {
  if (events.length === 0) return { sucesso: 0, falhas: 0, erros: [] };

  if (events[0].tipo === 'DELETE') {
    return processDeleteBatch(events, now);
  }
  return processUpsertBatch(events, now);
}

/**
 * Processa todos os eventos pendentes na fila
 * - Busca só pendentes, ordenados no IndexedDB
 * - Agrupa por entidade+tipo
 * - Cria batches de BATCH_SIZE
 * - Executa com paralelismo controlado (MAX_CONCURRENCY)
 */
export async function processSyncQueue(): Promise<{
  processados: number;
  sucesso: number;
  falhas: number;
  erros: Array<{ event: SyncEvent; error: string }>;
}> {
  // Buscar TODOS e filtrar em memória - evita índice [synced+createdAt] que falha se createdAt for inválido
  const todos = await db.syncEvents.toArray();
  const pendentes = todos
    .filter(e => !e.synced)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  if (pendentes.length === 0) {
    return { processados: 0, sucesso: 0, falhas: 0, erros: [] };
  }

  // Filtrar eventos que excederam tentativas
  const elegiveis = pendentes.filter(e => e.tentativas < MAX_TENTATIVAS);
  const descartados = pendentes.length - elegiveis.length;

  // Agrupar por entidade + tipo
  const grupos = new Map<string, SyncEvent[]>();
  for (const e of elegiveis) {
    const key = `${e.entidade}:${e.tipo}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(e);
  }

  // Criar batches de BATCH_SIZE
  const batches: SyncEvent[][] = [];
  for (const group of grupos.values()) {
    for (let i = 0; i < group.length; i += BATCH_SIZE) {
      batches.push(group.slice(i, i + BATCH_SIZE));
    }
  }

  const resultados = { processados: 0, sucesso: 0, falhas: 0, erros: [] as Array<{ event: SyncEvent; error: string }> };
  const now = new Date().toISOString();

  // Pool de workers com paralelismo controlado
  let index = 0;
  const worker = async (): Promise<void> => {
    let i: number;
    while ((i = index++) < batches.length) {
      const batch = batches[i];
      const r = await processBatch(batch, now);
      resultados.processados += batch.length;
      resultados.sucesso += r.sucesso;
      resultados.falhas += r.falhas;
      resultados.erros.push(...r.erros);
    }
  };

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, batches.length) }, worker));

  resultados.processados += descartados;
  resultados.falhas += descartados;

  return resultados;
}

/**
 * Processa um evento individual (fallback para retry ou casos especiais)
 * Mantido para compatibilidade com código que possa chamar diretamente
 */
export async function processSyncEvent(event: SyncEvent): Promise<boolean> {
  const r = await processBatch([event], new Date().toISOString());
  return r.sucesso > 0;
}

/**
 * Obtém estatísticas da fila de sincronização
 */
export async function getSyncQueueStats(): Promise<{
  total: number;
  pendentes: number;
  sincronizados: number;
  comErro: number;
  porTipo: Record<SyncEventType, number>;
  porEntidade: Record<SyncEntity, number>;
}> {
  const todos = await db.syncEvents.toArray();

  const stats = {
    total: todos.length,
    pendentes: todos.filter(e => !e.synced).length,
    sincronizados: todos.filter(e => e.synced).length,
    comErro: todos.filter(e => !e.synced && e.tentativas >= MAX_TENTATIVAS).length,
    porTipo: { INSERT: 0, UPDATE: 0, DELETE: 0 } as Record<SyncEventType, number>,
    porEntidade: {} as Record<SyncEntity, number>
  };

  for (const event of todos) {
    stats.porTipo[event.tipo]++;
    stats.porEntidade[event.entidade] = (stats.porEntidade[event.entidade] || 0) + 1;
  }

  return stats;
}

/**
 * Diagnóstico: lista SyncEvents com createdAt inválido (undefined, null, vazio ou não-string).
 * Use no console: import('./utils/syncEvents').then(m => m.diagnoseSyncEventsInvalidCreatedAt())
 */
export async function diagnoseSyncEventsInvalidCreatedAt(): Promise<{
  total: number;
  comCreatedAtInvalido: number;
  ids: string[];
  exemplos: Array<{ id: string; createdAt: unknown; tipo: string; entidade: string }>;
}> {
  const todos = await db.syncEvents.toArray();
  const invalidos = todos.filter(e => {
    const v = e.createdAt;
    return v === undefined || v === null || typeof v !== 'string' || v === '';
  });
  return {
    total: todos.length,
    comCreatedAtInvalido: invalidos.length,
    ids: invalidos.map(e => e.id),
    exemplos: invalidos.slice(0, 10).map(e => ({
      id: e.id,
      createdAt: e.createdAt,
      tipo: e.tipo,
      entidade: e.entidade
    }))
  };
}

/**
 * Limpa eventos sincronizados antigos (mais de 7 dias)
 */
export async function cleanupOldSyncEvents(): Promise<number> {
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

  const eventosAntigos = await db.syncEvents
    .where('synced')
    .equals(true as never)
    .and(e => new Date(e.updatedAt) < seteDiasAtras)
    .toArray();

  const ids = eventosAntigos.map(e => e.id);
  await db.syncEvents.bulkDelete(ids);

  return ids.length;
}
