import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "../db/dexieDB";
import { supabase } from "./supabaseClient";
import { getSupabaseForSync } from "./supabaseSyncClient";
import { processSyncQueue } from "../utils/syncEvents";
import {
  pullEntity,
  pullEntitySimple,
  fetchAllPaginated,
  fetchFromSupabase,
} from "./syncEngine";

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
    console.log(`🔄 [${current}/${total}] ${message}`);
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
    console.log(
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
): Promise<any[]> {
  const sb = client ?? supabase;
  let allRecords: any[] = [];
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
      console.error(`Erro ao buscar ${tableName} do servidor:`, error);
      break;
    }

    if (page && page.length > 0) {
      allRecords = allRecords.concat(page);
      hasMore = page.length === pageSize;
      from += pageSize;
    } else {
      hasMore = false;
    }
  }

  // Log removido para reduzir verbosidade (esta função é chamada múltiplas vezes durante sync)
  // if (allRecords.length > 0) {
  //   console.log(`✅ Total de ${tableName} buscados: ${allRecords.length}`);
  // }

  return allRecords;
}

export async function pushPending() {
  // Processar fila de eventos de sincronização primeiro (se houver)
  try {
    const queueResults = await processSyncQueue();
    if (queueResults.processados > 0) {
      console.log(
        `📦 Fila de eventos: ${queueResults.sucesso} sucesso, ${queueResults.falhas} falhas`,
      );
    }
  } catch (err) {
    console.error("Erro ao processar fila de eventos:", err);
  }

  // Sincronizar exclusões pendentes primeiro
  try {
    // Verificar se a tabela deletedRecords existe (pode não existir em versões antigas do banco)
    if (db.deletedRecords) {
      // Query mais segura: buscar todos e filtrar manualmente para evitar erros com dados inválidos
      const todasExclusoes = await db.deletedRecords.toArray();
      const deletedRecords = todasExclusoes.filter((d) => d.synced === false);
      for (const deleted of deletedRecords) {
        try {
          // Se tem remoteId, tentar excluir no servidor
          if (deleted.remoteId) {
            let sucesso = false;
            let ultimoErro = null;

            // Tentar excluir de cada tabela sequencialmente
            const tabelas = [
              "vacinacoes_online",
              "pesagens_online",
              "nascimentos_online",
              "animais_online",
            ];

            for (const tabela of tabelas) {
              const { error } = await supabase
                .from(tabela)
                .delete()
                .eq("id", deleted.remoteId);
              if (!error) {
                sucesso = true;
                break;
              } else if (
                error.code === "PGRST116" ||
                error.message?.includes("No rows") ||
                error.message?.includes("not found")
              ) {
                // Registro não existe nesta tabela, continuar tentando outras
                continue;
              } else {
                // Erro real, guardar e continuar tentando
                ultimoErro = error;
                continue;
              }
            }

            // Se não conseguiu excluir via DELETE (hard delete), tentar soft delete via UPDATE
            if (!sucesso) {
              // Verificar se é um animal e fazer soft delete
              const animal = await db.animais.get(deleted.uuid);
              if (animal && animal.deletedAt && animal.remoteId) {
                const { error: updateError } = await supabase
                  .from("animais_online")
                  .update({ deleted_at: animal.deletedAt })
                  .eq("id", animal.remoteId);

                if (!updateError) {
                  sucesso = true;
                  console.log(
                    `✅ Soft delete aplicado para animal ${deleted.uuid}`,
                  );
                } else {
                  console.error(
                    "Erro ao fazer soft delete de animal:",
                    updateError,
                  );
                  ultimoErro = updateError;
                }
              }
            }

            if (sucesso) {
              await db.deletedRecords.update(deleted.id, { synced: true });
            } else if (ultimoErro) {
              console.error(
                "Erro ao sincronizar exclusão no servidor:",
                ultimoErro,
                deleted.uuid,
              );
            }
            continue;
          } else {
            // Se não tem remoteId, nunca foi ao servidor, então já está "sincronizado"
            await db.deletedRecords.update(deleted.id, { synced: true });
          }
        } catch (err) {
          console.error(
            "Erro ao processar exclusão pendente:",
            err,
            deleted.uuid,
          );
        }
      }
    }
  } catch (err) {
    console.error("Erro geral ao sincronizar exclusões:", err);
  }
}

export async function pullUpdates(syncClient: SupabaseClient) {
  console.log("📥 Iniciando pull de atualizações do servidor...");
  const totalSteps = 11; // Categorias, Raças, Fazendas, Usuários, Animais, Confinamento x4, Notificações lidas, Auditoria
  let currentStep = 0;

  // Buscar categorias (motor genérico) — forceFullPull: tabela pequena
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
        localTable: db.categorias as any,
        mapper: (s: any) => ({
          id: s.uuid,
          nome: s.nome,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
        }),
        forceFullPull: true,
      },
      syncClient,
    );
    endSyncStep("Pull Categorias", n);
  } catch (err) {
    console.error("Erro ao processar pull de categorias:", err);
    endSyncStep("Pull Categorias", 0);
  }

  // Buscar raças (motor genérico) — forceFullPull: tabela pequena, evita perder registros por checkpoint incremental
  try {
    currentStep++;
    startSyncStep("Pull Raças");
    emitSyncProgress("pull", currentStep, totalSteps, "Sincronizando Raças...");
    const n = await pullEntity(
      {
        remoteTable: "racas_online",
        orderBy: "updated_at",
        updatedAtField: "updated_at",
        localTable: db.racas as any,
        mapper: (s: any) => ({
          id: s.uuid,
          nome: s.nome,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
        }),
        forceFullPull: true,
      },
      syncClient,
    );
    endSyncStep("Pull Raças", n);
  } catch (err) {
    console.error("Erro ao processar pull de raças:", err);
    endSyncStep("Pull Raças", 0);
  }

  // Buscar fazendas (motor genérico) — forceFullPull: tabela pequena
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
        localTable: db.fazendas as any,
        mapper: (s: any) => ({
          id: s.uuid,
          nome: s.nome,
          logoUrl: s.logo_url,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
        }),
        forceFullPull: true,
      },
      syncClient,
    );
    endSyncStep("Pull Fazendas", n);
  } catch (err) {
    console.error("Erro ao processar pull de fazendas:", err);
    endSyncStep("Pull Fazendas", 0);
  }

  // (Pull de matrizes/nascimentos removido — uso apenas animais/genealogias.)

  // Buscar desmamas (motor bulk - pullEntity)
  try {
    await pullEntity(
      {
        remoteTable: "desmamas_online",
        orderBy: "updated_at",
        updatedAtField: "updated_at",
        localTable: db.desmamas as any,
        mapper: (s: any) => ({
          id: s.uuid,
          animalId: s.animal_id ?? s.nascimento_uuid,
          dataDesmama: s.data_desmama,
          pesoDesmama: s.peso_desmama,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
        }),
        forceFullPull: true,
      },
      syncClient,
    );
  } catch (err) {
    console.error("Erro ao processar pull de desmamas:", err);
    throw err;
  }

  // Buscar pesagens (motor bulk: toPut/toUpdate/bulkDelete)
  try {
    const servPesagens = await fetchAllFromSupabase(
      "pesagens_online",
      "id",
      syncClient,
    );
    if (servPesagens && servPesagens.length > 0) {
      const servUuids = new Set(
        servPesagens.map((p: any) => p.uuid).filter(Boolean),
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
      const toPut: any[] = [];
      const toUpdate: Array<{ key: string; changes: any }> = [];
      for (const s of servPesagens) {
        if (!s.uuid || deletedUuids.has(s.uuid)) continue;
        const local = localMap.get(s.uuid);
        const mapped = {
          id: s.uuid,
          animalId: s.animal_id ?? s.nascimento_id ?? s.nascimento_uuid,
          dataPesagem: s.data_pesagem,
          peso: s.peso,
          observacao: s.observacao || undefined,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
        };
        if (!local) {
          toPut.push(mapped);
        } else {
          if (!local.synced) {
            const servUpdated = s.updated_at
              ? new Date(s.updated_at).getTime()
              : 0;
            const localUpdated = local.updatedAt
              ? new Date(local.updatedAt).getTime()
              : 0;
            if (localUpdated >= servUpdated - margemTimestamp) continue;
          }
          if (
            !local.remoteId ||
            new Date(local.updatedAt) < new Date(s.updated_at)
          ) {
            toUpdate.push({ key: s.uuid, changes: mapped });
          }
        }
      }
      if (toPut.length > 0) await db.pesagens.bulkPut(toPut);
      if (toUpdate.length > 0) await db.pesagens.bulkUpdate(toUpdate);
    }
  } catch (err) {
    console.error("Erro ao processar pull de pesagens:", err);
    throw err;
  }

  // Buscar vacinações (motor bulk: toPut/toUpdate/bulkDelete)
  try {
    let servVacinacoes: any[] = [];
    try {
      servVacinacoes = await fetchAllFromSupabase(
        "vacinacoes_online",
        "id",
        syncClient,
      );
    } catch (errorVacinacoes: any) {
      if (
        errorVacinacoes?.code === "PGRST205" ||
        errorVacinacoes?.code === "42P01" ||
        errorVacinacoes?.message?.includes("Could not find the table")
      ) {
        console.warn(
          "Tabela vacinacoes_online não existe no servidor. Execute a migração 024_add_vacinacoes_online.sql no Supabase.",
        );
      } else {
        console.error(
          "Erro ao buscar vacinações do servidor:",
          errorVacinacoes,
        );
      }
    }
    if (servVacinacoes && servVacinacoes.length > 0) {
      const servUuids = new Set(
        servVacinacoes.map((v: any) => v.uuid).filter(Boolean),
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
      const toPut: any[] = [];
      const toUpdate: Array<{ key: string; changes: any }> = [];
      for (const s of servVacinacoes) {
        if (!s.uuid || deletedUuids.has(s.uuid)) continue;
        const local = localMap.get(s.uuid);
        const mapped = {
          id: s.uuid,
          animalId: s.animal_id ?? s.nascimento_id ?? s.nascimento_uuid,
          vacina: s.vacina,
          dataAplicacao: s.data_aplicacao,
          dataVencimento: s.data_vencimento || undefined,
          lote: s.lote || undefined,
          responsavel: s.responsavel || undefined,
          observacao: s.observacao || undefined,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
        };
        if (!local) {
          toPut.push(mapped);
        } else {
          if (!local.synced) {
            const servUpdated = s.updated_at
              ? new Date(s.updated_at).getTime()
              : 0;
            const localUpdated = local.updatedAt
              ? new Date(local.updatedAt).getTime()
              : 0;
            if (localUpdated >= servUpdated - margemTimestamp) continue;
          }
          if (
            !local.remoteId ||
            new Date(local.updatedAt) < new Date(s.updated_at)
          ) {
            toUpdate.push({ key: s.uuid, changes: mapped });
          }
        }
      }
      if (toPut.length > 0) await db.vacinacoes.bulkPut(toPut);
      if (toUpdate.length > 0) await db.vacinacoes.bulkUpdate(toUpdate);
    }
  } catch (err: any) {
    if (
      err?.code === "PGRST205" ||
      err?.code === "42P01" ||
      err?.message?.includes("Could not find the table")
    ) {
      console.warn("Tabela vacinacoes_online não existe no servidor.");
    } else {
      console.error("Erro ao processar pull de vacinações:", err);
    }
  }

  // Buscar tags (incluir deletadas para sincronizar soft deletes)
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
        console.warn(
          "Tabela tags não existe no servidor. Execute a migração 022_add_tags_system.sql no Supabase.",
        );
      } else {
        console.error("Erro ao buscar tags do servidor:", errorTags);
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
        console.error("Erro ao buscar atribuições de tags:", errorAssignments);
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
  } catch (err: any) {
    if (err?.code !== "PGRST205" && err?.code !== "42P01") {
      console.error("Erro ao processar tags:", err);
    }
  }

  // Buscar usuários (motor genérico: incremental + batch)
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
        localTable: db.usuarios as any,
        mapper: (s: any) => ({
          id: s.uuid,
          nome: s.nome,
          email: s.email,
          senhaHash: s.senha_hash,
          role: s.role,
          fazendaId: s.fazenda_uuid || undefined,
          ativo: s.ativo,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
        }),
      },
      syncClient,
    );
    endSyncStep("Pull Usuários", nUsuarios);
  } catch (err) {
    console.error("Erro ao processar pull de usuários:", err);
    endSyncStep("Pull Usuários", 0);
    throw err;
  }

  // Pull de auditoria (motor genérico: incremental + batch, limit 1000)
  try {
    if (db.audits) {
      await pullEntity(
        {
          remoteTable: "audits_online",
          orderBy: "timestamp",
          updatedAtField: "timestamp",
          updatedAtFieldLocal: "timestamp",
          localTable: db.audits as any,
          limit: 1000,
          mapper: (s: any) => ({
            id: s.uuid,
            entity: s.entity,
            entityId: s.entity_id,
            action: s.action,
            timestamp: s.timestamp,
            userId: s.user_uuid || null,
            userNome: s.user_nome || null,
            before: s.before_json ? JSON.stringify(s.before_json) : null,
            after: s.after_json ? JSON.stringify(s.after_json) : null,
            description: s.description || null,
            synced: true,
            remoteId: s.id,
          }),
        },
        syncClient,
      );
    }
  } catch (err) {
    console.error("Erro ao processar pull de auditoria:", err);
  }

  // Buscar configurações de alerta
  try {
    if (db.alertSettings) {
      const { data: servSettings, error: errorSettings } = await syncClient
        .from("alert_settings_online")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (errorSettings) {
        console.error("Erro ao buscar configurações de alerta do servidor:", {
          error: errorSettings,
          message: errorSettings.message,
          code: errorSettings.code,
        });
        // Se a tabela não existe, pode ser que a migration não foi executada
        if (
          errorSettings.code === "42P01" ||
          errorSettings.message?.includes("does not exist")
        ) {
          console.warn(
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
          } catch (putError: any) {
            if (putError.name === "ConstraintError") {
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
    console.error("Erro ao processar pull de configurações de alerta:", err);
    // Não lançar erro - configurações não são críticas para funcionamento
  }

  // Buscar configurações do app
  try {
    if (db.appSettings) {
      const { data: servSettings, error: errorSettings } = await syncClient
        .from("app_settings_online")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (errorSettings) {
        console.error("Erro ao buscar configurações do app do servidor:", {
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
          } catch (putError: any) {
            if (putError.name === "ConstraintError") {
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
    console.error("Erro ao processar pull de configurações do app:", err);
    // Não lançar erro - configurações não são críticas para funcionamento
  }

  // Pull de permissões: merge por (role, permission) — não deleta locais, evita "reset" ao sincronizar
  try {
    const { getLastPulledAt, setLastPulledAt } =
      await import("../utils/syncCheckpoints");
    const lastPulled = getLastPulledAt("role_permissions_online");
    const servRecords = await fetchFromSupabase<any>(
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
        localRecords.map((r: any) => [`${r.role}\0${r.permission}`, r]),
      );
      const toPut: any[] = [];
      const toUpdate: Array<{ key: string; changes: any }> = [];
      for (const s of servRecords) {
        if (!s.uuid) continue;
        const key = `${s.role}\0${s.permission}`;
        const local = localByRolePerm.get(key);
        const payload = {
          role: s.role,
          permission: s.permission,
          granted: s.granted,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
        };
        if (local) {
          toUpdate.push({ key: local.id, changes: payload });
        } else {
          toPut.push({ id: s.uuid, ...payload });
        }
      }
      if (toPut.length > 0) await db.rolePermissions.bulkPut(toPut);
      if (toUpdate.length > 0) await db.rolePermissions.bulkUpdate(toUpdate);
      const maxUpdated = servRecords.reduce(
        (max: string | null, r: any) =>
          r.updated_at && (!max || r.updated_at > max) ? r.updated_at : max,
        null,
      );
      if (maxUpdated) setLastPulledAt("role_permissions_online", maxUpdated);
    } else {
      const { setLastPulledAt: setCheck } =
        await import("../utils/syncCheckpoints");
      setCheck("role_permissions_online", new Date().toISOString());
    }
  } catch (err) {
    console.error("Erro ao processar pull de permissões:", err);
    // Não lançar erro - permissões não são críticas para funcionamento básico
  }

  // ========================================
  // PULL SISTEMA DE ANIMAIS
  // ========================================

  // Pull tipos, status e origens (motor genérico - bulkPut)
  try {
    await pullEntitySimple(
      "tipos_animal_online",
      db.tiposAnimal as any,
      (s: any) => ({
        id: s.uuid,
        nome: s.nome,
        descricao: s.descricao,
        ordem: s.ordem,
        ativo: s.ativo,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        deletedAt: s.deleted_at,
        synced: true,
        remoteId: s.id,
      }),
      {},
      syncClient,
    );
  } catch (err) {
    console.error("Erro ao fazer pull de tipos de animal:", err);
  }
  try {
    await pullEntitySimple(
      "status_animal_online",
      db.statusAnimal as any,
      (s: any) => ({
        id: s.uuid,
        nome: s.nome,
        cor: s.cor,
        descricao: s.descricao,
        ordem: s.ordem,
        ativo: s.ativo,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        deletedAt: s.deleted_at,
        synced: true,
        remoteId: s.id,
      }),
      {},
      syncClient,
    );
  } catch (err) {
    console.error("Erro ao fazer pull de status de animal:", err);
  }
  try {
    await pullEntitySimple(
      "origens_online",
      db.origens as any,
      (s: any) => ({
        id: s.uuid,
        nome: s.nome,
        descricao: s.descricao,
        ordem: s.ordem,
        ativo: s.ativo,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        deletedAt: s.deleted_at,
        synced: true,
        remoteId: s.id,
      }),
      {},
      syncClient,
    );
  } catch (err) {
    console.error("Erro ao fazer pull de origens:", err);
  }

  // Pull animais
  try {
    currentStep++;
    startSyncStep("Pull Animais");
    emitSyncProgress(
      "pull",
      currentStep,
      totalSteps,
      "Sincronizando Animais...",
    );

    // Verificar raças disponíveis antes de sincronizar animais
    const racasDisponiveis = await db.racas.toArray();
    console.log(
      `📊 Raças disponíveis no Dexie antes do pull de animais: ${racasDisponiveis.length}`,
      racasDisponiveis.map((r) => ({
        id: r.id,
        remoteId: r.remoteId,
        nome: r.nome,
      })),
    );

    // Buscar animais com paginação + incremental
    const { getLastPulledAt, setLastPulledAt } =
      await import("../utils/syncCheckpoints");
    const lastPulledAnimais = getLastPulledAt("animais_online");
    const servAnimais = await fetchAllPaginated<any>(
      "animais_online",
      {
        orderBy: "id",
        updatedAtField: lastPulledAnimais ? "updated_at" : undefined,
        lastPulledAt: lastPulledAnimais || undefined,
      },
      syncClient,
    );

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
        ...new Set(servAnimais.map((s: any) => s.raca_id).filter(Boolean)),
      ].filter((id: number) => !racasMap.has(id));
      if (racasIdsAusentes.length > 0) {
        try {
          const { data: racasSupabase } = await syncClient
            .from("racas_online")
            .select("*")
            .in("id", racasIdsAusentes);
          if (racasSupabase) {
            const toPutRacas = racasSupabase.map((r: any) => ({
              id: r.uuid,
              nome: r.nome,
              createdAt: r.created_at,
              updatedAt: r.updated_at,
              synced: true,
              remoteId: r.id,
            }));
            await db.racas.bulkPut(toPutRacas);
            toPutRacas.forEach((r) => racasMap.set(r.remoteId!, r));
          }
        } catch (_) {
          /* ignora */
        }
      }

      const margemTimestamp = 1000;
      const toPut: any[] = [];
      for (const s of servAnimais) {
        const animalLocal = animaisLocaisMap.get(s.uuid);
        if (animalLocal && animalLocal.deletedAt && !animalLocal.synced)
          continue;
        if (animalLocal && !animalLocal.synced) {
          const servUpdated = s.updated_at
            ? new Date(s.updated_at).getTime()
            : 0;
          const localUpdated = animalLocal.updatedAt
            ? new Date(animalLocal.updatedAt).getTime()
            : 0;
          if (localUpdated >= servUpdated - margemTimestamp) continue;
        }
        const tipoLocal = tiposMap.get(s.tipo_id);
        const statusLocal = statusMap.get(s.status_id);
        const origemLocal = origensMap.get(s.origem_id);
        const fazendaLocal = fazendasMap.get(s.fazenda_id);
        const racaLocal = s.raca_id ? racasMap.get(s.raca_id) : null;
        toPut.push({
          id: s.uuid,
          brinco: s.brinco,
          nome: s.nome,
          tipoId: tipoLocal?.id || "",
          racaId: racaLocal?.id,
          sexo: s.sexo,
          statusId: statusLocal?.id || "",
          dataNascimento: s.data_nascimento,
          dataCadastro: s.data_cadastro,
          dataEntrada: s.data_entrada,
          dataSaida: s.data_saida,
          origemId: origemLocal?.id || "",
          fazendaId: fazendaLocal?.id || "",
          fazendaOrigemId: s.fazenda_origem_id
            ? fazendasMap.get(s.fazenda_origem_id)?.id
            : undefined,
          proprietarioAnterior: s.proprietario_anterior,
          matrizId: s.matriz_id,
          reprodutorId: s.reprodutor_id,
          valorCompra: s.valor_compra,
          valorVenda: s.valor_venda,
          pelagem: s.pelagem,
          pesoAtual: s.peso_atual,
          lote: s.lote,
          categoria: s.categoria,
          obs: s.obs,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          deletedAt: s.deleted_at,
          synced: true,
          remoteId: s.id,
        });
      }
      // bulkPut em lotes de 300 (IndexedDB performa melhor com lotes moderados)
      const BATCH_ANIMAIS = 300;
      for (let i = 0; i < toPut.length; i += BATCH_ANIMAIS) {
        await db.animais.bulkPut(toPut.slice(i, i + BATCH_ANIMAIS));
      }
    }
    const maxUpdatedAnimais = servAnimais?.length
      ? servAnimais.reduce(
          (max, a) =>
            a.updated_at && (!max || a.updated_at > max) ? a.updated_at : max,
          null as string | null,
        )
      : null;
    if (maxUpdatedAnimais) setLastPulledAt("animais_online", maxUpdatedAnimais);
    endSyncStep("Pull Animais", servAnimais?.length || 0);
  } catch (err) {
    console.error("Erro ao fazer pull de animais:", err);
    endSyncStep("Pull Animais", 0);
  }

  // Pull genealogias (paginação + incremental)
  try {
    const { getLastPulledAt: getCheckpoint, setLastPulledAt: setCheckpoint } =
      await import("../utils/syncCheckpoints");

    const lastPulledGenealogias = getCheckpoint("genealogias_online");

    const servGenealogias = await fetchAllPaginated<any>(
      "genealogias_online",
      {
        orderBy: "id",
        updatedAtField: lastPulledGenealogias ? "updated_at" : undefined,
        lastPulledAt: lastPulledGenealogias || undefined,
      },
      syncClient,
    );

    const tiposLocais = await db.tiposAnimal.toArray();
    const tiposLocaisMap = new Map(tiposLocais.map((t) => [t.remoteId, t]));

    const todasGenealogiasLocais = await db.genealogias.toArray();
    const genealogiasLocaisMap = new Map(
      todasGenealogiasLocais.map((g) => [g.id, g]),
    );

    const genealogiasParaInserir: any[] = [];

    if (servGenealogias && servGenealogias.length > 0) {
      for (const s of servGenealogias) {
        const local = genealogiasLocaisMap.get(s.uuid);

        if (local && !local.synced) {
          const servUpdated = s.updated_at
            ? new Date(s.updated_at).getTime()
            : 0;
          const localUpdated = local.updatedAt
            ? new Date(local.updatedAt).getTime()
            : 0;

          const margemTimestamp = 1000;

          if (localUpdated >= servUpdated - margemTimestamp) {
            await db.genealogias.update(local.id, {
              synced: true,
              remoteId: s.id,
            });
            continue;
          }
        }

        if (
          !local ||
          !local.remoteId ||
          (local.updatedAt &&
            new Date(local.updatedAt) < new Date(s.updated_at))
        ) {
          const tipoMatrizLocal = s.tipo_matriz_id
            ? tiposLocaisMap.get(s.tipo_matriz_id)
            : null;

          genealogiasParaInserir.push({
            id: s.uuid,
            animalId: s.animal_id,
            matrizId: s.matriz_id,
            tipoMatrizId: tipoMatrizLocal?.id,
            reprodutorId: s.reprodutor_id,
            avoMaterna: s.avo_materna,
            avoPaterna: s.avo_paterna,
            avoPaternoMaterno: s.avo_materno,
            avoPaternoPatro: s.avo_paterno,
            geracoes: s.geracoes,
            observacoes: s.observacoes,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            deletedAt: s.deleted_at,
            synced: true,
            remoteId: s.id,
          });
        }
      }
    }

    // 🧱 Persistir alterações do servidor
    if (genealogiasParaInserir.length > 0) {
      await db.genealogias.bulkPut(genealogiasParaInserir);
    }

    // 🔧 RECONCILIAÇÃO FINAL — SEMPRE EXECUTA
    const genealogiasPendentes = await db.genealogias
      .filter((g) => g.synced === false && !g.deletedAt)
      .toArray();

    for (const g of genealogiasPendentes) {
      const { data } = await syncClient
        .from("genealogias_online")
        .select("id, updated_at")
        .eq("uuid", g.id)
        .maybeSingle();

      if (data) {
        await db.genealogias.update(g.id, {
          synced: true,
          remoteId: data.id,
          updatedAt: data.updated_at,
        });

        console.log(`✅ Genealogia ${g.id} reconciliada definitivamente`);
      }
    }

    const maxUpdatedGenealogias = servGenealogias?.length
      ? servGenealogias.reduce(
          (max, g) =>
            g.updated_at && (!max || g.updated_at > max) ? g.updated_at : max,
          null as string | null,
        )
      : null;

    if (maxUpdatedGenealogias)
      setCheckpoint("genealogias_online", maxUpdatedGenealogias);
  } catch (err) {
    console.error("Erro ao fazer pull de genealogias:", err);
  }

  // ========================================
  // MÓDULO DE CONFINAMENTO (pull em "Sincronizar Agora")
  // ========================================
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
        localTable: db.confinamentos as any,
        mapper: (s: any) => ({
          id: s.uuid,
          fazendaId:
            remoteIdToFazendaId.get(Number(s.fazenda_id)) ??
            remoteIdToFazendaId.get(s.fazenda_id) ??
            String(s.fazenda_id ?? ""),
          nome: s.nome,
          dataInicio: s.data_inicio,
          dataFimPrevista: s.data_fim_prevista || undefined,
          dataFimReal: s.data_fim_real || undefined,
          status: s.status,
          precoVendaKg:
            s.preco_venda_kg != null ? Number(s.preco_venda_kg) : undefined,
          observacoes: s.observacoes || undefined,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
          deletedAt: s.deleted_at || undefined,
        }),
      },
      syncClient,
    );
    endSyncStep("Pull Confinamentos", n);
    if (n > 0) console.log("✅ Pull Confinamentos:", n, "registro(s)");
  } catch (err: any) {
    console.error(
      "Erro ao processar pull de confinamentos:",
      err?.message ?? err,
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
        localTable: db.confinamentoAnimais as any,
        mapper: (s: any) => ({
          id: s.uuid,
          confinamentoId:
            remoteIdToConfinamentoId.get(Number(s.confinamento_id)) ??
            remoteIdToConfinamentoId.get(s.confinamento_id) ??
            String(s.confinamento_id ?? ""),
          animalId: s.animal_id ?? s.animal_uuid ?? "",
          dataEntrada: s.data_entrada,
          pesoEntrada: s.peso_entrada,
          dataSaida: s.data_saida || undefined,
          pesoSaida: s.peso_saida || undefined,
          motivoSaida: s.motivo_saida || undefined,
          observacoes: s.observacoes || undefined,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
          deletedAt: s.deleted_at || undefined,
        }),
      },
      syncClient,
    );
    endSyncStep("Pull Confinamento Animais", n);
    if (n > 0) console.log("✅ Pull Confinamento Animais:", n, "registro(s)");
  } catch (err: any) {
    console.error(
      "Erro ao processar pull de confinamento_animais:",
      err?.message ?? err,
      err,
    );
    endSyncStep("Pull Confinamento Animais", 0);
  }

  // Pull de confinamentoPesagens removido: usamos tabela geral `pesagens` sincronizada acima

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
        localTable: db.confinamentoAlimentacao as any,
        mapper: (s: any) => ({
          id: s.uuid,
          confinamentoId:
            remoteIdToConfinamentoId.get(Number(s.confinamento_id)) ??
            remoteIdToConfinamentoId.get(s.confinamento_id) ??
            String(s.confinamento_id ?? ""),
          data: s.data,
          tipoDieta: s.tipo_dieta || undefined,
          custoTotal: s.custo_total || undefined,
          observacoes: s.observacoes || undefined,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
          deletedAt: s.deleted_at || undefined,
        }),
      },
      syncClient,
    );
    endSyncStep("Pull Confinamento Alimentação", n);
    if (n > 0)
      console.log("✅ Pull Confinamento Alimentação:", n, "registro(s)");
  } catch (err: any) {
    console.error(
      "Erro ao processar pull de confinamento_alimentacao:",
      err?.message ?? err,
      err,
    );
    endSyncStep("Pull Confinamento Alimentação", 0);
  }

  // Pull ocorrências animal (motor bulk; só executa se a tabela existir no backend — evita 404/PGRST205 no console)
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
            localTable: db.ocorrenciaAnimais as any,
            mapper: (s: any) => ({
              id: s.uuid,
              animalId: s.animal_id ?? "",
              confinamentoAnimalId:
                s.confinamento_animal_id != null
                  ? (remoteIdToConfinamentoAnimalId.get(
                      Number(s.confinamento_animal_id),
                    ) ??
                    remoteIdToConfinamentoAnimalId.get(
                      s.confinamento_animal_id,
                    ))
                  : undefined,
              data: s.data,
              tipo: s.tipo,
              custo: s.custo != null ? Number(s.custo) : undefined,
              observacoes: s.observacoes || undefined,
              createdAt: s.created_at,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id,
            }),
          },
          syncClient,
        );
        if (n > 0) console.log("✅ Pull Ocorrências Animal:", n, "registro(s)");
      } catch (err: any) {
        console.error(
          "Erro ao processar pull de ocorrencia_animais:",
          err?.message ?? err,
        );
      }
    }
  }

  // Pull notificações lidas (Sincronizar Agora)
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
          localTable: db.notificacoesLidas as any,
          mapper: (s: any) => ({
            id: s.uuid,
            tipo: s.tipo,
            usuarioId: s.usuario_uuid || s.usuario_id || "",
            marcadaEm: s.marcada_em,
            synced: true,
            remoteId: s.id,
          }),
        },
        syncClient,
      );
    }
    endSyncStep("Pull Notificações lidas", nNotif);
  } catch (err: any) {
    console.error(
      "Erro ao processar pull de notificações lidas:",
      err?.message,
    );
    endSyncStep("Pull Notificações lidas", 0);
  }

  // Pull auditoria (Sincronizar Agora)
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
        console.error(
          "Erro ao buscar auditoria do servidor:",
          errorAudits?.message ?? errorAudits,
        );
      } else if (servAudits && servAudits.length > 0) {
        const servUuids = new Set(
          servAudits.map((a: any) => a.uuid).filter(Boolean),
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
        const toPut: any[] = [];
        const toUpdate: Array<{ key: string; changes: any }> = [];
        for (const s of servAudits) {
          if (!s.uuid) continue;
          const local = auditsLocaisMap.get(s.uuid);
          const rec = {
            id: s.uuid,
            entity: s.entity,
            entityId: s.entity_id,
            action: s.action,
            timestamp: s.timestamp,
            userId: s.user_uuid || null,
            userNome: s.user_nome || null,
            before: s.before_json ? JSON.stringify(s.before_json) : null,
            after: s.after_json ? JSON.stringify(s.after_json) : null,
            description: s.description || null,
            synced: true,
            remoteId: s.id,
          };
          if (!local) {
            toPut.push(rec);
          } else if (
            !local.remoteId ||
            new Date(local.timestamp) < new Date(s.timestamp)
          ) {
            toUpdate.push({ key: s.uuid, changes: rec });
          }
        }
        if (toPut.length > 0) await db.audits.bulkPut(toPut);
        if (toUpdate.length > 0) await db.audits.bulkUpdate(toUpdate);
        nAudit = toPut.length + toUpdate.length;
      }
    }
    endSyncStep("Pull Auditoria", nAudit);
  } catch (err: any) {
    console.error("Erro ao processar pull de auditoria:", err?.message ?? err);
    endSyncStep("Pull Auditoria", 0);
  }
}

/**
 * Sincroniza apenas usuários do servidor (usado na inicialização / login)
 * Mais rápido que pullUpdates completo
 * IMPORTANTE: Não exclui usuários locais, apenas adiciona/atualiza do servidor
 */
export async function pullUsuarios() {
  try {
    const { data: servUsuarios, error: errorUsuarios } = await supabase
      .from("usuarios_online")
      .select("*");
    if (errorUsuarios) {
      console.error("Erro ao buscar usuários do servidor:", errorUsuarios);
      // Não lançar erro - permitir continuar com dados locais
      return;
    }
    if (servUsuarios && servUsuarios.length > 0) {
      // IMPORTANTE: Não excluir usuários locais nesta função!
      const usuariosLocais = await db.usuarios.toArray();
      const usuariosMap = new Map(usuariosLocais.map((u) => [u.id, u]));
      const toPut: any[] = [];
      const toUpdate: Array<{ key: string; changes: any }> = [];
      for (const s of servUsuarios) {
        const local = usuariosMap.get(s.uuid);
        const rec = {
          id: s.uuid,
          nome: s.nome,
          email: s.email,
          senhaHash: s.senha_hash,
          role: s.role,
          fazendaId: s.fazenda_uuid || undefined,
          ativo: s.ativo,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id,
        };
        if (!local) {
          toPut.push(rec);
        } else if (
          local.remoteId &&
          new Date(local.updatedAt) < new Date(s.updated_at)
        ) {
          toUpdate.push({ key: s.uuid, changes: rec });
        } else if (!local.remoteId) {
          toUpdate.push({
            key: s.uuid,
            changes: {
              synced: true,
              remoteId: s.id,
              updatedAt:
                s.updated_at > local.updatedAt ? s.updated_at : local.updatedAt,
            },
          });
        }
      }
      if (toPut.length > 0) await db.usuarios.bulkPut(toPut);
      if (toUpdate.length > 0) await db.usuarios.bulkUpdate(toUpdate);
    }
    // Se servUsuarios for null ou vazio, não fazer nada (preservar dados locais)
  } catch (err) {
    console.error("Erro ao processar pull de usuários:", err);
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
    const { showToast } = await import("../utils/toast");
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

  console.log("🚀 ========================================");
  console.log("🚀 INICIANDO SINCRONIZAÇÃO COMPLETA");
  console.log("🚀 ========================================");

  if (typeof window !== "undefined") {
    const { setGlobalSyncing } = await import("../utils/syncState");
    setGlobalSyncing(true);
  }

  try {
    const syncClient = await getSupabaseForSync();
    if (!syncClient) {
      throw new Error(
        "Sessão não disponível. Faça login com Supabase Auth e tente sincronizar novamente.",
      );
    }

    // IMPORTANTE: Fazer pull ANTES do push para evitar conflitos de timestamp
    await pullUpdates(syncClient);
    await pushPending();

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

      console.log("✅ ========================================");
      console.log(`✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO`);
      console.log(
        `✅ Tempo total: ${(currentSyncStats.duration / 1000).toFixed(2)}s`,
      );
      console.log(`✅ Total de registros processados: ${totalRecords}`);
      console.log("✅ ========================================");

      // Detalhes por etapa
      const stepsWithData = Object.entries(currentSyncStats.steps).filter(
        ([, step]) => step.recordsProcessed > 0,
      );

      if (stepsWithData.length > 0) {
        console.log("📊 Detalhes por etapa:");
        stepsWithData.forEach(([name, step]) => {
          const duration = step.duration
            ? (step.duration / 1000).toFixed(2)
            : "?";
          console.log(
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
      console.warn(
        "[Sync] PGRST301: O servidor rejeitou o request. Use Supabase Auth (signInWithPassword) e políticas RLS com auth.uid().",
      );
    }
    console.error("❌ ========================================");
    console.error("❌ ERRO DURANTE SINCRONIZAÇÃO");
    console.error("❌ ========================================");
    console.error("❌ Detalhes:", error);

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
      const { setGlobalSyncing } = await import("../utils/syncState");
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
    const { clearLastPulledAt } = await import("../utils/syncCheckpoints");
    clearLastPulledAt(); // Limpa todos os checkpoints = full pull em todas as tabelas
  }
  return syncAll();
}
