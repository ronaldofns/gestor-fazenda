import { db } from "./../db/dexieDB";
import { SyncEvent, SyncEventType, SyncEntity } from "../db/models";
import { uuid } from "./uuid";
import type { Genealogia } from "../db/models";
/**
 * Verifica se há usuário logado (sessionStorage + Dexie). O sync usa getSupabaseForSync()
 * que retorna o client quando há sessão Supabase Auth (auth.uid() no servidor).
 */
async function hasLoggedInUser(): Promise<boolean> {
  try {
    if (typeof sessionStorage === "undefined") return false;
    const userId = sessionStorage.getItem("gestor-fazenda-user-id");
    if (!userId) {
      console.warn(
        "[Sync] sessionStorage sem gestor-fazenda-user-id. Faça login.",
      );
      return false;
    }
    const user = await db.usuarios.get(userId);
    if (!user || !user.ativo) {
      console.warn(
        "[Sync] Usuário não encontrado ou inativo no Dexie:",
        userId,
      );
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[Sync] hasLoggedInUser falhou:", e);
    return false;
  }
}

const MAX_TENTATIVAS = 5; // Máximo de tentativas antes de marcar como erro permanente
const MAX_CONCURRENCY = 3; // Batches concorrentes (2-3 ideal)
const BATCH_SIZE = 50; // Tamanho do lote para INSERT/UPDATE/DELETE

// Mapeamento entidade -> tabela Supabase
const tableMap: Record<SyncEntity, string> = {
  fazenda: "fazendas_online",
  raca: "racas_online",
  categoria: "categorias_online",
  desmama: "desmamas_online",
  matriz: "matrizes_online",
  usuario: "usuarios_online",
  audit: "audits_online",
  notificacaoLida: "notificacoes_lidas_online",
  alertSettings: "alert_settings_online",
  appSettings: "app_settings_online",
  rolePermission: "role_permissions_online",
  pesagem: "pesagens_online",
  vacina: "vacinacoes_online",
  confinamento: "confinamentos_online",
  confinamentoAnimal: "confinamento_animais_online",
  confinamentoAlimentacao: "confinamento_alimentacao_online",
  ocorrenciaAnimal: "ocorrencia_animais_online",
  animal: "animais_online",
  genealogia: "genealogias_online",
};

// Campo de conflito para upsert (uuid ou id)
const uuidFieldMap: Record<SyncEntity, string> = {
  fazenda: "uuid",
  raca: "uuid",
  categoria: "uuid",
  desmama: "uuid",
  matriz: "uuid",
  usuario: "uuid",
  audit: "uuid",
  notificacaoLida: "id",
  alertSettings: "id",
  appSettings: "id",
  rolePermission: "uuid",
  pesagem: "uuid",
  vacina: "uuid",
  confinamento: "uuid",
  confinamentoAnimal: "uuid",
  // confinamentoPesagem removed - usar 'pesagem'
  confinamentoAlimentacao: "uuid",
  ocorrenciaAnimal: "uuid",
  animal: "uuid",
  genealogia: "uuid",
};

const toSnake = (s: string) =>
  s.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

/** Converte keys do payload de camelCase para snake_case (Supabase). Remove synced/remoteId. id vira uuid quando for chave. */
function payloadToServerSnake(
  payload: Record<string, unknown>,
  conflictField: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === "synced" || k === "remoteId") continue;
    const key = k === "id" && conflictField === "uuid" ? "uuid" : toSnake(k);
    out[key] = v;
  }
  return out;
}

/** Converte payload local de auditoria para audits_online: before/after → before_json/after_json, userId → user_uuid. */
function payloadToServerAudit(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const parseIfString = (v: unknown): unknown => {
    if (typeof v === "string") {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  };
  return {
    uuid: payload.id,
    entity: payload.entity,
    entity_id: payload.entityId,
    action: payload.action,
    timestamp: payload.timestamp,
    user_uuid: payload.userId ?? null,
    user_nome: payload.userNome ?? null,
    before_json: payload.before != null ? parseIfString(payload.before) : null,
    after_json: payload.after != null ? parseIfString(payload.after) : null,
    description: payload.description ?? null,
  };
}

function mapKeysConfinamento(
  obj: Record<string, unknown>,
  exclude?: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "synced" || k === "remoteId" || exclude?.has(k)) continue;
    const key = k === "id" ? "uuid" : toSnake(k);
    out[key] = v;
  }
  return out;
}

/** Maps de FK para confinamento (uma leitura por batch, zero await no loop). */
interface ConfinamentoFkMaps {
  fazendas: Map<string, number | null>;
  confinamentos: Map<string, number | null>;
  confinamentoAnimais: Map<string, number | null>;
}

async function loadConfinamentoFkMaps(): Promise<ConfinamentoFkMaps> {
  const [fazendasArr, confinamentosArr, vinculosArr] = await Promise.all([
    db.fazendas.toArray(),
    db.confinamentos.toArray(),
    db.confinamentoAnimais.toArray(),
  ]);
  return {
    fazendas: new Map(fazendasArr.map((f) => [f.id, f.remoteId ?? null])),
    confinamentos: new Map(
      confinamentosArr.map((c) => [c.id, c.remoteId ?? null]),
    ),
    confinamentoAnimais: new Map(
      vinculosArr.map((v) => [v.id, v.remoteId ?? null]),
    ),
  };
}

/** Converte payload de confinamento usando maps pré-carregados (síncrono). */
function payloadToServerConfinamentoWithMaps(
  entidade: SyncEntity,
  payload: Record<string, unknown>,
  maps: ConfinamentoFkMaps,
): Record<string, unknown> | null {
  if (entidade === "confinamento") {
    const fazendaIdRemote = maps.fazendas.get(
      (payload.fazendaId as string) || "",
    );
    if (fazendaIdRemote == null && payload.fazendaId) return null;
    const base = mapKeysConfinamento(
      payload as Record<string, unknown>,
      new Set(["fazendaId"]),
    );
    return { ...base, fazenda_id: fazendaIdRemote };
  }
  if (entidade === "confinamentoAnimal") {
    const confinamentoIdRemote = maps.confinamentos.get(
      (payload.confinamentoId as string) || "",
    );
    if (confinamentoIdRemote == null && payload.confinamentoId) return null;
    const base = mapKeysConfinamento(
      payload as Record<string, unknown>,
      new Set(["confinamentoId"]),
    );
    return {
      ...base,
      confinamento_id: confinamentoIdRemote,
      animal_id: payload.animalId,
    };
  }
  // bloco de conversão de `confinamentoPesagem` removido - usamos mapeamento para `pesagem` geral
  if (entidade === "confinamentoAlimentacao") {
    const confinamentoIdRemote = maps.confinamentos.get(
      (payload.confinamentoId as string) || "",
    );
    if (confinamentoIdRemote == null && payload.confinamentoId) return null;
    const base = mapKeysConfinamento(
      payload as Record<string, unknown>,
      new Set(["confinamentoId"]),
    );
    return { ...base, confinamento_id: confinamentoIdRemote };
  }
  if (entidade === "ocorrenciaAnimal") {
    const base = mapKeysConfinamento(
      payload as Record<string, unknown>,
      new Set(["confinamentoAnimalId"]),
    );
    const out: Record<string, unknown> = {
      ...base,
      animal_id: payload.animalId,
    };
    if (payload.confinamentoAnimalId) {
      const confinamentoAnimalIdRemote = maps.confinamentoAnimais.get(
        payload.confinamentoAnimalId as string,
      );
      if (confinamentoAnimalIdRemote == null) return null;
      out.confinamento_animal_id = confinamentoAnimalIdRemote;
    }
    return out;
  }
  return null;
}

/** Maps de FK para conversão de animais em batch (uma leitura por batch, zero await no loop). */
interface AnimalFkMaps {
  tipos: Map<string, number | null>;
  status: Map<string, number | null>;
  origens: Map<string, number | null>;
  fazendas: Map<string, number | null>;
  racas: Map<string, number | null>;
}

/** Carrega todas as tabelas de FK de animais de uma vez (motor batch). */
async function loadAnimalFkMaps(): Promise<AnimalFkMaps> {
  const [tiposArr, statusArr, origensArr, fazendasArr, racasArr] =
    await Promise.all([
      db.tiposAnimal.toArray(),
      db.statusAnimal.toArray(),
      db.origens.toArray(),
      db.fazendas.toArray(),
      db.racas.toArray(),
    ]);
  return {
    tipos: new Map(tiposArr.map((t) => [t.id, t.remoteId ?? null])),
    status: new Map(statusArr.map((s) => [s.id, s.remoteId ?? null])),
    origens: new Map(origensArr.map((o) => [o.id, o.remoteId ?? null])),
    fazendas: new Map(fazendasArr.map((f) => [f.id, f.remoteId ?? null])),
    racas: new Map(racasArr.map((r) => [r.id, r.remoteId ?? null])),
  };
}

/** Converte um payload local de animal para animais_online usando maps pré-carregados (síncrono, zero await). */
function payloadToServerAnimalWithMaps(
  payload: Record<string, unknown>,
  maps: AnimalFkMaps,
): Record<string, unknown> | null {
  const fazendaId = maps.fazendas.get((payload.fazendaId as string) || "");
  if (
    payload.fazendaId != null &&
    (fazendaId === undefined || fazendaId === null)
  )
    return null;
  const racaId = (payload.racaId as string)
    ? (maps.racas.get(payload.racaId as string) ?? null)
    : null;
  const fazendaOrigemId = (payload.fazendaOrigemId as string)
    ? (maps.fazendas.get(payload.fazendaOrigemId as string) ?? null)
    : null;
  return {
    uuid: payload.id,
    brinco: payload.brinco,
    nome: payload.nome ?? null,
    tipo_id: maps.tipos.get((payload.tipoId as string) || "") ?? null,
    raca_id: racaId,
    sexo: payload.sexo ?? null,
    status_id: maps.status.get((payload.statusId as string) || "") ?? null,
    data_nascimento: payload.dataNascimento ?? null,
    data_cadastro: payload.dataCadastro ?? null,
    data_entrada: payload.dataEntrada ?? null,
    data_saida: payload.dataSaida ?? null,
    origem_id: maps.origens.get((payload.origemId as string) || "") ?? null,
    fazenda_id: fazendaId ?? null,
    fazenda_origem_id: fazendaOrigemId,
    proprietario_anterior: payload.proprietarioAnterior ?? null,
    matriz_id: payload.matrizId ?? null,
    reprodutor_id: payload.reprodutorId ?? null,
    valor_compra: payload.valorCompra ?? null,
    valor_venda: payload.valorVenda ?? null,
    pelagem: payload.pelagem ?? null,
    peso_atual: payload.pesoAtual ?? null,
    lote: payload.lote ?? null,
    categoria: payload.categoria ?? null,
    obs: payload.obs ?? null,
    created_at: payload.createdAt ?? null,
    updated_at: payload.updatedAt ?? null,
    deleted_at: payload.deletedAt ?? null,
  };
}

interface GenealogiaFkMaps {
  animais: Map<string, number>;
  tiposAnimal: Map<string, number>;
}

async function loadGenealogiaFkMaps(): Promise<GenealogiaFkMaps> {
  const [animais, tiposAnimal] = await Promise.all([
    db.animais.where("remoteId").above(0).toArray(),
    db.tiposAnimal.where("remoteId").above(0).toArray(),
  ]);

  return {
    animais: new Map(animais.map((a) => [a.id, a.remoteId!])),
    tiposAnimal: new Map(tiposAnimal.map((t) => [t.id, t.remoteId!])),
  };
}
function fk(map: Map<string, number>, id?: string): number | null {
  if (!id) return null;
  return map.get(id) ?? null;
}

function payloadToServerGenealogiaWithMaps(
  payload: Genealogia,
  maps: GenealogiaFkMaps,
) {
  const animalId = maps.animais.get(payload.animalId);
  if (!animalId) return null;

  const matrizId = fk(maps.animais, payload.matrizId);
  const reprodutorId = fk(maps.animais, payload.reprodutorId);
  const avoMaterna = fk(maps.animais, payload.avoMaterna);
  const avoPaterna = fk(maps.animais, payload.avoPaterna);
  const avoPaternoMaterno = fk(maps.animais, payload.avoPaternoMaterno);
  const avoPaternoPatro = fk(maps.animais, payload.avoPaternoPatro);
  const tipoMatrizId = fk(maps.tiposAnimal, payload.tipoMatrizId);

  // ❗ Se informou FK mas ela ainda não foi sincronizada → aguarda
  if (
    (payload.matrizId && matrizId == null) ||
    (payload.reprodutorId && reprodutorId == null) ||
    (payload.avoMaterna && avoMaterna == null) ||
    (payload.avoPaterna && avoPaterna == null) ||
    (payload.avoPaternoMaterno && avoPaternoMaterno == null) ||
    (payload.avoPaternoPatro && avoPaternoPatro == null) ||
    (payload.tipoMatrizId && tipoMatrizId == null)
  ) {
    return null;
  }

  return {
    uuid: payload.id, // PK lógico da genealogia
    animal_id: animalId,
    matriz_id: matrizId,
    reprodutor_id: reprodutorId,
    avo_materna_id: avoMaterna,
    avo_paterna_id: avoPaterna,
    avo_paterno_materno_id: avoPaternoMaterno,
    avo_paterno_patro_id: avoPaternoPatro,
    tipo_matriz_id: tipoMatrizId,
    geracoes: payload.geracoes,
    observacoes: payload.observacoes ?? null,
    created_at: payload.createdAt,
    updated_at: payload.updatedAt,
    deleted_at: payload.deletedAt ?? null,
  };
}

/**
 * Cria um evento de sincronização na fila
 */
export async function createSyncEvent(
  tipo: SyncEventType,
  entidade: SyncEntity,
  entityId: string,
  payload?: any,
): Promise<string> {
  const now = new Date().toISOString();
  const eventId = uuid();

  const event: SyncEvent = {
    id: eventId,
    tipo,
    entidade,
    entityId,
    payload: payload ? JSON.stringify(payload) : "",
    tentativas: 0,
    erro: null,
    synced: false,
    createdAt: now,
    updatedAt: now,
    remoteId: null,
  };

  try {
    await db.syncEvents.add(event);
    return eventId;
  } catch (error) {
    console.error("Erro ao criar evento de sincronização:", error);
    throw error;
  }
}

/**
 * Marca batch com erro (incrementa tentativas, não quebra o fluxo)
 */
async function markBatchError(
  events: SyncEvent[],
  message: string,
  now: string,
): Promise<void> {
  if (events.length === 0) return;
  await db.syncEvents.bulkUpdate(
    events.map((e) => ({
      key: e.id,
      changes: {
        tentativas: e.tentativas + 1,
        erro: message,
        updatedAt: now,
      },
    })),
  );
}

/**
 * Enriquece eventos DELETE com remoteId da entidade local (quando o evento foi criado com remoteId null).
 */
async function enrichDeleteEventsWithRemoteId(
  events: SyncEvent[],
): Promise<void> {
  if (events.length === 0) return;
  const entidade = events[0].entidade;
  const table = getLocalTableForEntity(entidade);
  if (!table) return;
  for (const e of events) {
    if (e.remoteId != null) continue;
    const rec = (await table.get(e.entityId)) as
      | { remoteId?: number | null }
      | undefined;
    if (rec?.remoteId != null)
      (e as SyncEvent & { remoteId?: number | null }).remoteId = rec.remoteId;
  }
}

/**
 * Processa batch de DELETE em lote
 */
async function processDeleteBatch(
  events: SyncEvent[],
  now: string,
): Promise<{
  sucesso: number;
  falhas: number;
  erros: Array<{ event: SyncEvent; error: string }>;
}> {
  const resultados = {
    sucesso: 0,
    falhas: 0,
    erros: [] as Array<{ event: SyncEvent; error: string }>,
  };

  await enrichDeleteEventsWithRemoteId(events);

  const ids = events.map((e) => e.remoteId).filter((id) => id != null) as (
    | number
    | string
  )[];

  // Eventos sem remoteId: nunca foram ao servidor, marcar como sincronizados
  const semRemoteId = events.filter((e) => e.remoteId == null);
  if (semRemoteId.length > 0) {
    await db.syncEvents.bulkUpdate(
      semRemoteId.map((e) => ({
        key: e.id,
        changes: { synced: true, tentativas: e.tentativas + 1, updatedAt: now },
      })),
    );
    resultados.sucesso += semRemoteId.length;
  }

  if (ids.length === 0) {
    return resultados;
  }

  const sessionOk = await hasLoggedInUser();
  if (!sessionOk) {
    const msg =
      "Sessão JWT não disponível. Faça login novamente e tente sincronizar.";
    const comRemoteId = events.filter((e) => e.remoteId != null);
    await markBatchError(comRemoteId, msg, now);
    resultados.falhas = ids.length;
    comRemoteId.forEach((e) => resultados.erros.push({ event: e, error: msg }));
    return resultados;
  }

  const { getSupabaseForSync } = await import("../api/supabaseSyncClient");
  const supabase = await getSupabaseForSync();
  if (!supabase) {
    const msg =
      "Sessão não disponível para sync. Faça login com Supabase Auth e tente novamente.";
    const comRemoteId = events.filter((e) => e.remoteId != null);
    await markBatchError(comRemoteId, msg, now);
    resultados.falhas = ids.length;
    comRemoteId.forEach((e) => resultados.erros.push({ event: e, error: msg }));
    return resultados;
  }

  try {
    const table = tableMap[events[0].entidade];
    if (!table) {
      await markBatchError(
        events.filter((e) => e.remoteId != null),
        `Tabela não encontrada: ${events[0].entidade}`,
        now,
      );
      resultados.falhas += ids.length;
      events
        .filter((e) => e.remoteId != null)
        .forEach((e) =>
          resultados.erros.push({ event: e, error: "Tabela não encontrada" }),
        );
      return resultados;
    }

    const { error } = await supabase.from(table).delete().in("id", ids);

    if (error) {
      const comRemoteId = events.filter((e) => e.remoteId != null);
      await markBatchError(
        comRemoteId,
        error.message || "Erro ao deletar em lote",
        now,
      );
      resultados.falhas += ids.length;
      comRemoteId.forEach((e) =>
        resultados.erros.push({ event: e, error: error.message || "Erro" }),
      );
      return resultados;
    }

    const comRemoteId = events.filter((e) => e.remoteId != null);
    await db.syncEvents.bulkUpdate(
      comRemoteId.map((e) => ({
        key: e.id,
        changes: {
          synced: true,
          erro: null,
          tentativas: e.tentativas + 1,
          updatedAt: now,
        },
      })),
    );
    resultados.sucesso += ids.length;
  } catch (err: any) {
    const comRemoteId = events.filter((e) => e.remoteId != null);
    await markBatchError(
      comRemoteId,
      err?.message || "Erro ao processar DELETE",
      now,
    );
    resultados.falhas += ids.length;
    comRemoteId.forEach((e) =>
      resultados.erros.push({ event: e, error: err?.message || "Erro" }),
    );
  }

  return resultados;
}

/**
 * Processa batch de INSERT/UPDATE em lote (upsert)
 */
async function processUpsertBatch(
  events: SyncEvent[],
  now: string,
): Promise<{
  sucesso: number;
  falhas: number;
  erros: Array<{ event: SyncEvent; error: string }>;
}> {
  const resultados = {
    sucesso: 0,
    falhas: 0,
    erros: [] as Array<{ event: SyncEvent; error: string }>,
  };

  if (events.length === 0) return resultados;

  const sample = events[0];
  const table = tableMap[sample.entidade];
  const conflictField =
    uuidFieldMap[sample.entidade] === "uuid" ? "uuid" : "id";
  const isRolePermission = sample.entidade === "rolePermission";

  if (!table) {
    await markBatchError(
      events,
      `Tabela não encontrada: ${sample.entidade}`,
      now,
    );
    resultados.falhas = events.length;
    events.forEach((e) =>
      resultados.erros.push({ event: e, error: "Tabela não encontrada" }),
    );
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
    await markBatchError(invalidos, "Payload inválido ou vazio", now);
    resultados.falhas = invalidos.length;
    invalidos.forEach((e) =>
      resultados.erros.push({ event: e, error: "Payload inválido" }),
    );
  }

  if (parsed.length === 0) {
    return resultados;
  }

  const firstParsed = parsed[0];
  const entidade = firstParsed.event.entidade;
  const isConfinamentoEntity =
    entidade === "confinamento" ||
    entidade === "confinamentoAnimal" ||
    entidade === "confinamentoAlimentacao" ||
    entidade === "ocorrenciaAnimal";

  let payloads: Record<string, unknown>[];
  let eventosValidos: SyncEvent[];

  if (entidade === "animal") {
    const maps = await loadAnimalFkMaps();
    const converted: { event: SyncEvent; payload: Record<string, unknown> }[] =
      [];
    const falhas: SyncEvent[] = [];
    for (const { event, payload } of parsed) {
      const serverPayload = payloadToServerAnimalWithMaps(
        payload as Record<string, unknown>,
        maps,
      );
      if (serverPayload != null) {
        converted.push({ event, payload: serverPayload });
      } else {
        falhas.push(event);
      }
    }
    if (falhas.length > 0) {
      const msg =
        "FK não resolvida (fazenda/tipo/status/origem ainda não sincronizada?). Sincronize fazendas e cadastros primeiro.";
      await markBatchError(falhas, msg, now);
      resultados.falhas = falhas.length;
      falhas.forEach((e) => resultados.erros.push({ event: e, error: msg }));
    }
    payloads = converted.map((c) => c.payload);
    eventosValidos = converted.map((c) => c.event);
    if (payloads.length === 0) return resultados;
  } else if (entidade === "genealogia") {
    const maps = await loadGenealogiaFkMaps();
    const converted: { event: SyncEvent; payload: Record<string, unknown> }[] =
      [];
    const falhas: SyncEvent[] = [];

    for (const { event, payload } of parsed) {
      const serverPayload = payloadToServerGenealogiaWithMaps(
        payload as Record<string, unknown>,
        maps,
      );

      if (serverPayload != null) {
        converted.push({ event, payload: serverPayload });
      } else {
        falhas.push(event);
      }
    }

    if (falhas.length > 0) {
      const msg =
        "FK de genealogia não resolvida (animal/matriz ainda não sincronizados). Sincronize animais antes.";
      await markBatchError(falhas, msg, now);
      resultados.falhas = falhas.length;
      falhas.forEach((e) => resultados.erros.push({ event: e, error: msg }));
    }

    payloads = converted.map((c) => c.payload);
    eventosValidos = converted.map((c) => c.event);

    if (payloads.length === 0) return resultados;
  } else if (isConfinamentoEntity) {
    const confMaps = await loadConfinamentoFkMaps();
    const converted: { event: SyncEvent; payload: Record<string, unknown> }[] =
      [];
    const falhas: SyncEvent[] = [];
    for (const { event, payload } of parsed) {
      const serverPayload = payloadToServerConfinamentoWithMaps(
        entidade,
        payload as Record<string, unknown>,
        confMaps,
      );
      if (serverPayload != null) {
        converted.push({ event, payload: serverPayload });
      } else {
        falhas.push(event);
      }
    }
    if (falhas.length > 0) {
      const msg =
        "FK não resolvida (confinamento/fazenda/confinamento_animal ainda não sincronizado?). Sincronize na ordem: Confinamentos → Confinamento Animais → Pesagens/Alimentação.";
      await markBatchError(falhas, msg, now);
      resultados.falhas = falhas.length;
      falhas.forEach((e) => resultados.erros.push({ event: e, error: msg }));
    }
    payloads = converted.map((c) => c.payload);
    eventosValidos = converted.map((c) => c.event);
    if (payloads.length === 0) return resultados;
  } else if (entidade === "audit") {
    payloads = parsed.map((p) =>
      payloadToServerAudit(p.payload as Record<string, unknown>),
    );
    eventosValidos = parsed.map((p) => p.event);
  } else {
    payloads = parsed.map((p) =>
      payloadToServerSnake(p.payload as Record<string, unknown>, conflictField),
    );
    eventosValidos = parsed.map((p) => p.event);
  }

  // Deduplicar por chave de conflito: Postgres "ON CONFLICT DO UPDATE" não pode afetar a mesma linha duas vezes no mesmo comando
  const byConflictKey = new Map<string, Record<string, unknown>>();
  for (const p of payloads) {
    const key = isRolePermission
      ? `${String((p as any).role ?? "")}\0${String((p as any).permission ?? "")}`
      : String(p[conflictField] ?? (p as any).id ?? (p as any).uuid ?? "");
    if (key) byConflictKey.set(key, p);
  }
  const payloadsToSend = Array.from(byConflictKey.values());
  if (payloadsToSend.length === 0) return resultados;

  // Usuário logado? Sync usa client com JWT explícito (getSupabaseForSync), não o client global.
  const sessionOk = await hasLoggedInUser();
  if (!sessionOk) {
    const msg =
      "Sessão JWT não disponível. Faça login novamente e tente sincronizar.";
    await markBatchError(eventosValidos, msg, now);
    resultados.falhas = eventosValidos.length;
    eventosValidos.forEach((e) =>
      resultados.erros.push({ event: e, error: msg }),
    );
    return resultados;
  }

  const { getSupabaseForSync } = await import("../api/supabaseSyncClient");
  const supabase = await getSupabaseForSync();
  if (!supabase) {
    const msg =
      "Sessão não disponível para sync. Faça login com Supabase Auth e tente novamente.";
    await markBatchError(eventosValidos, msg, now);
    resultados.falhas = eventosValidos.length;
    eventosValidos.forEach((e) =>
      resultados.erros.push({ event: e, error: msg }),
    );
    return resultados;
  }

  if (entidade === "audit") {
    console.info("[Sync] Enviando upsert para audits_online (client com JWT)");
  }

  try {
    const upsertConflict = isRolePermission ? "role,permission" : conflictField;
    const selectCols = isRolePermission
      ? "id, uuid, role, permission"
      : "id, uuid";
    const { data: upserted, error } = await supabase
      .from(table)
      .upsert(payloadsToSend, { onConflict: upsertConflict })
      .select(selectCols);

    if (error) {
      const is401 =
        error.message?.includes("401") || (error as any).status === 401;
      const isRls =
        (error as any).code === "42501" ||
        error.message?.includes("row-level security");
      if (is401 || entidade === "audit") {
        console.warn(
          "[Sync] Erro no upsert",
          table,
          ":",
          error.code,
          error.message,
          error,
        );
      }
      const msg = is401
        ? "Não autorizado (401). Faça login novamente com Supabase Auth."
        : isRls
          ? "RLS bloqueou a escrita (auth.uid() nulo). Faça login com Supabase Auth e sincronize de novo."
          : error.message || "Erro no upsert";
      await markBatchError(eventosValidos, msg, now);
      resultados.falhas = eventosValidos.length;
      eventosValidos.forEach((e) =>
        resultados.erros.push({ event: e, error: msg }),
      );
      return resultados;
    }

    // Atualizar remoteId nos registros locais (permite resolver FKs e manter consistência)
    if (upserted && upserted.length > 0) {
      const localTable = getLocalTableForEntity(entidade);
      if (localTable) {
        if (isRolePermission) {
          for (const r of upserted as any[]) {
            if (r.role != null && r.permission != null) {
              const locais = await db.rolePermissions
                .where({ role: r.role, permission: r.permission })
                .toArray();
              await Promise.all(
                locais.map((rec) =>
                  db.rolePermissions.update(rec.id, {
                    remoteId: r.id,
                    synced: true,
                  }),
                ),
              );
            }
          }
        } else {
          const updates = upserted
            .filter((r: any) => r.uuid != null || r.id != null)
            .map((r: any) => ({
              key: conflictField === "uuid" ? r.uuid : String(r.id),
              changes: { remoteId: r.id, synced: true },
            }));
          if (updates.length > 0) await localTable.bulkUpdate(updates);
        }
      }
    }

    await db.syncEvents.bulkUpdate(
      eventosValidos.map((e) => ({
        key: e.id,
        changes: {
          synced: true,
          erro: null,
          tentativas: e.tentativas + 1,
          updatedAt: now,
        },
      })),
    );
    resultados.sucesso = eventosValidos.length;
    // Log explícito para confirmar que confinamento foi enviado
    if (isConfinamentoEntity && resultados.sucesso > 0) {
      const label =
        entidade === "confinamento"
          ? "Confinamentos"
          : entidade === "confinamentoAnimal"
            ? "Confinamento Animais"
            : entidade === "confinamentoAlimentacao"
              ? "Confinamento Alimentação"
              : "Ocorrências Animal";
      console.log(
        `✅ Envio ${label}: ${resultados.sucesso} registro(s) enviado(s) ao servidor`,
      );
    }
  } catch (err: any) {
    await markBatchError(
      eventosValidos,
      err?.message || "Erro ao processar upsert",
      now,
    );
    resultados.falhas = eventosValidos.length;
    eventosValidos.forEach((e) =>
      resultados.erros.push({ event: e, error: err?.message || "Erro" }),
    );
  }

  return resultados;
}

function getLocalTableForEntity(entidade: SyncEntity): any {
  switch (entidade) {
    case "fazenda":
      return db.fazendas;
    case "raca":
      return db.racas;
    case "categoria":
      return db.categorias;
    case "desmama":
      return db.desmamas;
    case "matriz":
      return db.matrizes;
    case "usuario":
      return db.usuarios;
    case "audit":
      return db.audits;
    case "notificacaoLida":
      return db.notificacoesLidas;
    case "alertSettings":
      return db.alertSettings;
    case "appSettings":
      return db.appSettings;
    case "rolePermission":
      return db.rolePermissions;
    case "pesagem":
      return db.pesagens;
    case "vacina":
      return db.vacinacoes;
    case "confinamento":
      return db.confinamentos;
    case "confinamentoAnimal":
      return db.confinamentoAnimais;
    case "confinamentoAlimentacao":
      return db.confinamentoAlimentacao;
    case "ocorrenciaAnimal":
      return db.ocorrenciaAnimais;
    case "animal":
      return db.animais;
    case "genealogia":
      return db.genealogias;
    default:
      return null;
  }
}

/**
 * Processa um batch (DELETE ou UPSERT)
 */
async function processBatch(
  events: SyncEvent[],
  now: string,
): Promise<{
  sucesso: number;
  falhas: number;
  erros: Array<{ event: SyncEvent; error: string }>;
}> {
  if (events.length === 0) return { sucesso: 0, falhas: 0, erros: [] };

  if (events[0].tipo === "DELETE") {
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
    .filter((e) => !e.synced)
    .sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));

  if (pendentes.length === 0) {
    return { processados: 0, sucesso: 0, falhas: 0, erros: [] };
  }

  await hasLoggedInUser();

  // Filtrar eventos que excederam tentativas
  const elegiveis = pendentes.filter((e) => e.tentativas < MAX_TENTATIVAS);
  const descartados = pendentes.length - elegiveis.length;

  // Agrupar por entidade + tipo
  const grupos = new Map<string, SyncEvent[]>();
  for (const e of elegiveis) {
    const key = `${e.entidade}:${e.tipo}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(e);
  }

  // Ordem de processamento: confinamento antes de confinamento_animais, que antes de pesagens/alimentação (FKs)
  const entityOrder: SyncEntity[] = [
    "confinamento",
    "confinamentoAnimal",
    "ocorrenciaAnimal",
    "confinamentoAlimentacao",
  ];
  const orderKey = (key: string) => {
    const ent = key.split(":")[0] as SyncEntity;
    const i = entityOrder.indexOf(ent);
    return i >= 0 ? i : 999;
  };

  // Criar batches de BATCH_SIZE, respeitando ordem de dependência
  const batches: SyncEvent[][] = [];
  const sortedKeys = Array.from(grupos.keys()).sort(
    (a, b) => orderKey(a) - orderKey(b),
  );
  for (const key of sortedKeys) {
    const group = grupos.get(key)!;
    for (let i = 0; i < group.length; i += BATCH_SIZE) {
      batches.push(group.slice(i, i + BATCH_SIZE));
    }
  }

  const resultados = {
    processados: 0,
    sucesso: 0,
    falhas: 0,
    erros: [] as Array<{ event: SyncEvent; error: string }>,
  };
  const now = new Date().toISOString();

  // Ondas sequenciais: confinamento → confinamento_animais → pesagens/alimentação → resto
  // Assim o remoteId do confinamento (e dos vínculos) já está no IndexedDB antes de resolver FKs
  const confinamentoEntities: SyncEntity[] = [
    "confinamento",
    "confinamentoAnimal",
    "confinamentoAlimentacao",
  ];
  const waveForEntity = (ent: SyncEntity): number => {
    const i = confinamentoEntities.indexOf(ent);
    return i >= 0 ? i : confinamentoEntities.length;
  };
  const waves: SyncEvent[][][] = [];
  let currentWave = waveForEntity(batches[0]?.[0]?.entidade ?? "");
  let waveBatches: SyncEvent[][] = [];
  for (const batch of batches) {
    const ent = batch[0]?.entidade;
    const w = waveForEntity(ent ?? "");
    if (w !== currentWave) {
      if (waveBatches.length > 0) waves.push(waveBatches);
      waveBatches = [];
      currentWave = w;
    }
    waveBatches.push(batch);
  }
  if (waveBatches.length > 0) waves.push(waveBatches);

  for (const wave of waves) {
    if (wave.length === 0) continue;
    let index = 0;
    const worker = async (): Promise<void> => {
      let i: number;
      while ((i = index++) < wave.length) {
        const batch = wave[i];
        const r = await processBatch(batch, now);
        resultados.processados += batch.length;
        resultados.sucesso += r.sucesso;
        resultados.falhas += r.falhas;
        resultados.erros.push(...r.erros);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENCY, wave.length) }, worker),
    );
  }

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
 * Zera tentativas e erro dos eventos que excederam MAX_TENTATIVAS,
 * para que possam ser reprocessados na próxima "Sincronizar Agora"
 * (útil após corrigir formato de payload, ex.: snake_case).
 */
export async function resetFailedSyncEvents(): Promise<number> {
  const todos = await db.syncEvents.toArray();
  const comErro = todos.filter(
    (e) => !e.synced && e.tentativas >= MAX_TENTATIVAS,
  );
  if (comErro.length === 0) return 0;
  const now = new Date().toISOString();
  await db.syncEvents.bulkUpdate(
    comErro.map((e) => ({
      key: e.id,
      changes: { tentativas: 0, erro: null, updatedAt: now },
    })),
  );
  return comErro.length;
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
    pendentes: todos.filter((e) => !e.synced).length,
    sincronizados: todos.filter((e) => e.synced).length,
    comErro: todos.filter((e) => !e.synced && e.tentativas >= MAX_TENTATIVAS)
      .length,
    porTipo: { INSERT: 0, UPDATE: 0, DELETE: 0 } as Record<
      SyncEventType,
      number
    >,
    porEntidade: {} as Record<SyncEntity, number>,
  };

  for (const event of todos) {
    stats.porTipo[event.tipo]++;
    stats.porEntidade[event.entidade] =
      (stats.porEntidade[event.entidade] || 0) + 1;
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
  exemplos: Array<{
    id: string;
    createdAt: unknown;
    tipo: string;
    entidade: string;
  }>;
}> {
  const todos = await db.syncEvents.toArray();
  const invalidos = todos.filter((e) => {
    const v = e.createdAt;
    return v === undefined || v === null || typeof v !== "string" || v === "";
  });
  return {
    total: todos.length,
    comCreatedAtInvalido: invalidos.length,
    ids: invalidos.map((e) => e.id),
    exemplos: invalidos.slice(0, 10).map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      tipo: e.tipo,
      entidade: e.entidade,
    })),
  };
}

/**
 * Cria eventos de sincronização para registros que estão com synced=false
 * mas não possuem evento pendente na fila (ex.: desmama/confinamento salvos antes do createSyncEvent).
 * Retorna quantos eventos foram criados.
 */
export async function createSyncEventsForPendingRecords(): Promise<{
  created: number;
  errors: string[];
}> {
  const result = { created: 0, errors: [] as string[] };

  // ===============================
  // MAPA DE EVENTOS JÁ PENDENTES
  // ===============================
  const todosEventos = await db.syncEvents.toArray();
  const pendentesPorEntidade = new Map<SyncEntity, Set<string>>();

  for (const e of todosEventos.filter((ev) => !ev.synced)) {
    if (!pendentesPorEntidade.has(e.entidade)) {
      pendentesPorEntidade.set(e.entidade, new Set());
    }
    pendentesPorEntidade.get(e.entidade)!.add(e.entityId);
  }

  const hasPending = (entidade: SyncEntity, entityId: string) =>
    pendentesPorEntidade.get(entidade)?.has(entityId) ?? false;

  const addEvent = async (
    entidade: SyncEntity,
    entityId: string,
    payload: any,
  ) => {
    if (hasPending(entidade, entityId)) return;

    try {
      await createSyncEvent("UPDATE", entidade, entityId, payload);
      result.created++;

      if (!pendentesPorEntidade.has(entidade)) {
        pendentesPorEntidade.set(entidade, new Set());
      }
      pendentesPorEntidade.get(entidade)!.add(entityId);
    } catch (err: any) {
      result.errors.push(`${entidade} ${entityId}: ${err?.message || err}`);
    }
  };

  // ===============================
  // TABELAS PADRÃO
  // ===============================
  const tables: {
    table: any;
    entity: SyncEntity;
    filter?: (r: any) => boolean;
  }[] = [
    { table: db.fazendas, entity: "fazenda" },
    { table: db.racas, entity: "raca" },
    { table: db.categorias, entity: "categoria" },
    { table: db.desmamas, entity: "desmama" },
    { table: db.matrizes, entity: "matriz" },
    { table: db.pesagens, entity: "pesagem" },
    { table: db.vacinacoes, entity: "vacina" },
    { table: db.audits, entity: "audit" },
  ];

  for (const { table, entity, filter } of tables) {
    try {
      if (!table) continue;
      const rows = await table.toArray();
      const pendentes = filter
        ? rows.filter(filter)
        : rows.filter((r: any) => r.synced === false);

      for (const r of pendentes) {
        if (r.id) await addEvent(entity, r.id, r);
      }
    } catch (err: any) {
      result.errors.push(`${entity}: ${err?.message || err}`);
    }
  }

  // ===============================
  // USUÁRIOS
  // ===============================
  try {
    if (db.usuarios) {
      const usuarios = await db.usuarios.toArray();
      for (const u of usuarios.filter((r: any) => r.synced === false)) {
        await addEvent("usuario", u.id, u);
      }
    }
  } catch (err: any) {
    result.errors.push(`usuarios: ${err?.message || err}`);
  }

  // ===============================
  // NOTIFICAÇÕES
  // ===============================
  try {
    if (db.notificacoesLidas) {
      const nl = await db.notificacoesLidas.toArray();
      for (const n of nl.filter((r: any) => r.synced === false)) {
        await addEvent("notificacaoLida", n.id, n);
      }
    }
  } catch (err: any) {
    result.errors.push(`notificacoesLidas: ${err?.message || err}`);
  }

  // ===============================
  // ALERT SETTINGS
  // ===============================
  try {
    if (db.alertSettings) {
      const settings = await db.alertSettings.toArray();
      for (const a of settings.filter((r: any) => r.synced === false)) {
        await addEvent("alertSettings", a.id, a);
      }
    }
  } catch (err: any) {
    result.errors.push(`alertSettings: ${err?.message || err}`);
  }

  // ===============================
  // APP SETTINGS
  // ===============================
  try {
    if (db.appSettings) {
      const apps = await db.appSettings.toArray();
      for (const a of apps.filter((r: any) => r.synced === false)) {
        await addEvent("appSettings", a.id, a);
      }
    }
  } catch (err: any) {
    result.errors.push(`appSettings: ${err?.message || err}`);
  }

  // ===============================
  // ROLE PERMISSIONS
  // ===============================
  try {
    if (db.rolePermissions) {
      const roles = await db.rolePermissions.toArray();
      for (const r of roles.filter((x: any) => x.synced === false)) {
        await addEvent("rolePermission", r.id, r);
      }
    }
  } catch (err: any) {
    result.errors.push(`rolePermissions: ${err?.message || err}`);
  }

  // ===============================
  // ANIMAIS
  // ===============================
  try {
    const animais = await db.animais.toArray();
    for (const a of animais.filter(
      (r: any) => !r.deletedAt && r.synced === false,
    )) {
      await addEvent("animal", a.id, a);
    }
  } catch (err: any) {
    result.errors.push(`animais: ${err?.message || err}`);
  }

  // ===============================
  // GENEALOGIAS ✅ (CORRIGIDO)
  // ===============================
  try {
    if (db.genealogias) {
      const genealogias = await db.genealogias.toArray();

      for (const g of genealogias.filter(
        (r: any) => !r.deletedAt && r.synced === false,
      )) {
        await addEvent("genealogia", g.uuid, g);

        console.log({
          animal: await db.animais.get(g.animalId),
          matriz: await db.animais.get(g.matrizId?.toString() ?? ""),
        });
      }
    }
  } catch (err: any) {
    result.errors.push(`genealogias: ${err?.message || err}`);
  }

  // ===============================
  // CONFINAMENTOS
  // ===============================
  try {
    const confinamentos = await db.confinamentos.toArray();
    for (const c of confinamentos.filter((r: any) => r.synced === false)) {
      await addEvent("confinamento", c.id, c);
    }
  } catch (err: any) {
    result.errors.push(`confinamentos: ${err?.message || err}`);
  }

  // ===============================
  // CONFINAMENTO x ANIMAIS
  // ===============================
  try {
    const vinculos = await db.confinamentoAnimais.toArray();
    for (const v of vinculos.filter(
      (r: any) => r.deletedAt == null && r.synced === false,
    )) {
      await addEvent("confinamentoAnimal", v.id, v);
    }
  } catch (err: any) {
    result.errors.push(`confinamentoAnimais: ${err?.message || err}`);
  }

  // ===============================
  // OCORRÊNCIAS
  // ===============================
  try {
    if (db.ocorrenciaAnimais) {
      const ocorrencias = await db.ocorrenciaAnimais.toArray();
      for (const o of ocorrencias.filter(
        (r: any) => r.deletedAt == null && r.synced === false,
      )) {
        await addEvent("ocorrenciaAnimal", o.id, o);
      }
    }
  } catch (err: any) {
    result.errors.push(`ocorrenciaAnimais: ${err?.message || err}`);
  }

  // ===============================
  // ALIMENTAÇÃO
  // ===============================
  try {
    const alimentacao = await db.confinamentoAlimentacao.toArray();
    for (const a of alimentacao.filter(
      (r: any) => r.deletedAt == null && r.synced === false,
    )) {
      await addEvent("confinamentoAlimentacao", a.id, a);
    }
  } catch (err: any) {
    result.errors.push(`confinamentoAlimentacao: ${err?.message || err}`);
  }

  return result;
}

/**
 * Limpa eventos sincronizados antigos (mais de 7 dias)
 */
export async function cleanupOldSyncEvents(): Promise<number> {
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

  const eventosAntigos = await db.syncEvents
    .where("synced")
    .equals(true as never)
    .and((e) => new Date(e.updatedAt) < seteDiasAtras)
    .toArray();

  const ids = eventosAntigos.map((e) => e.id);
  await db.syncEvents.bulkDelete(ids);

  return ids.length;
}
