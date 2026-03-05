/**
 * Motor genérico de sync - reduz código, bugs e custo mental
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { getLastPulledAt, setLastPulledAt } from "../utils/syncCheckpoints";
import type { Table, IndexableType } from "dexie";

const MARGEM_TIMESTAMP = 1000;
const PAGE_SIZE = 1000;

// Tipagem rigorosa para os campos de sincronização (sem index signature para permitir interfaces do app)
export interface BaseSyncFields {
  id: IndexableType;
  uuid?: string | null;
  remoteId?: string | number | null;
  synced?: boolean;
  updatedAt?: string | null;
}

export interface PullEntityConfig<
  TLocal extends BaseSyncFields,
  TServer extends Record<string, unknown>,
> {
  remoteTable: string;
  orderBy?: string;
  updatedAtField?: string;
  updatedAtFieldLocal?: string;
  localTable: Table<TLocal, IndexableType>;
  mapper: (s: TServer) => TLocal;
  uuidField?: string;
  requireUuid?: boolean;
  deleteRemotes?: boolean;
  usePagination?: boolean;
  limit?: number;
  forceFullPull?: boolean;
}

export async function fetchFromSupabase<T>(
  tableName: string,
  options: {
    orderBy?: string;
    updatedAtField?: string;
    lastPulledAt?: string | null;
    limit?: number;
  } = {},
  client?: SupabaseClient,
): Promise<T[]> {
  const sb = client ?? supabase;
  let query = sb.from(tableName).select("*");
  const { orderBy = "id", updatedAtField, lastPulledAt, limit } = options;

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

export async function fetchAllPaginated<T>(
  tableName: string,
  options: {
    orderBy?: string;
    updatedAtField?: string;
    lastPulledAt?: string | null;
    limit?: number;
  } = {},
  client?: SupabaseClient,
): Promise<T[]> {
  const sb = client ?? supabase;
  const allRecords: T[] = [];
  let from = 0;
  const { orderBy = "id", updatedAtField, lastPulledAt, limit } = options;
  const pageSize = limit ? Math.min(limit, PAGE_SIZE) : PAGE_SIZE;

  let hasMore = true;
  while (hasMore) {
    let query = sb
      .from(tableName)
      .select("*")
      .range(from, from + pageSize - 1)
      .order(orderBy, { ascending: true });

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
      hasMore =
        page.length === pageSize && (!limit || allRecords.length < limit);
      from += pageSize;
      if (limit && allRecords.length >= limit) hasMore = false;
    } else {
      hasMore = false;
    }
  }
  return limit ? allRecords.slice(0, limit) : allRecords;
}

export async function pullEntity<
  TLocal extends BaseSyncFields,
  TServer extends Record<string, unknown>,
>(
  config: PullEntityConfig<TLocal, TServer>,
  client?: SupabaseClient,
): Promise<number> {
  const {
    remoteTable,
    orderBy = "id",
    updatedAtField = "updated_at",
    updatedAtFieldLocal = "updatedAt",
    localTable,
    mapper,
    uuidField = "uuid",
    requireUuid = true,
    deleteRemotes = true,
    usePagination = false,
    limit,
    forceFullPull = false,
  } = config;

  const lastPulledAt = forceFullPull ? null : getLastPulledAt(remoteTable);
  const fetchOpts = {
    orderBy,
    updatedAtField: lastPulledAt ? updatedAtField : undefined,
    lastPulledAt: lastPulledAt || undefined,
    limit,
  };

  const servRecords = usePagination
    ? await fetchAllPaginated<TServer>(remoteTable, fetchOpts, client)
    : await fetchFromSupabase<TServer>(remoteTable, fetchOpts, client);

  if (!servRecords || servRecords.length === 0) {
    setLastPulledAt(remoteTable, new Date().toISOString());
    return 0;
  }

  const servUuids = new Set(
    servRecords.map((r) => String(r[uuidField] ?? "")).filter(Boolean),
  );

  const localRecords = await localTable.toArray();
  const localMap = new Map(localRecords.map((r) => [String(r.id), r]));

  const isFullPull = lastPulledAt == null;
  if (deleteRemotes && isFullPull) {
    const idsParaDeletar = localRecords
      .filter((r) => r.remoteId != null && !servUuids.has(String(r.id)))
      .map((r) => r.id);
    if (idsParaDeletar.length > 0) await localTable.bulkDelete(idsParaDeletar);
  }

  const toPut: TLocal[] = [];
  const toUpdate: Array<{ key: string; changes: Partial<TLocal> }> = [];

  for (const s of servRecords) {
    const sUuid = s[uuidField];
    if (requireUuid && !sUuid) continue;

    const uuid = String(sUuid);
    const local = localMap.get(uuid);
    const mapped = mapper(s);

    if (!local) {
      toPut.push(mapped);
    } else {
      const servUpdated =
        typeof s[updatedAtField] === "string"
          ? new Date(s[updatedAtField] as string).getTime()
          : 0;
      const localUpdated =
        typeof (local as Record<string, unknown>)[updatedAtFieldLocal] ===
        "string"
          ? new Date(
              (local as Record<string, unknown>)[updatedAtFieldLocal] as string,
            ).getTime()
          : 0;

      if (!local.synced && localUpdated >= servUpdated - MARGEM_TIMESTAMP)
        continue;

      if (!local.remoteId || localUpdated < servUpdated) {
        toUpdate.push({ key: uuid, changes: mapped as Partial<TLocal> });
      }
    }
  }

  if (toPut.length > 0) await localTable.bulkPut(toPut);
  if (toUpdate.length > 0) {
    // bulkUpdate do Dexie exige um array de objetos com as chaves específicas
    for (const update of toUpdate) {
      await localTable.update(update.key, update.changes as object);
    }
  }

  const maxUpdated = servRecords.reduce<string | null>((max, r) => {
    const t = r[updatedAtField];
    if (typeof t === "string") {
      return !max || t > max ? t : max;
    }
    return max;
  }, null);

  setLastPulledAt(remoteTable, maxUpdated ?? new Date().toISOString());

  return toPut.length + toUpdate.length;
}

export async function pullEntitySimple<
  TLocal extends BaseSyncFields,
  TServer extends Record<string, unknown>,
>(
  remoteTable: string,
  localTable: Table<TLocal, IndexableType>,
  mapper: (s: TServer) => TLocal,
  opts: {
    uuidField?: string;
    updatedAtField?: string;
    usePagination?: boolean;
  } = {},
  client?: SupabaseClient,
): Promise<number> {
  const {
    uuidField = "uuid",
    updatedAtField = "updated_at",
    usePagination = false,
  } = opts;
  const lastPulledAt = getLastPulledAt(remoteTable);
  const fetchOpts = {
    orderBy: updatedAtField === "updated_at" ? "updated_at" : "id",
    updatedAtField: lastPulledAt ? updatedAtField : undefined,
    lastPulledAt: lastPulledAt || undefined,
  };

  const records = usePagination
    ? await fetchAllPaginated<TServer>(remoteTable, fetchOpts, client)
    : await fetchFromSupabase<TServer>(remoteTable, fetchOpts, client);

  if (!records || records.length === 0) {
    if (lastPulledAt) setLastPulledAt(remoteTable, new Date().toISOString());
    return 0;
  }

  const toPut = records
    .filter((r) => r[uuidField] != null)
    .map((r) => mapper(r));

  if (toPut.length > 0) {
    await localTable.bulkPut(toPut);
  }

  const maxUpdated = records.reduce<string | null>((max, r) => {
    const t = r[updatedAtField];
    return typeof t === "string" && (!max || t > max) ? t : max;
  }, null);
  setLastPulledAt(remoteTable, maxUpdated || new Date().toISOString());
  return toPut.length;
}
