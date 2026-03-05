import type { SupabaseClient } from "@supabase/supabase-js";
import type { Table, IndexableType } from "dexie";
import { db } from "../db/dexieDB";
import type {
  Fazenda,
  Usuario,
  Categoria,
  Raca,
  Desmama,
  Pesagem,
  Vacina,
  AuditLog,
  Confinamento,
  ConfinamentoAnimal,
  ConfinamentoAlimentacao,
  OcorrenciaAnimal,
  NotificacaoLida,
  TipoAnimal,
  StatusAnimal,
  Origem,
  RolePermission,
  Animal,
  Genealogia,
  UserRole,
  PermissionType,
  OcorrenciaTipo,
} from "../db/models";
import { supabase } from "./supabaseClient";
import { getSupabaseForSync } from "./supabaseSyncClient";
import {
  processSyncQueue,
  createSyncEventsForPendingRecords,
} from "../utils/syncEvents";
import { debug as logDebug, warn as logWarn, critical as logCritical } from "../utils/logger";
import {
  clearLastPulledAt,
  getLastPulledAt,
  setLastPulledAt,
} from "../utils/syncCheckpoints";
import { setGlobalSyncing } from "../utils/syncState";
import { showToast } from "../utils/toast";
import {
  pullEntity,
  pullEntitySimple,
  fetchAllPaginated,
  fetchFromSupabase,
} from "./syncEngine";

/** Linha genérica retornada do Supabase (evita any). */
type ServerRow = Record<string, unknown>;

function getErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err)
    return (err as { code?: string }).code;
  return undefined;
}
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ========================================
// SISTEMA DE PROGRESSO DE SINCRONIZAÇÃO
// ========================================

export interface SyncProgress {
  step: string;
  current: number;
  total: number;
  message: string;
  timestamp: number;
}

export interface SyncStats {
  startTime: number;
  endTime?: number;
  duration?: number;
  steps: {
    [key: string]: {
      startTime: number;
      endTime?: number;
      duration?: number;
      recordsProcessed: number;
    };
  };
}

let currentSyncStats: SyncStats | null = null;

/**
 * Emite um evento de progresso de sincronização
 */
function emitSyncProgress(
  step: string,
  current: number,
  total: number,
  message: string,
) {
  if (typeof window !== "undefined") {
    const progress: SyncProgress = {
      step,
      current,
      total,
      message,
      timestamp: Date.now(),
    };
    window.dispatchEvent(new CustomEvent("syncProgress", { detail: progress }));
    logDebug(`🔄 [${current}/${total}] ${message}`);
  }
}

/**
 * Inicia medição de uma etapa de sincronização
 */
function startSyncStep(stepName: string) {
  if (!currentSyncStats) {
    currentSyncStats = {
      startTime: Date.now(),
      steps: {},
    };
  }
  currentSyncStats.steps[stepName] = {
    startTime: Date.now(),
    recordsProcessed: 0,
  };
}

/**
 * Finaliza medição de uma etapa de sincronização
 */
function endSyncStep(stepName: string, recordsProcessed: number = 0) {
  if (currentSyncStats && currentSyncStats.steps[stepName]) {
    const step = currentSyncStats.steps[stepName];
    step.endTime = Date.now();
    step.duration = step.endTime - step.startTime;
    step.recordsProcessed = recordsProcessed;
    logDebug(
      `✅ ${stepName}: ${recordsProcessed} registros em ${(step.duration / 1000).toFixed(2)}s`,
    );
  }
}

/**
 * Retorna as estatísticas da sincronização atual
 */
export function getCurrentSyncStats(): SyncStats | null {
  return currentSyncStats;
}

/**
 * Função helper para buscar todos os registros de uma tabela do Supabase com paginação.
 * O Supabase PostgREST limita a 1000 registros por padrão.
 * @param client - Se passado, usa este client (JWT) para evitar PGRST301.
 */
async function fetchAllFromSupabase(
  tableName: string,
  orderBy: string = "id",
  client?: SupabaseClient,
): Promise<ServerRow[]> {
  const sb = client ?? supabase;
  let allRecords: ServerRow[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: page, error } = await sb
      .from(tableName)
      .select("*")
      .range(from, from + pageSize - 1)
      .order(orderBy, { ascending: true });

    if (error) {
      logCritical(`Erro ao buscar ${tableName} do servidor:`, error);
      break;
    }

    if (page && page.length > 0) {
      allRecords = allRecords.concat(page as ServerRow[]);
      hasMore = page.length === pageSize;
      from += pageSize;
    } else {
      hasMore = false;
    }
  }

  // Log removido para reduzir verbosidade (esta função é chamada múltiplas vezes durante sync)
  // if (allRecords.length > 0) {
  //   logDebug(`✅ Total de ${tableName} buscados: ${allRecords.length}`);
  // }

  return allRecords;
}

export async function pushPending(syncClient?: SupabaseClient) {
  // Processar fila de eventos de sincronização primeiro (se houver)
  try {
    const queueResults = await processSyncQueue();
    if (queueResults.processados > 0) {
      logDebug(
        `📦 Fila de eventos: ${queueResults.sucesso} sucesso, ${queueResults.falhas} falhas`,
      );
    }
  } catch (err) {
    logCritical("Erro ao processar fila de eventos:", err);
  }

  //#region Sincronizar exclusões pendentes primeiro
  try {
    if (db.deletedRecords) {
      const client = syncClient ?? (await getSupabaseForSync()) ?? supabase;
      const todasExclusoes = await db.deletedRecords.toArray();
      const deletedRecords = todasExclusoes.filter((d) => d.synced === false);
      const entityTableMap: Record<
        "animal" | "pesagem" | "vacina",
        string
      > = {
        animal: "animais_online",
        pesagem: "pesagens_online",
        vacina: "vacinacoes_online",
      };

      for (const deleted of deletedRecords) {
        try {
          if (deleted.remoteId != null) {
            let sucesso = false;
            let ultimoErro: unknown = null;
            const entity = deleted.entity;

            // Animal: apenas soft delete em animais_online
            if (entity === "animal" || (!entity && (await db.animais.get(deleted.uuid))?.deletedAt)) {
              const animal = await db.animais.get(deleted.uuid);
              if (animal?.deletedAt && animal.remoteId != null) {
                const now = new Date().toISOString();
                const { error: updateError } = await client
                  .from("animais_online")
                  .update({
                    deleted_at: animal.deletedAt,
                    updated_at: now,
                  })
                  .eq("id", animal.remoteId);

                if (!updateError) {
                  sucesso = true;
                  logDebug(
                    `✅ Soft delete aplicado para animal ${deleted.uuid}`,
                  );
                } else {
                  ultimoErro = updateError;
                  logCritical("Erro ao fazer soft delete de animal:", updateError);
                }
              }
            }

            // Pesagem ou vacina: apenas DELETE na tabela correspondente
            if (!sucesso && entity && entityTableMap[entity]) {
              const tabela = entityTableMap[entity];
              const { error } = await client
                .from(tabela)
                .delete()
                .eq("id", deleted.remoteId);
              if (!error) {
                sucesso = true;
                logDebug(`✅ Exclusão sincronizada: ${entity} ${deleted.uuid}`);
              } else {
                ultimoErro = error;
                logCritical(`Erro ao excluir ${entity} no servidor:`, error);
              }
            }

            // Registros antigos sem entity: fallback (tentar tabelas na ordem)
            if (!sucesso && !entity) {
              const tabelas = [
                "vacinacoes_online",
                "pesagens_online",
                "nascimentos_online",
                "animais_online",
              ] as const;
              for (const tabela of tabelas) {
                const { error } = await client
                  .from(tabela)
                  .delete()
                  .eq("id", deleted.remoteId);
                if (!error) {
                  sucesso = true;
                  break;
                }
                if (
                  error.code !== "PGRST116" &&
                  !error.message?.includes("No rows") &&
                  !error.message?.includes("not found")
                ) {
                  ultimoErro = error;
                }
              }
            }

            if (sucesso) {
              await db.deletedRecords.update(deleted.id, { synced: true });
            } else if (ultimoErro) {
              logCritical(
                "Erro ao sincronizar exclusão no servidor:",
                ultimoErro,
                deleted.uuid,
              );
            }
            continue;
          }
          await db.deletedRecords.update(deleted.id, { synced: true });
        } catch (err) {
          logCritical(
            "Erro ao processar exclusão pendente:",
            err,
            deleted.uuid,
          );
        }
      }
    }
  } catch (err) {
    logCritical("Erro geral ao sincronizar exclusões:", err);
  }
  //#endregion Exclusões
}

export async function pullUpdates(syncClient: SupabaseClient) {
  logDebug("📥 Iniciando pull de atualizações do servidor...");
  const totalSteps = 11; // Fazendas, Usuários, Categorias, Raças, Animais, Confinamento x4, Notificações lidas, Auditoria
  let currentStep = 0;

  //#region Buscar fazendas (motor genérico) — forceFullPull: tabela pequena
  try {
    currentStep++;
    startSyncStep("Pull Fazendas");
    emitSyncProgress(
      "pull",
      currentStep,
      totalSteps,
      "Sincronizando Fazendas...",
    );
    const n = await pullEntity(
      {
        remoteTable: "fazendas_online",
        orderBy: "updated_at",
        updatedAtField: "updated_at",
        localTable: db.fazendas as Table<Fazenda, IndexableType>,
        mapper: (s: ServerRow): Fazenda => ({
          id: String(s.uuid ?? ""),
          nome: String(s.nome ?? ""),
          logoUrl: s.logo_url as string | undefined,
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
        }),
        forceFullPull: true,
      },
      syncClient,
    );
    endSyncStep("Pull Fazendas", n);
  } catch (err) {
    logCritical("Erro ao processar pull de fazendas:", err);
    endSyncStep("Pull Fazendas", 0);
  }
  //#endregion Fazendas

  //#region Buscar usuários (motor genérico: incremental + batch)
  try {
    currentStep++;
    startSyncStep("Pull Usuários");
    emitSyncProgress(
      "pull",
      currentStep,
      totalSteps,
      "Sincronizando Usuários...",
    );
    const nUsuarios = await pullEntity(
      {
        remoteTable: "usuarios_online",
        orderBy: "updated_at",
        updatedAtField: "updated_at",
        localTable: db.usuarios as Table<Usuario, IndexableType>,
        mapper: (s: ServerRow): Usuario => ({
          id: String(s.uuid ?? ""),
          nome: String(s.nome ?? ""),
          email: String(s.email ?? ""),
          senhaHash: String(s.senha_hash ?? ""),
          role: (s.role as Usuario["role"]) ?? "visitante",
          fazendaId: s.fazenda_uuid != null ? String(s.fazenda_uuid) : undefined,
          ativo: Boolean(s.ativo),
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
        }),
      },
      syncClient,
    );
    endSyncStep("Pull Usuários", nUsuarios);
  } catch (err) {
    logCritical("Erro ao processar pull de usuários:", err);
    endSyncStep("Pull Usuários", 0);
    throw err;
  }
  //#endregion Usuários

  //#region Buscar categorias (motor genérico) — forceFullPull: tabela pequena
  try {
    currentStep++;
    startSyncStep("Pull Categorias");
    emitSyncProgress(
      "pull",
      currentStep,
      totalSteps,
      "Sincronizando Categorias...",
    );
    const n = await pullEntity(
      {
        remoteTable: "categorias_online",
        orderBy: "updated_at",
        updatedAtField: "updated_at",
        localTable: db.categorias as Table<Categoria, IndexableType>,
        mapper: (s: ServerRow): Categoria => ({
          id: String(s.uuid ?? ""),
          nome: String(s.nome ?? ""),
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
        }),
        forceFullPull: true,
      },
      syncClient,
    );
    endSyncStep("Pull Categorias", n);
  } catch (err) {
    logCritical("Erro ao processar pull de categorias:", err);
    endSyncStep("Pull Categorias", 0);
  }
  //#endregion Categorias

  //#region Buscar raças (motor genérico) — forceFullPull: tabela pequena, evita perder registros por checkpoint incremental
  try {
    currentStep++;
    startSyncStep("Pull Raças");
    emitSyncProgress("pull", currentStep, totalSteps, "Sincronizando Raças...");
    const n = await pullEntity(
      {
        remoteTable: "racas_online",
        orderBy: "updated_at",
        updatedAtField: "updated_at",
        localTable: db.racas as Table<Raca, IndexableType>,
        mapper: (s: ServerRow): Raca => ({
          id: String(s.uuid ?? ""),
          nome: String(s.nome ?? ""),
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
        }),
        forceFullPull: true,
      },
      syncClient,
    );
    endSyncStep("Pull Raças", n);
  } catch (err) {
    logCritical("Erro ao processar pull de raças:", err);
    endSyncStep("Pull Raças", 0);
  }
  //#endregion Raças

  //#region Pull tipos, status e origens (motor genérico - bulkPut)
  try {
    await pullEntitySimple(
      "tipos_animal_online",
      db.tiposAnimal as Table<TipoAnimal, IndexableType>,
      (s: ServerRow): TipoAnimal => ({
        id: String(s.uuid ?? ""),
        nome: String(s.nome ?? ""),
        descricao: s.descricao as string | undefined,
        ordem: s.ordem as number | undefined,
        ativo: Boolean(s.ativo),
        createdAt: String(s.created_at ?? ""),
        updatedAt: String(s.updated_at ?? ""),
        deletedAt: s.deleted_at as string | null | undefined,
        synced: true,
        remoteId: s.id as number | null,
      }),
      {},
      syncClient,
    );
  } catch (err) {
    logCritical("Erro ao fazer pull de tipos de animal:", err);
  }
  try {
    await pullEntitySimple(
      "status_animal_online",
      db.statusAnimal as Table<StatusAnimal, IndexableType>,
      (s: ServerRow): StatusAnimal => ({
        id: String(s.uuid ?? ""),
        nome: String(s.nome ?? ""),
        cor: s.cor as string | undefined,
        descricao: s.descricao as string | undefined,
        ordem: s.ordem as number | undefined,
        ativo: Boolean(s.ativo),
        createdAt: String(s.created_at ?? ""),
        updatedAt: String(s.updated_at ?? ""),
        deletedAt: s.deleted_at as string | null | undefined,
        synced: true,
        remoteId: s.id as number | null,
      }),
      {},
      syncClient,
    );
  } catch (err) {
    logCritical("Erro ao fazer pull de status de animal:", err);
  }
  try {
    await pullEntitySimple(
      "origens_online",
      db.origens as Table<Origem, IndexableType>,
      (s: ServerRow): Origem => ({
        id: String(s.uuid ?? ""),
        nome: String(s.nome ?? ""),
        descricao: s.descricao as string | undefined,
        ordem: s.ordem as number | undefined,
        ativo: Boolean(s.ativo),
        createdAt: String(s.created_at ?? ""),
        updatedAt: String(s.updated_at ?? ""),
        deletedAt: s.deleted_at as string | null | undefined,
        synced: true,
        remoteId: s.id as number | null,
      }),
      {},
      syncClient,
    );
  } catch (err) {
    logCritical("Erro ao fazer pull de origens:", err);
  }
  //#endregion

  //#region Buscar tags (incluir deletadas para sincronizar soft deletes)
  try {
    const { data: servTags, error: errorTags } = await syncClient
      .from("tags")
      .select("*"); // Remover filtro de deleted_at para sincronizar exclusões

    if (errorTags) {
      if (
        errorTags.code === "PGRST205" ||
        errorTags.code === "42P01" ||
        errorTags.message?.includes("Could not find")
      ) {
        logWarn(
          "Tabela tags não existe no servidor. Execute a migração 022_add_tags_system.sql no Supabase.",
        );
      } else {
        logCritical("Erro ao buscar tags do servidor:", errorTags);
      }
    } else if (servTags && servTags.length > 0) {
      for (const s of servTags) {
        if (!s.id) continue;

        const local = await db.tags.get(s.id);
        if (!local) {
          await db.tags.put({
            id: s.id,
            name: s.name,
            color: s.color,
            description: s.description,
            category: s.category,
            createdBy: s.created_by,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            deletedAt: s.deleted_at,
            usageCount: s.usage_count || 0,
            synced: true,
            remoteId: s.id,
          });
        } else if (new Date(local.updatedAt) < new Date(s.updated_at)) {
          await db.tags.update(s.id, {
            name: s.name,
            color: s.color,
            description: s.description,
            category: s.category,
            updatedAt: s.updated_at,
            deletedAt: s.deleted_at, // Sincronizar soft delete
            usageCount: s.usage_count || 0,
            synced: true,
          });
        }
      }
    }

    // Buscar atribuições de tags (incluir deletadas para sincronizar soft deletes)
    const { data: servAssignments, error: errorAssignments } = await syncClient
      .from("tag_assignments")
      .select("*"); // Remover filtro de deleted_at para sincronizar exclusões

    if (errorAssignments) {
      if (
        errorAssignments.code !== "PGRST205" &&
        errorAssignments.code !== "42P01"
      ) {
        logCritical("Erro ao buscar atribuições de tags:", errorAssignments);
      }
    } else if (servAssignments && servAssignments.length > 0) {
      for (const s of servAssignments) {
        if (!s.id) continue;

        const local = await db.tagAssignments.get(s.id);
        if (!local) {
          await db.tagAssignments.put({
            id: s.id,
            entityId: s.entity_id,
            entityType: s.entity_type,
            tagId: s.tag_id,
            assignedBy: s.assigned_by,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            deletedAt: s.deleted_at,
            synced: true,
            remoteId: s.id,
          });
        } else if (new Date(local.updatedAt) < new Date(s.updated_at)) {
          await db.tagAssignments.update(s.id, {
            updatedAt: s.updated_at,
            deletedAt: s.deleted_at,
            synced: true,
          });
        }
      }
    }
  } catch (err: unknown) {
    const code = getErrorCode(err);
    if (code !== "PGRST205" && code !== "42P01") {
      logCritical("Erro ao processar tags:", err);
    }
  }
  //#endregion Tags

  //#region Pull de permissões: merge por (role, permission) — não deleta locais, evita "reset" ao sincronizar
  try {
    const lastPulled = getLastPulledAt("role_permissions_online");
    const servRecords = await fetchFromSupabase<ServerRow>(
      "role_permissions_online",
      {
        orderBy: "updated_at",
        updatedAtField: "updated_at",
        lastPulledAt: lastPulled || undefined,
      },
      syncClient,
    );
    if (servRecords && servRecords.length > 0) {
      const localRecords = await db.rolePermissions.toArray();
      const localByRolePerm = new Map(
        localRecords.map((r: RolePermission) => [`${r.role}\0${r.permission}`, r]),
      );
      const toPut: RolePermission[] = [];
      const toUpdate: Array<{ key: string; changes: Partial<RolePermission> }> = [];
      for (const s of servRecords) {
        const uuid = s.uuid;
        if (!uuid) continue;
        const key = `${String(s.role)}\0${String(s.permission)}`;
        const local = localByRolePerm.get(key);
        const payload: Partial<RolePermission> = {
          role: (s.role as UserRole) ?? "visitante",
          permission: s.permission as PermissionType,
          granted: Boolean(s.granted),
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
        };
        if (local) {
          toUpdate.push({ key: local.id, changes: payload });
        } else {
          toPut.push({ id: String(uuid), ...payload } as RolePermission);
        }
      }
      if (toPut.length > 0) await db.rolePermissions.bulkPut(toPut);
      if (toUpdate.length > 0) await db.rolePermissions.bulkUpdate(toUpdate);
      const maxUpdated = servRecords.reduce(
        (max: string | null, r: ServerRow) =>
          r.updated_at && (!max || String(r.updated_at) > max)
            ? String(r.updated_at)
            : max,
        null,
      );
      if (maxUpdated) setLastPulledAt("role_permissions_online", maxUpdated);
    } else {
      setLastPulledAt("role_permissions_online", new Date().toISOString());
    }
  } catch (err) {
    logCritical("Erro ao processar pull de permissões:", err);
    // Não lançar erro - permissões não são críticas para funcionamento básico
  }
  //#endregion Permissões

  //#region Buscar configurações de alerta
  try {
    if (db.alertSettings) {
      const { data: servSettings, error: errorSettings } = await syncClient
        .from("alert_settings_online")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (errorSettings) {
        logCritical("Erro ao buscar configurações de alerta do servidor:", {
          error: errorSettings,
          message: errorSettings.message,
          code: errorSettings.code,
        });
        // Se a tabela não existe, pode ser que a migration não foi executada
        if (
          errorSettings.code === "42P01" ||
          errorSettings.message?.includes("does not exist")
        ) {
          logWarn(
            "Tabela alert_settings_online não existe. Execute a migration 019_add_alert_settings_online.sql no Supabase.",
          );
        }
      } else if (servSettings && servSettings.length > 0) {
        const s = servSettings[0];
        const local = await db.alertSettings.get("alert-settings-global");

        if (!local) {
          // Criar local se não existir - usar put para evitar erro de chave duplicada
          try {
            await db.alertSettings.put({
              id: "alert-settings-global",
              limiteMesesDesmama: s.limite_meses_desmama,
              janelaMesesMortalidade: s.janela_meses_mortalidade,
              limiarMortalidade: s.limiar_mortalidade,
              createdAt: s.created_at,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id,
            });
          } catch (putError: unknown) {
            const name =
              putError &&
              typeof putError === "object" &&
              "name" in putError
                ? (putError as { name: string }).name
                : "";
            if (name === "ConstraintError") {
              await db.alertSettings.update("alert-settings-global", {
                limiteMesesDesmama: s.limite_meses_desmama,
                janelaMesesMortalidade: s.janela_meses_mortalidade,
                limiarMortalidade: s.limiar_mortalidade,
                updatedAt: s.updated_at,
                synced: true,
                remoteId: s.id,
              });
            } else {
              throw putError;
            }
          }

          // Atualizar localStorage e disparar evento
          if (typeof window !== "undefined") {
            const settings = {
              limiteMesesDesmama: s.limite_meses_desmama,
              janelaMesesMortalidade: s.janela_meses_mortalidade,
              limiarMortalidade: s.limiar_mortalidade,
            };
            window.localStorage.setItem(
              "alertSettings",
              JSON.stringify(settings),
            );
            window.dispatchEvent(
              new CustomEvent("alertSettingsUpdated", { detail: settings }),
            );
          }
        } else {
          // Verificar se os valores são diferentes (comparação mais confiável que timestamp)
          // IMPORTANTE: Converter para número para evitar problemas de tipo (string vs number)
          const limiteDiferente =
            Number(local.limiteMesesDesmama) !== Number(s.limite_meses_desmama);
          const janelaDiferente =
            Number(local.janelaMesesMortalidade) !==
            Number(s.janela_meses_mortalidade);
          const limiarDiferente =
            Number(local.limiarMortalidade) !== Number(s.limiar_mortalidade);
          const valoresDiferentes =
            limiteDiferente || janelaDiferente || limiarDiferente;

          const servUpdated = new Date(s.updated_at).getTime();
          const localUpdated = local.updatedAt
            ? new Date(local.updatedAt).getTime()
            : 0;

          // SEMPRE atualizar se valores são diferentes (comparação mais confiável)
          // Também atualizar se servidor é mais recente (com margem de 1 segundo para evitar problemas de precisão)
          // OU se não está sincronizado OU se remoteId mudou
          const margemTimestamp = 1000; // 1 segundo de margem
          const deveAtualizar =
            valoresDiferentes ||
            servUpdated > localUpdated + margemTimestamp ||
            !local.synced ||
            local.remoteId !== s.id;

          if (deveAtualizar) {
            await db.alertSettings.update("alert-settings-global", {
              limiteMesesDesmama: s.limite_meses_desmama,
              janelaMesesMortalidade: s.janela_meses_mortalidade,
              limiarMortalidade: s.limiar_mortalidade,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id,
            });

            // Sempre atualizar localStorage e disparar evento quando puxar do servidor
            if (typeof window !== "undefined") {
              const settings = {
                limiteMesesDesmama: s.limite_meses_desmama,
                janelaMesesMortalidade: s.janela_meses_mortalidade,
                limiarMortalidade: s.limiar_mortalidade,
              };
              window.localStorage.setItem(
                "alertSettings",
                JSON.stringify(settings),
              );
              window.dispatchEvent(
                new CustomEvent("alertSettingsUpdated", { detail: settings }),
              );
            }
          } else if (local.synced && local.remoteId !== s.id) {
            // Atualizar apenas remoteId se mudou
            await db.alertSettings.update("alert-settings-global", {
              remoteId: s.id,
            });
          }
        }
      }
    }
  } catch (err) {
    logCritical("Erro ao processar pull de configurações de alerta:", err);
    // Não lançar erro - configurações não são críticas para funcionamento
  }
  //#endregion Configurações de alerta

  //#region Buscar configurações do app
  try {
    if (db.appSettings) {
      const { data: servSettings, error: errorSettings } = await syncClient
        .from("app_settings_online")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (errorSettings) {
        logCritical("Erro ao buscar configurações do app do servidor:", {
          error: errorSettings,
          message: errorSettings.message,
          code: errorSettings.code,
          details: errorSettings.details,
          hint: errorSettings.hint,
        });
      } else if (servSettings && servSettings.length > 0) {
        const s = servSettings[0];
        const local = await db.appSettings.get("app-settings-global");

        if (!local) {
          // Criar local se não existir
          // Usar put ao invés de add para evitar erro de chave duplicada
          try {
            await db.appSettings.put({
              id: "app-settings-global",
              timeoutInatividade: s.timeout_inatividade,
              intervaloSincronizacao: s.intervalo_sincronizacao ?? 30,
              primaryColor: s.primary_color || "gray",
              createdAt: s.created_at,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id,
            });
          } catch (putError: unknown) {
            const name =
              putError &&
              typeof putError === "object" &&
              "name" in putError
                ? (putError as { name: string }).name
                : "";
            if (name === "ConstraintError") {
              await db.appSettings.update("app-settings-global", {
                timeoutInatividade: s.timeout_inatividade,
                intervaloSincronizacao: s.intervalo_sincronizacao ?? 30,
                primaryColor: s.primary_color || "gray",
                updatedAt: s.updated_at,
                synced: true,
                remoteId: s.id,
              });
            } else {
              throw putError;
            }
          }

          // Disparar evento para atualizar o hook
          if (typeof window !== "undefined") {
            const settings = {
              timeoutInatividade: s.timeout_inatividade,
              intervaloSincronizacao: s.intervalo_sincronizacao ?? 30,
              primaryColor: s.primary_color || "gray",
            };
            window.dispatchEvent(
              new CustomEvent("appSettingsUpdated", { detail: settings }),
            );
          }
        } else {
          // Verificar se os valores são diferentes
          const timeoutDiferente =
            Number(local.timeoutInatividade) !== Number(s.timeout_inatividade);
          const intervaloSincronizacaoDiferente =
            Number(local.intervaloSincronizacao ?? 30) !==
            Number(s.intervalo_sincronizacao ?? 30);
          const primaryColorDiferente =
            (local.primaryColor || "gray") !== (s.primary_color || "gray");

          const servUpdated = new Date(s.updated_at).getTime();
          const localUpdated = local.updatedAt
            ? new Date(local.updatedAt).getTime()
            : 0;

          // SEMPRE atualizar se valores são diferentes
          // Também atualizar se servidor é mais recente (com margem de 1 segundo)
          // OU se não está sincronizado OU se remoteId mudou
          const margemTimestamp = 1000; // 1 segundo de margem
          const deveAtualizar =
            timeoutDiferente ||
            intervaloSincronizacaoDiferente ||
            primaryColorDiferente ||
            servUpdated > localUpdated + margemTimestamp ||
            !local.synced ||
            local.remoteId !== s.id;

          if (deveAtualizar) {
            await db.appSettings.update("app-settings-global", {
              timeoutInatividade: s.timeout_inatividade,
              intervaloSincronizacao: s.intervalo_sincronizacao ?? 30,
              primaryColor: s.primary_color || "gray",
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id,
            });

            // Disparar evento para atualizar o hook
            if (typeof window !== "undefined") {
              const settings = {
                timeoutInatividade: s.timeout_inatividade,
                intervaloSincronizacao: s.intervalo_sincronizacao ?? 30,
                primaryColor: s.primary_color || "gray",
              };
              window.dispatchEvent(
                new CustomEvent("appSettingsUpdated", { detail: settings }),
              );
            }
          } else if (local.synced && local.remoteId !== s.id) {
            // Atualizar apenas remoteId se mudou
            await db.appSettings.update("app-settings-global", {
              remoteId: s.id,
            });
          }
        }
      }
    }
  } catch (err) {
    logCritical("Erro ao processar pull de configurações do app:", err);
    // Não lançar erro - configurações não são críticas para funcionamento
  }
  //#endregion Configurações do app

  //#region  Pull animais
  try {
    currentStep++;
    startSyncStep("Pull Animais");
    emitSyncProgress(
      "pull",
      currentStep,
      totalSteps,
      "Sincronizando Animais...",
    );

    // Buscar animais com paginação + incremental
    const lastPulledAnimais = getLastPulledAt("animais_online");
    let servAnimais = await fetchAllPaginated<ServerRow>(
      "animais_online",
      {
        orderBy: "id",
        updatedAtField: lastPulledAnimais ? "updated_at" : undefined,
        lastPulledAt: lastPulledAnimais || undefined,
      },
      syncClient,
    );

    // Inclusão de exclusões antigas: animais com deleted_at preenchido e deleted_at > lastPulled
    // (exclusões feitas antes do fix que não atualizavam updated_at no servidor)
    if (lastPulledAnimais && servAnimais) {
      const uuidsJaIncluidos = new Set(
        servAnimais.map((a: ServerRow) => a.uuid).filter(Boolean) as string[],
      );
      const { data: deletadosRecentes } = await syncClient
        .from("animais_online")
        .select("*")
        .not("deleted_at", "is", null)
        .gt("deleted_at", lastPulledAnimais);
      if (deletadosRecentes?.length) {
        const novos = (deletadosRecentes as ServerRow[]).filter(
          (a) => a.uuid && !uuidsJaIncluidos.has(String(a.uuid)),
        );
        if (novos.length) servAnimais = [...servAnimais, ...novos];
      }
    }

    if (servAnimais && servAnimais.length > 0) {
      // 🚀 OTIMIZAÇÃO: Carregar todos locais em memória (evita 1857× get individuais)
      const [
        tiposLocais,
        statusLocais,
        origensLocais,
        fazendasLocais,
        racasLocais,
        animaisLocais,
      ] = await Promise.all([
        db.tiposAnimal.toArray(),
        db.statusAnimal.toArray(),
        db.origens.toArray(),
        db.fazendas.toArray(),
        db.racas.toArray(),
        db.animais.toArray(),
      ]);
      const tiposMap = new Map(tiposLocais.map((t) => [t.remoteId, t]));
      const statusMap = new Map(statusLocais.map((st) => [st.remoteId, st]));
      const origensMap = new Map(origensLocais.map((o) => [o.remoteId, o]));
      const fazendasMap = new Map(fazendasLocais.map((f) => [f.remoteId, f]));
      const racasMap = new Map(racasLocais.map((r) => [r.remoteId, r]));
      const animaisLocaisMap = new Map(animaisLocais.map((a) => [a.id, a]));

      // Buscar racas ausentes em batch (evita await no loop)
      const racasIdsAusentes = [
        ...new Set(
          servAnimais
            .map((s: ServerRow) => s.raca_id)
            .filter((id): id is number => id != null),
        ),
      ].filter((id: number) => !racasMap.has(id));
      if (racasIdsAusentes.length > 0) {
        try {
          const { data: racasSupabase } = await syncClient
            .from("racas_online")
            .select("*")
            .in("id", racasIdsAusentes);
          if (racasSupabase) {
            const toPutRacas = (racasSupabase as ServerRow[]).map((r) => ({
              id: String(r.uuid ?? ""),
              nome: String(r.nome ?? ""),
              createdAt: String(r.created_at ?? ""),
              updatedAt: String(r.updated_at ?? ""),
              synced: true,
              remoteId: r.id as number,
            }));
            await db.racas.bulkPut(toPutRacas);
            toPutRacas.forEach((r) => racasMap.set(r.remoteId!, r));
          }
        } catch {
          /* ignora */
        }
      }

      const margemTimestamp = 1000;
      const toPut: Animal[] = [];
      for (const s of servAnimais) {
        const uuid = s.uuid as string | undefined;
        const animalLocal = uuid ? animaisLocaisMap.get(uuid) : undefined;
        if (animalLocal && animalLocal.deletedAt && !animalLocal.synced)
          continue;
        if (animalLocal && !animalLocal.synced) {
          const servUpdated = s.updated_at
            ? new Date(s.updated_at as string).getTime()
            : 0;
          const localUpdated = animalLocal.updatedAt
            ? new Date(animalLocal.updatedAt).getTime()
            : 0;
          if (localUpdated >= servUpdated - margemTimestamp) continue;
        }
        const tipoLocal = tiposMap.get(s.tipo_id as number);
        const statusLocal = statusMap.get(s.status_id as number);
        const origemLocal = origensMap.get(s.origem_id as number);
        const fazendaLocal = fazendasMap.get(s.fazenda_id as number);
        const racaLocal = s.raca_id
          ? racasMap.get(s.raca_id as number)
          : null;
        toPut.push({
          id: String(s.uuid ?? ""),
          brinco: String(s.brinco ?? ""),
          nome: (s.nome as string) ?? undefined,
          tipoId: tipoLocal?.id ?? "",
          racaId: racaLocal?.id,
          sexo: (s.sexo as "M" | "F") ?? "M",
          statusId: statusLocal?.id ?? "",
          dataNascimento: (s.data_nascimento as string) ?? undefined,
          dataCadastro: (s.data_cadastro as string) ?? undefined,
          dataEntrada: (s.data_entrada as string) ?? undefined,
          dataSaida: (s.data_saida as string) ?? undefined,
          origemId: origemLocal?.id ?? "",
          fazendaId: fazendaLocal?.id ?? "",
          fazendaOrigemId: s.fazenda_origem_id
            ? fazendasMap.get(s.fazenda_origem_id as number)?.id
            : undefined,
          proprietarioAnterior: (s.proprietario_anterior as string) ?? undefined,
          matrizId: (s.matriz_id as string) ?? undefined,
          reprodutorId: (s.reprodutor_id as string) ?? undefined,
          valorCompra: s.valor_compra as number | undefined,
          valorVenda: s.valor_venda as number | undefined,
          pelagem: (s.pelagem as string) ?? undefined,
          pesoAtual: s.peso_atual as number | undefined,
          lote: (s.lote as string) ?? undefined,
          categoria: (s.categoria as string) ?? undefined,
          obs: (s.obs as string) ?? undefined,
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          deletedAt: (s.deleted_at as string | null) ?? undefined,
          synced: true,
          remoteId: s.id as number,
        } as Animal);
      }
      // bulkPut em lotes de 300 (IndexedDB performa melhor com lotes moderados)
      const BATCH_ANIMAIS = 300;
      for (let i = 0; i < toPut.length; i += BATCH_ANIMAIS) {
        await db.animais.bulkPut(toPut.slice(i, i + BATCH_ANIMAIS));
      }
    }
    const maxUpdatedAnimais = servAnimais?.length
      ? servAnimais.reduce<string | null>(
          (max, a) => {
            const t = a.updated_at as string | undefined;
            return t && (!max || t > max) ? t : max;
          },
          null,
        )
      : null;
    if (maxUpdatedAnimais) setLastPulledAt("animais_online", maxUpdatedAnimais);
    endSyncStep("Pull Animais", servAnimais?.length || 0);
  } catch (err) {
    logCritical("Erro ao fazer pull de animais:", err);
    endSyncStep("Pull Animais", 0);
  }

  //#endregion Animais

  //#region Buscar desmamas (motor bulk - pullEntity)
  try {
    await pullEntity(
      {
        remoteTable: "desmamas_online",
        orderBy: "updated_at",
        updatedAtField: "updated_at",
        localTable: db.desmamas as Table<Desmama, IndexableType>,
        mapper: (s: ServerRow): Desmama => ({
          id: String(s.uuid ?? ""),
          animalId: String(s.animal_id ?? s.nascimento_uuid ?? ""),
          dataDesmama: (s.data_desmama as string) ?? undefined,
          pesoDesmama: s.peso_desmama as number | undefined,
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
        }),
        forceFullPull: true,
      },
      syncClient,
    );
  } catch (err) {
    logCritical("Erro ao processar pull de desmamas:", err);
    throw err;
  }
  //#endregion Desmamas

  //#region Buscar pesagens (motor bulk: toPut/toUpdate/bulkDelete)
  try {
    const servPesagens = await fetchAllFromSupabase(
      "pesagens_online",
      "id",
      syncClient,
    );
    if (servPesagens && servPesagens.length > 0) {
      const servUuids = new Set(
        servPesagens
          .map((p: ServerRow) => p.uuid)
          .filter((u): u is string => Boolean(u))
          .map(String),
      );
      const todasPesagensLocais = await db.pesagens.toArray();
      const localMap = new Map(todasPesagensLocais.map((p) => [p.id, p]));
      const deletedUuids = new Set<string>();
      if (db.deletedRecords) {
        const todasExclusoes = await db.deletedRecords.toArray();
        todasExclusoes.forEach((d) => deletedUuids.add(d.uuid));
      }
      const idsParaDeletar = todasPesagensLocais
        .filter((p) => p.remoteId != null && !servUuids.has(p.id))
        .map((p) => p.id);
      if (idsParaDeletar.length > 0)
        await db.pesagens.bulkDelete(idsParaDeletar);

      const margemTimestamp = 1000;
      const toPut: Pesagem[] = [];
      const toUpdate: Array<{ key: string; changes: Partial<Pesagem> }> = [];
      for (const s of servPesagens) {
        const suuid = s.uuid as string | undefined;
        if (!suuid || deletedUuids.has(suuid)) continue;
        const local = localMap.get(suuid);
        const mapped: Pesagem = {
          id: String(s.uuid),
          animalId: String(
            s.animal_id ?? s.nascimento_id ?? s.nascimento_uuid ?? "",
          ),
          dataPesagem: String(s.data_pesagem ?? ""),
          peso: Number(s.peso ?? 0),
          observacao: (s.observacao as string) || undefined,
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
        };
        if (!local) {
          toPut.push(mapped);
        } else {
          if (!local.synced) {
            const servUpdated = s.updated_at
              ? new Date(s.updated_at as string).getTime()
              : 0;
            const localUpdated = local.updatedAt
              ? new Date(local.updatedAt).getTime()
              : 0;
            if (localUpdated >= servUpdated - margemTimestamp) continue;
          }
          if (
            !local.remoteId ||
            new Date(local.updatedAt) < new Date(s.updated_at as string)
          ) {
            toUpdate.push({ key: suuid, changes: mapped });
          }
        }
      }
      if (toPut.length > 0) await db.pesagens.bulkPut(toPut);
      if (toUpdate.length > 0) await db.pesagens.bulkUpdate(toUpdate);
    }
  } catch (err) {
    logCritical("Erro ao processar pull de pesagens:", err);
    throw err;
  }
  //#endregion Pesagens

  //#region Buscar vacinações (motor bulk: toPut/toUpdate/bulkDelete)
  try {
    let servVacinacoes: ServerRow[] = [];
    try {
      servVacinacoes = await fetchAllFromSupabase(
        "vacinacoes_online",
        "id",
        syncClient,
      );
    } catch (errorVacinacoes: unknown) {
      const code = getErrorCode(errorVacinacoes);
      const msg = getErrorMessage(errorVacinacoes);
      if (
        code === "PGRST205" ||
        code === "42P01" ||
        msg.includes("Could not find the table")
      ) {
        logWarn(
          "Tabela vacinacoes_online não existe no servidor. Execute a migração 024_add_vacinacoes_online.sql no Supabase.",
        );
      } else {
        logCritical(
          "Erro ao buscar vacinações do servidor:",
          errorVacinacoes,
        );
      }
    }
    if (servVacinacoes && servVacinacoes.length > 0) {
      const servUuids = new Set(
        servVacinacoes
          .map((v: ServerRow) => v.uuid)
          .filter((u): u is string => Boolean(u))
          .map(String),
      );
      const todasVacinacoesLocais = await db.vacinacoes.toArray();
      const localMap = new Map(todasVacinacoesLocais.map((v) => [v.id, v]));
      const deletedUuids = new Set<string>();
      if (db.deletedRecords) {
        const todasExclusoes = await db.deletedRecords.toArray();
        todasExclusoes.forEach((d) => deletedUuids.add(d.uuid));
      }
      const idsParaDeletar = todasVacinacoesLocais
        .filter((v) => v.remoteId != null && !servUuids.has(v.id))
        .map((v) => v.id);
      if (idsParaDeletar.length > 0)
        await db.vacinacoes.bulkDelete(idsParaDeletar);

      const margemTimestamp = 1000;
      const toPut: Vacina[] = [];
      const toUpdate: Array<{ key: string; changes: Partial<Vacina> }> = [];
      for (const s of servVacinacoes) {
        const suuid = s.uuid as string | undefined;
        if (!suuid || deletedUuids.has(suuid)) continue;
        const local = localMap.get(suuid);
        const mapped: Vacina = {
          id: String(s.uuid),
          animalId: String(
            s.animal_id ?? s.nascimento_id ?? s.nascimento_uuid ?? "",
          ),
          vacina: String(s.vacina ?? ""),
          dataAplicacao: String(s.data_aplicacao ?? ""),
          dataVencimento: (s.data_vencimento as string) || undefined,
          lote: (s.lote as string) || undefined,
          responsavel: (s.responsavel as string) || undefined,
          observacao: (s.observacao as string) || undefined,
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
        };
        if (!local) {
          toPut.push(mapped);
        } else {
          if (!local.synced) {
            const servUpdated = s.updated_at
              ? new Date(s.updated_at as string).getTime()
              : 0;
            const localUpdated = local.updatedAt
              ? new Date(local.updatedAt).getTime()
              : 0;
            if (localUpdated >= servUpdated - margemTimestamp) continue;
          }
          if (
            !local.remoteId ||
            new Date(local.updatedAt) < new Date(s.updated_at as string)
          ) {
            toUpdate.push({ key: suuid, changes: mapped });
          }
        }
      }
      if (toPut.length > 0) await db.vacinacoes.bulkPut(toPut);
      if (toUpdate.length > 0) await db.vacinacoes.bulkUpdate(toUpdate);
    }
  } catch (err: unknown) {
    const code = getErrorCode(err);
    const msg = getErrorMessage(err);
    if (
      code === "PGRST205" ||
      code === "42P01" ||
      msg.includes("Could not find the table")
    ) {
      logWarn("Tabela vacinacoes_online não existe no servidor.");
    } else {
      logCritical("Erro ao processar pull de vacinações:", err);
    }
  }
  //#endregion Vacinações

  //#region Pull de auditoria (motor genérico: incremental + batch, limit 1000)
  try {
    if (db.audits) {
      await pullEntity(
        {
          remoteTable: "audits_online",
          orderBy: "timestamp",
          updatedAtField: "timestamp",
          updatedAtFieldLocal: "timestamp",
          localTable: db.audits as Table<AuditLog, IndexableType>,
          limit: 1000,
          mapper: (s: ServerRow): AuditLog => ({
            id: String(s.uuid ?? ""),
            entity: s.entity as AuditLog["entity"],
            entityId: String(s.entity_id ?? ""),
            action: s.action as AuditLog["action"],
            timestamp: String(s.timestamp ?? ""),
            userId: (s.user_uuid as string) || null,
            userNome: (s.user_nome as string) || null,
            before: s.before_json
              ? JSON.stringify(s.before_json)
              : null,
            after: s.after_json ? JSON.stringify(s.after_json) : null,
            description: (s.description as string) || null,
            synced: true,
            remoteId: s.id as number | null,
          }),
        },
        syncClient,
      );
    }
  } catch (err) {
    logCritical("Erro ao processar pull de auditoria:", err);
  }
  //#endregion Auditoria

  //#region  PULL GENEALOGIAS (robusto, idempotente, definitivo)

  try {
    const lastPulled = getLastPulledAt("genealogias_online");

    const servGenealogias = await fetchAllPaginated<ServerRow>(
      "genealogias_online",
      {
        orderBy: "id",
        updatedAtField: lastPulled ? "updated_at" : undefined,
        lastPulledAt: lastPulled || undefined,
      },
      syncClient,
    );

    // ==============================
    // MAPAS LOCAIS (dependências)
    // ==============================
    const animaisLocais = await db.animais.toArray();
    const animaisMap = new Map(animaisLocais.map((a) => [a.id, a]));

    const tiposLocais = await db.tiposAnimal.toArray();
    const tiposLocaisMap = new Map(tiposLocais.map((t) => [t.remoteId, t]));

    const genealogiasLocais = await db.genealogias.toArray();
    const genealogiasMap = new Map(genealogiasLocais.map((g) => [g.id, g]));

    const genealogiasParaInserir: Genealogia[] = [];

    // ==============================
    // PULL PRINCIPAL
    // ==============================
    if (servGenealogias?.length) {
      for (const s of servGenealogias) {
        const suuid = s.uuid as string | undefined;
        if (!suuid) continue;
        const local = genealogiasMap.get(suuid);

        // 🔒 Resolver dependências locais
        const animalLocal = animaisMap.get(s.animal_id as string);
        const matrizLocal = animaisMap.get(s.matriz_id as string);

        const reprodutorLocal = (s.reprodutor_id as string | undefined)
          ? animaisMap.get(s.reprodutor_id as string)
          : null;

        // ⛔ NÃO cria genealogia sem dependências
        if (!animalLocal || !matrizLocal) {
          logWarn(
            `⏸️ Genealogia ${s.uuid} ignorada (animal/matriz ausente localmente)`,
          );
          continue;
        }

        // =====================================
        // PROTEÇÃO: alteração local mais recente
        // =====================================
        if (local && !local.synced) {
          const servUpdated = s.updated_at
            ? new Date(s.updated_at as string).getTime()
            : 0;

          const localUpdated = local.updatedAt
            ? new Date(local.updatedAt).getTime()
            : 0;

          if (localUpdated >= servUpdated - 1000) {
            await db.genealogias.update(local.id, {
              synced: true,
              remoteId: s.id as number,
            });

            logDebug(`✅ Genealogia ${suuid} reconciliada`);
            continue;
          }
        }

        // =====================================
        // INSERÇÃO / ATUALIZAÇÃO
        // =====================================
        if (
          !local ||
          !local.remoteId ||
          (local.updatedAt &&
            new Date(local.updatedAt) < new Date(s.updated_at as string))
        ) {
          const tipoMatrizLocal = (s.tipo_matriz_id as number | undefined)
            ? tiposLocaisMap.get(s.tipo_matriz_id as number)
            : null;

          genealogiasParaInserir.push({
            id: suuid,
            animalId: animalLocal.id,
            matrizId: matrizLocal.id,
            reprodutorId: reprodutorLocal?.id,
            tipoMatrizId: tipoMatrizLocal?.id,
            avoMaterna: s.avo_materna as string | undefined,
            avoPaterna: s.avo_paterna as string | undefined,
            avoPaternoMaterno: s.avo_materno as string | undefined,
            avoPaternoPatro: s.avo_paterno as string | undefined,
            geracoes: Number(s.geracoes ?? 0),
            observacoes: s.observacoes as string | undefined,
            createdAt: String(s.created_at ?? ""),
            updatedAt: String(s.updated_at ?? ""),
            deletedAt: s.deleted_at as string | null | undefined,
            synced: true,
            remoteId: s.id as number | null,
          });
        }
      }
    }

    // ==============================
    // PERSISTIR DADOS DO SERVIDOR
    // ==============================
    if (genealogiasParaInserir.length > 0) {
      await db.genealogias.bulkPut(genealogiasParaInserir);
    }

    // ==============================
    // 🔧 RECONCILIAÇÃO FINAL (UUID)
    // ==============================
    const pendentes = await db.genealogias
      .filter((g) => g.synced === false && !g.deletedAt)
      .toArray();

    for (const g of pendentes) {
      const { data, error } = await syncClient
        .from("genealogias_online")
        .select("id, updated_at")
        .eq("uuid", g.id)
        .maybeSingle();

      if (error) {
        logCritical("Erro ao reconciliar genealogia:", g.id, error);
        continue;
      }

      if (data) {
        await db.genealogias.update(g.id, {
          synced: true,
          remoteId: data.id,
          updatedAt: data.updated_at,
        });

        logDebug(`✅ Genealogia ${g.id} reconciliada definitivamente`);
      }
    }

    // ==============================
    // CHECKPOINT
    // ==============================
    const maxUpdated = servGenealogias?.length
      ? servGenealogias.reduce<string | null>(
          (max, g) => {
            const t = g.updated_at as string | undefined;
            return t && (!max || t > max) ? t : max;
          },
          null,
        )
      : null;

    if (maxUpdated) {
      setLastPulledAt("genealogias_online", maxUpdated);
    }
  } catch (err) {
    logCritical("❌ Erro no pull de genealogias:", err);
  }
  //#endregion

  //#region pull confinamentos

  const fazendasLocais = await db.fazendas.toArray();
  const remoteIdToFazendaId = new Map(
    fazendasLocais
      .filter((f) => f.remoteId != null)
      .map((f) => [Number(f.remoteId), f.id]),
  );

  try {
    currentStep++;
    startSyncStep("Pull Confinamentos");
    emitSyncProgress(
      "pull",
      currentStep,
      totalSteps,
      "Sincronizando Confinamentos...",
    );
    const n = await pullEntity(
      {
        remoteTable: "confinamentos_online",
        orderBy: "updated_at",
        updatedAtField: "updated_at",
        localTable: db.confinamentos as Table<Confinamento, IndexableType>,
        mapper: (s: ServerRow): Confinamento => ({
          id: String(s.uuid ?? ""),
          fazendaId:
            remoteIdToFazendaId.get(Number(s.fazenda_id)) ??
            remoteIdToFazendaId.get(s.fazenda_id as number) ??
            String(s.fazenda_id ?? ""),
          nome: String(s.nome ?? ""),
          dataInicio: String(s.data_inicio ?? ""),
          dataFimPrevista: (s.data_fim_prevista as string) || undefined,
          dataFimReal: (s.data_fim_real as string) || undefined,
          status: (s.status as Confinamento["status"]) ?? "ativo",
          precoVendaKg:
            s.preco_venda_kg != null ? Number(s.preco_venda_kg) : undefined,
          observacoes: (s.observacoes as string) || undefined,
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
          deletedAt: (s.deleted_at as string) || undefined,
        }),
      },
      syncClient,
    );
    endSyncStep("Pull Confinamentos", n);
    if (n > 0) logDebug("✅ Pull Confinamentos:", n, "registro(s)");
  } catch (err: unknown) {
    logCritical(
      "Erro ao processar pull de confinamentos:",
      getErrorMessage(err),
      err,
    );
    endSyncStep("Pull Confinamentos", 0);
  }

  const confinamentosLocais = await db.confinamentos.toArray();
  const remoteIdToConfinamentoId = new Map(
    confinamentosLocais
      .filter((c) => c.remoteId != null)
      .map((c) => [Number(c.remoteId), c.id]),
  );

  try {
    currentStep++;
    startSyncStep("Pull Confinamento Animais");
    emitSyncProgress(
      "pull",
      currentStep,
      totalSteps,
      "Sincronizando Vínculos Animal-Confinamento...",
    );
    const n = await pullEntity(
      {
        remoteTable: "confinamento_animais_online",
        orderBy: "updated_at",
        updatedAtField: "updated_at",
        localTable: db.confinamentoAnimais as Table<ConfinamentoAnimal, IndexableType>,
        mapper: (s: ServerRow): ConfinamentoAnimal => ({
          id: String(s.uuid ?? ""),
          confinamentoId:
            remoteIdToConfinamentoId.get(Number(s.confinamento_id)) ??
            remoteIdToConfinamentoId.get(s.confinamento_id as number) ??
            String(s.confinamento_id ?? ""),
          animalId: String(s.animal_id ?? s.animal_uuid ?? ""),
          dataEntrada: String(s.data_entrada ?? ""),
          pesoEntrada: Number(s.peso_entrada ?? 0),
          dataSaida: (s.data_saida as string) || undefined,
          pesoSaida: s.peso_saida as number | undefined,
          motivoSaida: (s.motivo_saida as ConfinamentoAnimal["motivoSaida"]) || undefined,
          observacoes: (s.observacoes as string) || undefined,
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
          deletedAt: (s.deleted_at as string) || undefined,
        }),
      },
      syncClient,
    );
    endSyncStep("Pull Confinamento Animais", n);
    if (n > 0) logDebug("✅ Pull Confinamento Animais:", n, "registro(s)");
  } catch (err: unknown) {
    logCritical(
      "Erro ao processar pull de confinamento_animais:",
      getErrorMessage(err),
      err,
    );
    endSyncStep("Pull Confinamento Animais", 0);
  }

  try {
    currentStep++;
    startSyncStep("Pull Confinamento Alimentação");
    emitSyncProgress(
      "pull",
      currentStep,
      totalSteps,
      "Sincronizando Alimentação de Confinamento...",
    );
    const n = await pullEntity(
      {
        remoteTable: "confinamento_alimentacao_online",
        orderBy: "updated_at",
        updatedAtField: "updated_at",
        localTable: db.confinamentoAlimentacao as Table<ConfinamentoAlimentacao, IndexableType>,
        mapper: (s: ServerRow): ConfinamentoAlimentacao => ({
          id: String(s.uuid ?? ""),
          confinamentoId:
            remoteIdToConfinamentoId.get(Number(s.confinamento_id)) ??
            remoteIdToConfinamentoId.get(s.confinamento_id as number) ??
            String(s.confinamento_id ?? ""),
          data: String(s.data ?? ""),
          tipoDieta: (s.tipo_dieta as string) || undefined,
          custoTotal: s.custo_total as number | undefined,
          observacoes: (s.observacoes as string) || undefined,
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
          deletedAt: (s.deleted_at as string) || undefined,
        }),
      },
      syncClient,
    );
    endSyncStep("Pull Confinamento Alimentação", n);
    if (n > 0)
      logDebug("✅ Pull Confinamento Alimentação:", n, "registro(s)");
  } catch (err: unknown) {
    logCritical(
      "Erro ao processar pull de confinamento_alimentacao:",
      getErrorMessage(err),
      err,
    );
    endSyncStep("Pull Confinamento Alimentação", 0);
  }
  //#endregion Confinamento

  //#region  Pull ocorrências animal (motor bulk; só executa se a tabela existir no backend — evita 404/PGRST205 no console)
  if (db.ocorrenciaAnimais) {
    const { error: tableCheck } = await syncClient
      .from("ocorrencia_animais_online")
      .select("id")
      .limit(1);
    if (!tableCheck) {
      try {
        const vinculosLocaisForOcorrencia =
          await db.confinamentoAnimais.toArray();
        const remoteIdToConfinamentoAnimalId = new Map(
          vinculosLocaisForOcorrencia
            .filter((v) => v.remoteId != null)
            .map((v) => [Number(v.remoteId), v.id]),
        );
        const n = await pullEntity(
          {
            remoteTable: "ocorrencia_animais_online",
            orderBy: "updated_at",
            updatedAtField: "updated_at",
            localTable: db.ocorrenciaAnimais as Table<OcorrenciaAnimal, IndexableType>,
            mapper: (s: ServerRow): OcorrenciaAnimal => ({
              id: String(s.uuid ?? ""),
              animalId: String(s.animal_id ?? ""),
              confinamentoAnimalId:
                s.confinamento_animal_id != null
                  ? (remoteIdToConfinamentoAnimalId.get(
                      Number(s.confinamento_animal_id),
                    ) ??
                    remoteIdToConfinamentoAnimalId.get(
                      s.confinamento_animal_id as number,
                    ))
                  : undefined,
              data: String(s.data ?? ""),
              tipo: (s.tipo as OcorrenciaTipo) ?? "outro",
              custo: s.custo != null ? Number(s.custo) : undefined,
              observacoes: (s.observacoes as string) || undefined,
              createdAt: String(s.created_at ?? ""),
              updatedAt: String(s.updated_at ?? ""),
              synced: true,
              remoteId: s.id as number | null,
            }),
          },
          syncClient,
        );
        if (n > 0) logDebug("✅ Pull Ocorrências Animal:", n, "registro(s)");
      } catch (err: unknown) {
        logCritical(
          "Erro ao processar pull de ocorrencia_animais:",
          getErrorMessage(err),
        );
      }
    }
  }
  //#endregion Ocorrências animal

  //#region Pull notificações lidas (Sincronizar Agora)
  try {
    currentStep++;
    startSyncStep("Pull Notificações lidas");
    emitSyncProgress(
      "pull",
      currentStep,
      totalSteps,
      "Sincronizando Notificações lidas...",
    );
    let nNotif = 0;
    if (db.notificacoesLidas) {
      nNotif = await pullEntity(
        {
          remoteTable: "notificacoes_lidas_online",
          orderBy: "marcada_em",
          updatedAtField: "marcada_em",
          updatedAtFieldLocal: "marcadaEm",
          localTable: db.notificacoesLidas as Table<NotificacaoLida, IndexableType>,
          mapper: (s: ServerRow): NotificacaoLida => ({
            id: String(s.uuid ?? ""),
            tipo: s.tipo as NotificacaoLida["tipo"],
            usuarioId: String(
              s.usuario_uuid ?? s.usuario_id ?? "",
            ),
            marcadaEm: String(s.marcada_em ?? ""),
            synced: true,
            remoteId: s.id as number | null,
          }),
        },
        syncClient,
      );
    }
    endSyncStep("Pull Notificações lidas", nNotif);
  } catch (err: unknown) {
    logCritical(
      "Erro ao processar pull de notificações lidas:",
      getErrorMessage(err),
    );
    endSyncStep("Pull Notificações lidas", 0);
  }
  //#endregion notificações lidas

  //#region Pull auditoria (Sincronizar Agora)
  try {
    currentStep++;
    startSyncStep("Pull Auditoria");
    emitSyncProgress(
      "pull",
      currentStep,
      totalSteps,
      "Sincronizando Auditoria...",
    );
    let nAudit = 0;
    if (db.audits) {
      const { data: servAudits, error: errorAudits } = await syncClient
        .from("audits_online")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(1000);

      if (errorAudits) {
        logCritical(
          "Erro ao buscar auditoria do servidor:",
          errorAudits?.message ?? errorAudits,
        );
      } else if (servAudits && servAudits.length > 0) {
        const servUuids = new Set(
          (servAudits as ServerRow[])
            .map((a) => a.uuid)
            .filter((u): u is string => Boolean(u))
            .map(String),
        );
        const todosAuditsLocais = await db.audits.toArray();
        const auditsLocaisMap = new Map(
          todosAuditsLocais.map((a) => [a.id, a]),
        );
        const idsParaDeletar = todosAuditsLocais
          .filter((a) => a.remoteId != null && !servUuids.has(a.id))
          .map((a) => a.id);
        if (idsParaDeletar.length > 0)
          await db.audits.bulkDelete(idsParaDeletar);
        const toPut: AuditLog[] = [];
        const toUpdate: Array<{ key: string; changes: Partial<AuditLog> }> = [];
        for (const s of servAudits as ServerRow[]) {
          const suuid = s.uuid as string | undefined;
          if (!suuid) continue;
          const local = auditsLocaisMap.get(suuid);
          const rec: AuditLog = {
            id: String(s.uuid),
            entity: s.entity as AuditLog["entity"],
            entityId: String(s.entity_id ?? ""),
            action: s.action as AuditLog["action"],
            timestamp: String(s.timestamp ?? ""),
            userId: (s.user_uuid as string) || null,
            userNome: (s.user_nome as string) || null,
            before: s.before_json
              ? JSON.stringify(s.before_json)
              : null,
            after: s.after_json ? JSON.stringify(s.after_json) : null,
            description: (s.description as string) || null,
            synced: true,
            remoteId: s.id as number | null,
          };
          if (!local) {
            toPut.push(rec);
          } else if (
            !local.remoteId ||
            new Date(local.timestamp) < new Date(s.timestamp as string)
          ) {
            toUpdate.push({ key: suuid, changes: rec });
          }
        }
        if (toPut.length > 0) await db.audits.bulkPut(toPut);
        if (toUpdate.length > 0) await db.audits.bulkUpdate(toUpdate);
        nAudit = toPut.length + toUpdate.length;
      }
    }
    endSyncStep("Pull Auditoria", nAudit);
  } catch (err: unknown) {
    logCritical(
      "Erro ao processar pull de auditoria:",
      getErrorMessage(err),
    );
    endSyncStep("Pull Auditoria", 0);
  }
  //#endregion auditoria
}

/**
 * Sincroniza apenas usuários do servidor (usado na inicialização / login)
 * Mais rápido que pullUpdates completo
 * IMPORTANTE: Não exclui usuários locais, apenas adiciona/atualiza do servidor
 */
export async function pullUsuarios() {
  try {
    logDebug("🚀 Iniciando pull de usuários do servidor...");
    const { data: servUsuarios, error: errorUsuarios } = await supabase
      .from("usuarios_online")
      .select("*");
    if (errorUsuarios) {
      logCritical("Erro ao buscar usuários do servidor:", errorUsuarios);
      // Não lançar erro - permitir continuar com dados locais
      return;
    }
    logDebug("🚀 Usuários do servidor:", servUsuarios.length);

    if (servUsuarios && servUsuarios.length > 0) {
      // IMPORTANTE: Não excluir usuários locais nesta função!
      const usuariosLocais = await db.usuarios.toArray();
      const usuariosMap = new Map(usuariosLocais.map((u) => [u.id, u]));
      const toPut: Usuario[] = [];
      const toUpdate: Array<{ key: string; changes: Partial<Usuario> }> = [];
      for (const s of servUsuarios as ServerRow[]) {
        const suuid = s.uuid as string | undefined;
        if (!suuid) continue;
        const local = usuariosMap.get(suuid);
        const rec: Usuario = {
          id: String(s.uuid),
          nome: String(s.nome ?? ""),
          email: String(s.email ?? ""),
          senhaHash: String(s.senha_hash ?? ""),
          role: (s.role as Usuario["role"]) ?? "visitante",
          fazendaId: s.fazenda_uuid != null ? String(s.fazenda_uuid) : undefined,
          ativo: Boolean(s.ativo),
          createdAt: String(s.created_at ?? ""),
          updatedAt: String(s.updated_at ?? ""),
          synced: true,
          remoteId: s.id as number | null,
        };
        if (!local) {
          toPut.push(rec);
        } else if (
          local.remoteId &&
          new Date(local.updatedAt) < new Date(s.updated_at as string)
        ) {
          toUpdate.push({ key: suuid, changes: rec });
        } else if (!local.remoteId) {
          toUpdate.push({
            key: suuid,
            changes: {
              synced: true,
              remoteId: s.id as number,
              updatedAt:
                String(s.updated_at) > local.updatedAt
                  ? String(s.updated_at)
                  : local.updatedAt,
            },
          });
        }
      }
      if (toPut.length > 0) await db.usuarios.bulkPut(toPut);
      if (toUpdate.length > 0) await db.usuarios.bulkUpdate(toUpdate);
    }
    // Se servUsuarios for null ou vazio, não fazer nada (preservar dados locais)
  } catch (err) {
    logCritical("Erro ao processar pull de usuários:", err);
    // Não lançar erro para não bloquear o login
  }
}

// Guard para evitar múltiplas sincronizações simultâneas
let isSyncing = false;

export async function syncAll(): Promise<{ ran: boolean }> {
  if (isSyncing) {
    return { ran: false };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    showToast({
      type: "warning",
      title: "Sem conexão",
      message:
        "Sincronização não realizada. Conecte-se à internet e tente novamente.",
    });
    return { ran: false };
  }

  isSyncing = true;

  currentSyncStats = {
    startTime: Date.now(),
    steps: {},
  };

  logDebug("🚀 INICIANDO SINCRONIZAÇÃO COMPLETA");

  if (typeof window !== "undefined") {
    setGlobalSyncing(true);
  }

  try {
    const syncClient = await getSupabaseForSync();
    if (!syncClient) {
      throw new Error(
        "Sessão não disponível. Faça login com Supabase Auth e tente sincronizar novamente.",
      );
    }

    // Criar eventos para registros pendentes que ainda não têm evento na fila (automático)
    try {
      const { created } = await createSyncEventsForPendingRecords();
      if (created > 0) {
        logDebug(`📋 ${created} evento(s) criado(s) automaticamente para pendências.`);
      }
    } catch (e) {
      logWarn("Erro ao criar eventos para pendências (sync continua):", e);
    }

    // IMPORTANTE: Fazer pull ANTES do push para evitar conflitos de timestamp
    await pullUpdates(syncClient);
    await pushPending(syncClient);

    // Finalizar estatísticas
    if (currentSyncStats) {
      currentSyncStats.endTime = Date.now();
      currentSyncStats.duration =
        currentSyncStats.endTime - currentSyncStats.startTime;

      // Calcular total de registros processados
      const totalRecords = Object.values(currentSyncStats.steps).reduce(
        (sum, step) => sum + step.recordsProcessed,
        0,
      );

      logDebug("✅ ========================================");
      logDebug(`✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO`);
      logDebug(
        `✅ Tempo total: ${(currentSyncStats.duration / 1000).toFixed(2)}s`,
      );
      logDebug(`✅ Total de registros processados: ${totalRecords}`);
      logDebug("✅ ========================================");

      // Detalhes por etapa
      const stepsWithData = Object.entries(currentSyncStats.steps).filter(
        ([, step]) => step.recordsProcessed > 0,
      );

      if (stepsWithData.length > 0) {
        logDebug("📊 Detalhes por etapa:");
        stepsWithData.forEach(([name, step]) => {
          const duration = step.duration
            ? (step.duration / 1000).toFixed(2)
            : "?";
          logDebug(
            `   • ${name}: ${step.recordsProcessed} registros em ${duration}s`,
          );
        });
      }
    }

    // Salvar timestamp da última sincronização bem-sucedida (manual ou automática)
    if (typeof window !== "undefined") {
      const timestamp = new Date().toISOString();
      localStorage.setItem("lastSyncTimestamp", timestamp);

      // Disparar evento para atualizar componentes que escutam (com estatísticas)
      window.dispatchEvent(
        new CustomEvent("syncCompleted", {
          detail: {
            timestamp,
            success: true,
            stats: currentSyncStats,
          },
        }),
      );
    }
    return { ran: true };
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === "PGRST301") {
      logWarn(
        "[Sync] PGRST301: O servidor rejeitou o request. Use Supabase Auth (signInWithPassword) e políticas RLS com auth.uid().",
      );
    }
    logCritical("❌ ========================================");
    logCritical("❌ ERRO DURANTE SINCRONIZAÇÃO");
    logCritical("❌ ========================================");
    logCritical("❌ Detalhes:", error);

    // Finalizar estatísticas com erro
    if (currentSyncStats) {
      currentSyncStats.endTime = Date.now();
      currentSyncStats.duration =
        currentSyncStats.endTime - currentSyncStats.startTime;
    }

    // Disparar evento de erro
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("syncCompleted", {
          detail: {
            timestamp: new Date().toISOString(),
            success: false,
            error,
            stats: currentSyncStats,
          },
        }),
      );
    }
    throw error; // Propagar erro para o caller
  } finally {
    isSyncing = false;
    if (typeof window !== "undefined") {
      setGlobalSyncing(false);
    }
  }
}

/**
 * Sincronização completa (full pull) - ignora checkpoints e busca todos os registros do servidor.
 * Use quando houver suspeita de checkpoint corrompido ou dados desatualizados.
 * Consome mais rede e pode demorar mais que sync incremental.
 */
export async function syncAllFull(): Promise<{ ran: boolean }> {
  if (typeof window !== "undefined") {
    clearLastPulledAt(); // Limpa todos os checkpoints = full pull em todas as tabelas
  }
  return syncAll();
}
