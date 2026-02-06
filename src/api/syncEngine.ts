/**
 * Motor genérico de sync - reduz código, bugs e custo mental
 * Pull incremental + batch no IndexedDB
 */

import { supabase } from './supabaseClient';
import { getLastPulledAt, setLastPulledAt } from '../utils/syncCheckpoints';

const MARGEM_TIMESTAMP = 1000; // 1 segundo para conflito
const PAGE_SIZE = 1000;

export interface PullEntityConfig<TLocal, TServer> {
  remoteTable: string;
  orderBy?: string;
  updatedAtField?: string;
  /** Campo local para comparar (updatedAt ou timestamp) */
  updatedAtFieldLocal?: string;
  /** Dexie Table (bulkPut, bulkUpdate, toArray, delete) */
  localTable: any;
  mapper: (s: TServer) => TLocal;
  uuidField?: string;
  requireUuid?: boolean;
  deleteRemotes?: boolean;
  /** Usar paginação para tabelas grandes (animais, genealogias) */
  usePagination?: boolean;
  /** Limite de registros (ex: auditoria = 1000) */
  limit?: number;
  /** Para tabelas pequenas (categorias, raças, fazendas): sempre full pull, evita perder registros por checkpoint incremental */
  forceFullPull?: boolean;
}

/**
 * Busca registros do Supabase com suporte a incremental
 */
export async function fetchFromSupabase<T>(
  tableName: string,
  options: {
    orderBy?: string;
    updatedAtField?: string;
    lastPulledAt?: string | null;
    limit?: number;
  } = {}
): Promise<T[]> {
  let query = supabase.from(tableName).select('*');
  const { orderBy = 'id', updatedAtField, lastPulledAt, limit } = options;

  // gt (>) em vez de gte (>=): evita re-buscar o mesmo registro a cada sync
  if (updatedAtField && lastPulledAt) {
    query = query.gt(updatedAtField, lastPulledAt);
  }
  query = query.order(orderBy, { ascending: true });
  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`Erro ao buscar ${tableName}:`, error);
    throw error;
  }
  return (data || []) as T[];
}

/**
 * Busca todos com paginação (para tabelas grandes)
 */
export async function fetchAllPaginated<T>(
  tableName: string,
  options: { orderBy?: string; updatedAtField?: string; lastPulledAt?: string | null; limit?: number } = {}
): Promise<T[]> {
  const allRecords: T[] = [];
  let from = 0;
  const { orderBy = 'id', updatedAtField, lastPulledAt, limit } = options;
  const pageSize = limit ? Math.min(limit, PAGE_SIZE) : PAGE_SIZE;

  let hasMore = true;
  while (hasMore) {
    let query = supabase.from(tableName).select('*').range(from, from + pageSize - 1).order(orderBy, { ascending: true });
    // gt (>) evita re-buscar os mesmos registros a cada sync
    if (updatedAtField && lastPulledAt) {
      query = query.gt(updatedAtField, lastPulledAt);
    }
    const { data: page, error } = await query;

    if (error) {
      console.error(`Erro ao buscar ${tableName}:`, error);
      throw error;
    }
    if (page && page.length > 0) {
      allRecords.push(...(page as T[]));
      hasMore = page.length === pageSize && (!limit || allRecords.length < limit);
      from += pageSize;
      if (limit && allRecords.length >= limit) hasMore = false;
    } else {
      hasMore = false;
    }
  }
  return limit ? allRecords.slice(0, limit) : allRecords;
}

/**
 * Pull genérico com batch - bulkPut/bulkUpdate, zero await em loop
 * Suporta incremental, paginação e limite
 */
export async function pullEntity<TLocal, TServer extends Record<string, any>>(
  config: PullEntityConfig<TLocal, TServer>
): Promise<number> {
  const {
    remoteTable,
    orderBy = 'id',
    updatedAtField = 'updated_at',
    updatedAtFieldLocal = 'updatedAt',
    localTable,
    mapper,
    uuidField = 'uuid',
    requireUuid = true,
    deleteRemotes = true,
    usePagination = false,
    limit,
    forceFullPull = false
  } = config;

  const lastPulledAt = forceFullPull ? null : getLastPulledAt(remoteTable);
  const fetchOpts = {
    orderBy,
    updatedAtField: lastPulledAt ? updatedAtField : undefined,
    lastPulledAt: lastPulledAt || undefined,
    limit
  };
  const servRecords = usePagination
    ? await fetchAllPaginated<TServer>(remoteTable, fetchOpts)
    : await fetchFromSupabase<TServer>(remoteTable, fetchOpts);

  if (!servRecords || servRecords.length === 0) {
    setLastPulledAt(remoteTable, new Date().toISOString());
    return 0;
  }

  const servUuids = new Set(servRecords.map(r => r[uuidField]).filter(Boolean));
  const localRecords = await localTable.toArray();
  const localMap = new Map(localRecords.map((r: any) => [r.id, r]));

  if (deleteRemotes) {
    const idsParaDeletar = localRecords
      .filter((r: any) => r.remoteId != null && !servUuids.has(r.id))
      .map((r: any) => r.id);
    if (idsParaDeletar.length > 0) await localTable.bulkDelete(idsParaDeletar);
  }

  const toPut: TLocal[] = [];
  const toUpdate: Array<{ key: string; changes: Partial<TLocal> }> = [];

  for (const s of servRecords) {
    if (requireUuid && !s[uuidField]) continue;
    const uuid = s[uuidField];
    const local = localMap.get(uuid) as any;
    const mapped = mapper(s);

    if (!local) {
      toPut.push(mapped as TLocal);
    } else {
      const servUpdated = s[updatedAtField] ? new Date(s[updatedAtField]).getTime() : 0;
      const localUpdated = local[updatedAtFieldLocal] ? new Date(local[updatedAtFieldLocal]).getTime() : 0;

      if (!local.synced && localUpdated >= servUpdated - MARGEM_TIMESTAMP) continue;
      if (!local.remoteId || localUpdated < servUpdated) {
        toUpdate.push({ key: uuid, changes: mapped as Partial<TLocal> });
      }
    }
  }

  if (toPut.length > 0) await localTable.bulkPut(toPut);
  if (toUpdate.length > 0) await localTable.bulkUpdate(toUpdate);

  const maxUpdated = servRecords.reduce((max, r) => {
    const t = r[updatedAtField];
    return t && (!max || t > max) ? t : max;
  }, null as string | null);
  setLastPulledAt(remoteTable, maxUpdated || new Date().toISOString());

  return toPut.length + toUpdate.length;
}

/**
 * Pull simples - bulkPut com suporte a incremental
 */
export async function pullEntitySimple<TLocal, TServer>(
  remoteTable: string,
  localTable: any,
  mapper: (s: TServer) => TLocal,
  opts: { uuidField?: string; updatedAtField?: string; usePagination?: boolean } = {}
): Promise<number> {
  const { uuidField = 'uuid', updatedAtField = 'updated_at', usePagination = false } = opts;
  const lastPulledAt = getLastPulledAt(remoteTable);
  const fetchOpts = {
    orderBy: updatedAtField === 'updated_at' ? 'updated_at' : 'id',
    updatedAtField: lastPulledAt ? updatedAtField : undefined,
    lastPulledAt: lastPulledAt || undefined
  };
  const records = usePagination
    ? await fetchAllPaginated<TServer>(remoteTable, fetchOpts)
    : await fetchFromSupabase<TServer>(remoteTable, fetchOpts);
  if (!records || records.length === 0) {
    if (lastPulledAt) setLastPulledAt(remoteTable, new Date().toISOString());
    return 0;
  }

  const toPut = records
    .filter((r: any) => r[uuidField])
    .map(r => mapper(r) as TLocal);

  if (toPut.length > 0) {
    await localTable.bulkPut(toPut);
  }
  const maxUpdated = records.reduce((max, r: any) => {
    const t = r[updatedAtField];
    return t && (!max || t > max) ? t : max;
  }, null as string | null);
  setLastPulledAt(remoteTable, maxUpdated || new Date().toISOString());
  return toPut.length;
}
