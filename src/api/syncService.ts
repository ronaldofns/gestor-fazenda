import { db } from '../db/dexieDB';
import { supabase } from './supabaseClient';
import { processSyncQueue } from '../utils/syncEvents';
import { pullEntity, pullEntitySimple, fetchAllPaginated } from './syncEngine';
import { formatDateBR } from '../utils/date';
import { converterDataParaFormatoBanco } from '../utils/dateInput';

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
function emitSyncProgress(step: string, current: number, total: number, message: string) {
  if (typeof window !== 'undefined') {
    const progress: SyncProgress = {
      step,
      current,
      total,
      message,
      timestamp: Date.now()
    };
    window.dispatchEvent(new CustomEvent('syncProgress', { detail: progress }));
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
      steps: {}
    };
  }
  currentSyncStats.steps[stepName] = {
    startTime: Date.now(),
    recordsProcessed: 0
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
    console.log(`✅ ${stepName}: ${recordsProcessed} registros em ${(step.duration / 1000).toFixed(2)}s`);
  }
}

/**
 * Retorna as estatísticas da sincronização atual
 */
export function getCurrentSyncStats(): SyncStats | null {
  return currentSyncStats;
}

/**
 * Função helper para buscar todos os registros de uma tabela do Supabase com paginação
 * O Supabase PostgREST limita a 1000 registros por padrão
 */
async function fetchAllFromSupabase(tableName: string, orderBy: string = 'id'): Promise<any[]> {
  let allRecords: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: page, error } = await supabase
      .from(tableName)
      .select('*')
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

function toIsoDate(dateStr?: string | null) {
  if (!dateStr) return null;
  // já está em ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
  // dd/mm/aaaa
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (dd && mm && yyyy && dd.length <= 2 && mm.length <= 2 && yyyy.length === 4) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }
  // fallback: devolver original
  return dateStr;
}

/** Tabelas antigas (nascimentos, matrizes) — desativado: uso apenas animais/genealogias. */
const SYNC_LEGACY_NASCIMENTOS_MATRIZES = false;

export async function pushPending() {
  // Processar fila de eventos de sincronização primeiro (se houver)
  try {
    const queueResults = await processSyncQueue();
    if (queueResults.processados > 0) {
      console.log(`📦 Fila de eventos: ${queueResults.sucesso} sucesso, ${queueResults.falhas} falhas`);
    }
  } catch (err) {
    console.error('Erro ao processar fila de eventos:', err);
  }

  // Sincronizar exclusões pendentes primeiro
  try {
    // Verificar se a tabela deletedRecords existe (pode não existir em versões antigas do banco)
    if (db.deletedRecords) {
      // Query mais segura: buscar todos e filtrar manualmente para evitar erros com dados inválidos
      const todasExclusoes = await db.deletedRecords.toArray();
      const deletedRecords = todasExclusoes.filter(d => d.synced === false);
      for (const deleted of deletedRecords) {
        try {
          // Se tem remoteId, tentar excluir no servidor
          if (deleted.remoteId) {
            let sucesso = false;
            let ultimoErro = null;
            
            // Tentar excluir de cada tabela sequencialmente
            const tabelas = [
              'vacinacoes_online',
              'pesagens_online',
              'nascimentos_online',
              'animais_online'
            ];
            
            for (const tabela of tabelas) {
              const { error } = await supabase.from(tabela).delete().eq('id', deleted.remoteId);
              if (!error) {
                sucesso = true;
                break;
              } else if (error.code === 'PGRST116' || error.message?.includes('No rows') || error.message?.includes('not found')) {
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
                  .from('animais_online')
                  .update({ deleted_at: animal.deletedAt })
                  .eq('id', animal.remoteId);
                
                if (!updateError) {
                  sucesso = true;
                  console.log(`✅ Soft delete aplicado para animal ${deleted.uuid}`);
                } else {
                  console.error('Erro ao fazer soft delete de animal:', updateError);
                  ultimoErro = updateError;
                }
              }
            }
            
            if (sucesso) {
              await db.deletedRecords.update(deleted.id, { synced: true });
            } else if (ultimoErro) {
              console.error('Erro ao sincronizar exclusão no servidor:', ultimoErro, deleted.uuid);
            }
            continue;
          } else {
            // Se não tem remoteId, nunca foi ao servidor, então já está "sincronizado"
            await db.deletedRecords.update(deleted.id, { synced: true });
          }
        } catch (err) {
          console.error('Erro ao processar exclusão pendente:', err, deleted.uuid);
        }
      }
    }
  } catch (err) {
    console.error('Erro geral ao sincronizar exclusões:', err);
  }

  // Sincronizar categorias, raças e fazendas em paralelo (bulk upsert + bulkUpdate)
  const PUSH_BATCH = 100;
  await Promise.all([
    // Sincronizar categorias
    (async () => {
      try {
        const todasCategorias = await db.categorias.toArray();
        const pendCategorias = todasCategorias.filter(c => c.synced === false);
        for (let i = 0; i < pendCategorias.length; i += PUSH_BATCH) {
          const batch = pendCategorias.slice(i, i + PUSH_BATCH);
          const payload = batch.map(c => ({
            uuid: c.id,
            nome: c.nome,
            created_at: c.createdAt,
            updated_at: c.updatedAt
          }));
          const { data, error } = await supabase
            .from('categorias_online')
            .upsert(payload, { onConflict: 'uuid' })
            .select('id, uuid');
          if (!error && data?.length) {
            const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
            const updates = batch
              .map(c => {
                const remoteId = uuidToRemoteId.get(c.id);
                return remoteId != null ? { key: c.id, changes: { synced: true, remoteId } } : null;
              })
              .filter((u): u is NonNullable<typeof u> => u !== null);
            if (updates.length > 0) await db.categorias.bulkUpdate(updates);
          } else if (error) {
            console.error('Erro ao sincronizar categorias:', error?.message, error?.details);
          }
        }
      } catch (err) {
        console.error('Erro geral ao fazer push de categorias:', err);
      }
    })(),
    // Sincronizar raças
    (async () => {
      try {
        const todasRacas = await db.racas.toArray();
        const pendRacas = todasRacas.filter(r => r.synced === false);
        for (let i = 0; i < pendRacas.length; i += PUSH_BATCH) {
          const batch = pendRacas.slice(i, i + PUSH_BATCH);
          const payload = batch.map(r => ({
            uuid: r.id,
            nome: r.nome,
            created_at: r.createdAt,
            updated_at: r.updatedAt
          }));
          const { data, error } = await supabase
            .from('racas_online')
            .upsert(payload, { onConflict: 'uuid' })
            .select('id, uuid');
          if (!error && data?.length) {
            const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
            const updates = batch
              .map(r => {
                const remoteId = uuidToRemoteId.get(r.id);
                return remoteId != null ? { key: r.id, changes: { synced: true, remoteId } } : null;
              })
              .filter((u): u is NonNullable<typeof u> => u !== null);
            if (updates.length > 0) await db.racas.bulkUpdate(updates);
          } else if (error) {
            console.error('Erro ao sincronizar raças:', error?.message, error?.details);
          }
        }
      } catch (err) {
        console.error('Erro geral ao fazer push de raças:', err);
      }
    })(),
    // Sincronizar fazendas
    (async () => {
      try {
        const todasFazendas = await db.fazendas.toArray();
        const pendFaz = todasFazendas.filter(f => f.synced === false);
        for (let i = 0; i < pendFaz.length; i += PUSH_BATCH) {
          const batch = pendFaz.slice(i, i + PUSH_BATCH);
          const payload = batch.map(f => ({
            uuid: f.id,
            nome: f.nome,
            logo_url: f.logoUrl,
            created_at: f.createdAt,
            updated_at: f.updatedAt
          }));
          const { data, error } = await supabase
            .from('fazendas_online')
            .upsert(payload, { onConflict: 'uuid' })
            .select('id, uuid');
          if (!error && data?.length) {
            const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
            const updates = batch
              .map(f => {
                const remoteId = uuidToRemoteId.get(f.id);
                return remoteId != null ? { key: f.id, changes: { synced: true, remoteId } } : null;
              })
              .filter((u): u is NonNullable<typeof u> => u !== null);
            if (updates.length > 0) await db.fazendas.bulkUpdate(updates);
          } else if (error) {
            console.error('Erro ao sincronizar fazendas:', error?.message, error?.details);
          }
        }
      } catch (err) {
        console.error('Erro geral ao fazer push de fazendas:', err);
      }
    })()
  ]);

  // Sincronizar matrizes (vacas/novilhas) — desativado: uso apenas animais
  if (SYNC_LEGACY_NASCIMENTOS_MATRIZES) {
  try {
    const todasMatrizes = await db.matrizes.toArray();
    const pendMatrizes = todasMatrizes.filter(m => m.synced === false);

    for (const m of pendMatrizes) {
      try {
        // Verificar se a fazenda existe no Supabase antes de sincronizar
        if (!m.fazendaId) {
          console.warn('Matriz sem fazendaId, pulando sincronização:', m.id, m.identificador);
          continue;
        }

        // Verificar se a fazenda está sincronizada
        const fazenda = await db.fazendas.get(m.fazendaId);
        if (!fazenda) {
          console.warn('Fazenda não encontrada para matriz, pulando sincronização:', m.id, m.identificador, m.fazendaId);
          continue;
        }

        // Se a fazenda não está sincronizada, tentar sincronizar primeiro
        if (!fazenda.synced) {
          // Não sincronizamos aqui para evitar recursão
          // A fazenda será sincronizada em outra chamada
        }

        // Obter categoriaId (pode ser categoriaId ou categoria antiga)
        const categoriaId = (m as any).categoriaId || (m as any).categoria || '';
        
        // Se categoriaId está vazio, tentar buscar categoria padrão baseada no identificador
        // ou usar null (será SET NULL pela foreign key)
        let categoriaUuidFinal: string | null = null;
        if (categoriaId) {
          // Verificar se a categoria existe no banco local
          const categoriaLocal = await db.categorias.get(categoriaId);
          if (categoriaLocal) {
            categoriaUuidFinal = categoriaId; // O ID já é o UUID
          }
        }
        
        // Buscar UUID da raça baseado no nome (se houver raça)
        let racaUuid: string | null = null;
        if (m.raca) {
          const racaEncontrada = await db.racas.where('nome').equals(m.raca).first();
          if (racaEncontrada) {
            racaUuid = racaEncontrada.id;
          }
        }
        
        const { data, error } = await supabase
          .from('matrizes_online')
          .upsert(
            {
              uuid: m.id,
              identificador: m.identificador,
              fazenda_uuid: m.fazendaId,
              categoria_uuid: categoriaUuidFinal, // Pode ser null se não encontrar
              raca: m.raca || null, // Mantido para compatibilidade
              raca_uuid: racaUuid, // UUID para foreign key
              data_nascimento: toIsoDate(m.dataNascimento),
              pai: m.pai || null,
              mae: m.mae || null,
              ativo: m.ativo,
              created_at: m.createdAt,
              updated_at: m.updatedAt
            },
            { onConflict: 'uuid' }
          )
          .select('id, uuid');

        if (!error && data && data.length) {
          await db.matrizes.update(m.id, { synced: true, remoteId: data[0].id });
        } else if (error) {
          console.error('Erro ao sincronizar matriz:', {
            error,
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            matrizId: m.id,
            identificador: m.identificador,
            fazendaId: m.fazendaId,
            categoriaId: categoriaUuidFinal
          });
        }
      } catch (err) {
        console.error('Erro ao processar matriz:', err, m.id);
      }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de matrizes:', err);
  }
  }

  // Sincronizar nascimentos — desativado: uso apenas animais
  if (SYNC_LEGACY_NASCIMENTOS_MATRIZES) {
  try {
    // Query mais segura: buscar todos e filtrar manualmente
    const todosNascimentos = await db.nascimentos.toArray();
    const pendNasc = todosNascimentos.filter(n => {
      // Filtrar apenas registros válidos com os campos obrigatórios
      return n.synced === false && 
             n.fazendaId && 
             n.mes && 
             n.ano && 
             n.matrizId;
    });
    
  for (const n of pendNasc) {
      try {
        // Buscar UUID da raça baseado no nome (se houver raça)
        let racaUuid: string | null = null;
        if (n.raca) {
          const racaEncontrada = await db.racas.where('nome').equals(n.raca).first();
          if (racaEncontrada) {
            racaUuid = racaEncontrada.id;
          }
        }
        
    const { data, error } = await supabase
      .from('nascimentos_online')
      .upsert(
        {
          uuid: n.id,
          fazenda_uuid: n.fazendaId,
          matriz_id: n.matrizId,
          mes: n.mes,
          ano: n.ano,
          novilha: n.novilha || false,
          vaca: n.vaca || false,
          brinco_numero: n.brincoNumero,
          data_nascimento: toIsoDate(n.dataNascimento),
          sexo: n.sexo,
          raca: n.raca, // Mantido para compatibilidade
          raca_uuid: racaUuid, // UUID para foreign key
          obs: n.obs,
          morto: n.morto || false,
          created_at: n.createdAt,
          updated_at: n.updatedAt
        },
        { onConflict: 'uuid' }
      )
      .select('id, uuid');

    if (!error && data && data.length) {
      await db.nascimentos.update(n.id, { synced: true, remoteId: data[0].id });
        } else if (error) {
          console.error('Erro ao sincronizar nascimento:', error, n.id);
        }
      } catch (err) {
        console.error('Erro ao processar nascimento:', err, n.id);
      }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de nascimentos:', err);
    throw err;
  }
  }

  try {
    const todasDesmamas = await db.desmamas.toArray();
    const pendDesm = todasDesmamas.filter(d => d.synced === false);
    for (let i = 0; i < pendDesm.length; i += PUSH_BATCH) {
      const batch = pendDesm.slice(i, i + PUSH_BATCH);
      const payload = batch.map(d => ({
        uuid: d.id,
        nascimento_uuid: d.nascimentoId,
        animal_id: d.animalId || null,
        data_desmama: toIsoDate(d.dataDesmama),
        peso_desmama: d.pesoDesmama,
        created_at: d.createdAt,
        updated_at: d.updatedAt
      }));
      const { data, error } = await supabase
        .from('desmamas_online')
        .upsert(payload, { onConflict: 'uuid' })
        .select('id, uuid');
      if (!error && data?.length) {
        const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
        const updates = batch
          .map(d => {
            const remoteId = uuidToRemoteId.get(d.id);
            return remoteId != null ? { key: d.id, changes: { synced: true, remoteId } } : null;
          })
          .filter((u): u is NonNullable<typeof u> => u !== null);
        if (updates.length > 0) await db.desmamas.bulkUpdate(updates);
      } else if (error) {
        console.error('Erro ao sincronizar desmamas:', error?.message, error?.details);
      }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de desmamas:', err);
    throw err;
  }

  // Sincronizar pesagens e vacinações em paralelo (tabelas independentes)
  await Promise.all([
    // Sincronizar pesagens (bulk)
    (async () => {
      try {
        const todasPesagens = await db.pesagens.toArray();
        const pendPesagens = todasPesagens.filter(p => {
          if (p.synced) return false;
          if (!p.nascimentoId && !p.animalId) {
            console.error('Pesagem sem nascimentoId nem animalId, ignorando:', p.id);
            return false;
          }
          const dataFormatada = toIsoDate(p.dataPesagem);
          if (!dataFormatada) {
            console.error('Pesagem sem data válida, ignorando:', p.id);
            return false;
          }
          return true;
        });
        if (pendPesagens.length > 0) {
          console.log(`📊 Sincronizando ${pendPesagens.length} pesagem(ns) pendente(s)`);
        }
        for (let i = 0; i < pendPesagens.length; i += PUSH_BATCH) {
          const batch = pendPesagens.slice(i, i + PUSH_BATCH);
          const payload = batch.map(p => ({
            uuid: p.id,
            nascimento_id: p.nascimentoId || null,
            animal_id: p.animalId || null,
            data_pesagem: toIsoDate(p.dataPesagem)!,
            peso: p.peso,
            observacao: p.observacao || null,
            created_at: p.createdAt,
            updated_at: p.updatedAt
          }));
          const { data, error } = await supabase
            .from('pesagens_online')
            .upsert(payload, { onConflict: 'uuid' })
            .select('id, uuid');
          if (!error && data?.length) {
            const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
            const updates = batch
              .map(p => {
                const remoteId = uuidToRemoteId.get(p.id);
                return remoteId != null ? { key: p.id, changes: { synced: true, remoteId } } : null;
              })
              .filter((u): u is NonNullable<typeof u> => u !== null);
            if (updates.length > 0) await db.pesagens.bulkUpdate(updates);
          } else if (error) {
            console.error('❌ Erro ao sincronizar pesagens:', error?.message, error?.details);
          }
        }
      } catch (err) {
        console.error('❌ Erro geral ao fazer push de pesagens:', err);
      }
    })(),
    // Sincronizar vacinações (bulk)
    (async () => {
      try {
        const todasVacinacoes = await db.vacinacoes.toArray();
        const pendVacinacoes = todasVacinacoes.filter(v => v.synced === false);
        for (let i = 0; i < pendVacinacoes.length; i += PUSH_BATCH) {
          const batch = pendVacinacoes.slice(i, i + PUSH_BATCH);
          const payload = batch.map(v => ({
            uuid: v.id,
            nascimento_id: v.nascimentoId || null,
            animal_id: v.animalId || null,
            vacina: v.vacina,
            data_aplicacao: toIsoDate(v.dataAplicacao),
            data_vencimento: v.dataVencimento ? toIsoDate(v.dataVencimento) : null,
            lote: v.lote || null,
            responsavel: v.responsavel || null,
            observacao: v.observacao || null,
            created_at: v.createdAt,
            updated_at: v.updatedAt
          }));
          const { data, error } = await supabase
            .from('vacinacoes_online')
            .upsert(payload, { onConflict: 'uuid' })
            .select('id, uuid');
          if (!error && data?.length) {
            const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
            const updates = batch
              .map(v => {
                const remoteId = uuidToRemoteId.get(v.id);
                return remoteId != null ? { key: v.id, changes: { synced: true, remoteId } } : null;
              })
              .filter((u): u is NonNullable<typeof u> => u !== null);
            if (updates.length > 0) await db.vacinacoes.bulkUpdate(updates);
          } else if (error) {
            if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('Could not find the table')) {
              console.warn('Tabela vacinacoes_online não existe no servidor. Execute a migração 024_add_vacinacoes_online.sql no Supabase.');
              break;
            }
            console.error('Erro ao sincronizar vacinações:', error?.message, error?.details);
          }
        }
      } catch (err: any) {
        if (err?.code === 'PGRST205' || err?.code === '42P01' || err?.message?.includes('Could not find the table')) {
          console.warn('Tabela vacinacoes_online não existe no servidor. Execute a migração 024_add_vacinacoes_online.sql no Supabase.');
        } else {
          console.error('Erro geral ao fazer push de vacinações:', err);
        }
      }
    })()
  ]);

  // Sincronizar usuários (bulk)
  try {
    const todosUsuarios = await db.usuarios.toArray();
    const pendUsuarios = todosUsuarios.filter(u => u.synced === false);
    for (let i = 0; i < pendUsuarios.length; i += PUSH_BATCH) {
      const batch = pendUsuarios.slice(i, i + PUSH_BATCH);
      const payload = batch.map(u => ({
        uuid: u.id,
        nome: u.nome,
        email: u.email,
        senha_hash: u.senhaHash,
        role: u.role,
        fazenda_uuid: u.fazendaId || null,
        ativo: u.ativo,
        created_at: u.createdAt,
        updated_at: u.updatedAt
      }));
      const { data, error } = await supabase
        .from('usuarios_online')
        .upsert(payload, { onConflict: 'uuid' })
        .select('id, uuid');
      if (!error && data?.length) {
        const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
        const updates = batch
          .map(u => {
            const remoteId = uuidToRemoteId.get(u.id);
            return remoteId != null ? { key: u.id, changes: { synced: true, remoteId } } : null;
          })
          .filter((u): u is NonNullable<typeof u> => u !== null);
        if (updates.length > 0) await db.usuarios.bulkUpdate(updates);
      } else if (error) {
        console.error('Erro ao sincronizar usuários:', error?.message, error?.details);
      }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de usuários:', err);
    throw err;
  }

  // Sincronizar auditoria (bulk - somente push)
  try {
    if (db.audits) {
      const todosAudits = await db.audits.toArray();
      const pendAudits = todosAudits.filter((a) => a.synced === false);
      for (let i = 0; i < pendAudits.length; i += PUSH_BATCH) {
        const batch = pendAudits.slice(i, i + PUSH_BATCH);
        const payload = batch.map(a => ({
          uuid: a.id,
          entity: a.entity,
          entity_id: a.entityId,
          action: a.action,
          timestamp: a.timestamp,
          user_uuid: a.userId || null,
          user_nome: a.userNome || null,
          before_json: a.before ? JSON.parse(a.before) : null,
          after_json: a.after ? JSON.parse(a.after) : null,
          description: a.description || null,
          created_at: a.timestamp
        }));
        const { data, error } = await supabase
          .from('audits_online')
          .upsert(payload, { onConflict: 'uuid' })
          .select('id, uuid');
        if (!error && data?.length) {
          const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
          const updates = batch
            .map(a => {
              const remoteId = uuidToRemoteId.get(a.id);
              return remoteId != null ? { key: a.id, changes: { synced: true, remoteId } } : null;
            })
            .filter((u): u is NonNullable<typeof u> => u !== null);
          if (updates.length > 0) await db.audits.bulkUpdate(updates);
        } else if (error) {
          console.error('Erro ao sincronizar auditoria:', error?.message, error?.details);
        }
      }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de auditoria:', err);
  }

  // Sincronizar notificações lidas (bulk)
  try {
    if (db.notificacoesLidas) {
      const todasNotificacoes = await db.notificacoesLidas.toArray();
      const pendNotificacoes = todasNotificacoes.filter(n => n.synced === false);
      for (let i = 0; i < pendNotificacoes.length; i += PUSH_BATCH) {
        const batch = pendNotificacoes.slice(i, i + PUSH_BATCH);
        const payload = batch.map(n => ({
          uuid: n.id,
          tipo: n.tipo,
          marcada_em: n.marcadaEm,
          created_at: n.marcadaEm,
          updated_at: n.marcadaEm
        }));
        const { data, error } = await supabase
          .from('notificacoes_lidas_online')
          .upsert(payload, { onConflict: 'uuid' })
          .select('id, uuid');
        if (!error && data?.length) {
          const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
          const updates = batch
            .map(n => {
              const remoteId = uuidToRemoteId.get(n.id);
              return remoteId != null ? { key: n.id, changes: { synced: true, remoteId } } : null;
            })
            .filter((u): u is NonNullable<typeof u> => u !== null);
          if (updates.length > 0) await db.notificacoesLidas.bulkUpdate(updates);
        } else if (error) {
          console.error('Erro ao sincronizar notificações lidas:', error?.message, error?.details, error?.hint);
          // Se a constraint CHECK falhar, o tipo pode não estar permitido no banco (ex: peso, vacina).
          // Migration 049 corrige isso.
        }
      }
    }
  } catch (err: any) {
    console.error('Erro geral ao fazer push de notificações lidas:', err?.message, err?.stack);
  }

  // Sincronizar configurações de alerta (bulk)
  try {
    if (db.alertSettings) {
      const todasSettings = await db.alertSettings.toArray();
      const pendSettings = todasSettings.filter(s => s.synced === false);
      const now = new Date().toISOString();
      for (let i = 0; i < pendSettings.length; i += PUSH_BATCH) {
        const batch = pendSettings.slice(i, i + PUSH_BATCH);
        const payload = batch.map(s => ({
          uuid: s.id,
          limite_meses_desmama: s.limiteMesesDesmama,
          janela_meses_mortalidade: s.janelaMesesMortalidade,
          limiar_mortalidade: s.limiarMortalidade,
          created_at: s.createdAt || now,
          updated_at: now
        }));
        const { data, error } = await supabase
          .from('alert_settings_online')
          .upsert(payload, { onConflict: 'uuid' })
          .select('id, uuid, updated_at');
        if (!error && data?.length) {
          const uuidToData = new Map(data.map((d: any) => [d.uuid, d]));
          const updates = batch
            .map(s => {
              const d = uuidToData.get(s.id);
              if (!d) return null;
              return { key: s.id, changes: { synced: true, remoteId: d.id, updatedAt: d.updated_at || now } };
            })
            .filter((u): u is NonNullable<typeof u> => u !== null);
          if (updates.length > 0) await db.alertSettings.bulkUpdate(updates);
        } else if (error) {
          console.error('Erro ao sincronizar alert settings:', error?.message, error?.details);
        }
      }
    }
  } catch (err: any) {
    console.error('Erro geral ao fazer push de configurações de alerta:', err?.message, err?.stack);
  }

  // Sincronizar configurações do app (bulk)
  try {
    if (db.appSettings) {
      const todasSettings = await db.appSettings.toArray();
      const pendSettings = todasSettings.filter(s => s.synced === false);
      const now = new Date().toISOString();
      for (let i = 0; i < pendSettings.length; i += PUSH_BATCH) {
        const batch = pendSettings.slice(i, i + PUSH_BATCH);
        const payload = batch.map(s => ({
          uuid: s.id,
          timeout_inatividade: s.timeoutInatividade,
          intervalo_sincronizacao: s.intervaloSincronizacao ?? 30,
          primary_color: s.primaryColor || 'gray',
          created_at: s.createdAt || now,
          updated_at: now
        }));
        const { data, error } = await supabase
          .from('app_settings_online')
          .upsert(payload, { onConflict: 'uuid' })
          .select('id, uuid, updated_at');
        if (!error && data?.length) {
          const uuidToData = new Map(data.map((d: any) => [d.uuid, d]));
          const updates = batch
            .map(s => {
              const d = uuidToData.get(s.id);
              if (!d) return null;
              return { key: s.id, changes: { synced: true, remoteId: d.id, updatedAt: d.updated_at || now } };
            })
            .filter((u): u is NonNullable<typeof u> => u !== null);
          if (updates.length > 0) await db.appSettings.bulkUpdate(updates);
        } else if (error) {
          console.error('Erro ao sincronizar app settings:', error?.message, error?.details);
        }
      }
    }
  } catch (err: any) {
    console.error('Erro geral ao fazer push de configurações do app:', err?.message, err?.stack);
  }

  // Sincronizar permissões por role (otimizado com batch upsert)
  try {
    if (db.rolePermissions) {
      const todasPermissoes = await db.rolePermissions.toArray();
      const pendPermissoes = todasPermissoes.filter((p) => p.synced === false);

      if (pendPermissoes.length === 0) {
        // Sem permissões pendentes
      } else {

      // Preparar dados para batch upsert
      const dadosParaUpsert = pendPermissoes.map(p => ({
        uuid: p.id,
        role: p.role,
        permission: p.permission,
        granted: p.granted,
        created_at: p.createdAt,
        updated_at: p.updatedAt
      }));

      // Fazer batch upsert (muito mais rápido que múltiplos upserts individuais)
      const { data, error } = await supabase
        .from('role_permissions_online')
        .upsert(dadosParaUpsert, { onConflict: 'role,permission' })
        .select('id, uuid');

      if (!error && data && data.length) {
        // Criar mapa de uuid -> remoteId para atualização rápida
        const uuidToRemoteId = new Map<string, number>();
        data.forEach((item: any) => {
          if (item.uuid && item.id) {
            uuidToRemoteId.set(item.uuid, item.id);
          }
        });

        // Atualizar todas as permissões sincronizadas de uma vez (bulkUpdate)
        const updates = pendPermissoes
          .map(p => {
            const remoteId = uuidToRemoteId.get(p.id);
            return remoteId != null ? { key: p.id, changes: { synced: true, remoteId } } : null;
          })
          .filter((u): u is NonNullable<typeof u> => u !== null);
        if (updates.length > 0) await db.rolePermissions.bulkUpdate(updates);
      } else if (error) {
        console.error('Erro ao sincronizar permissões em lote:', {
          message: error.message || 'Erro desconhecido',
          code: error.code || 'Sem código',
          count: pendPermissoes.length
        });
        // Em caso de erro no batch, tentar individualmente como fallback
        for (const p of pendPermissoes) {
          try {
            const { data: singleData, error: singleError } = await supabase
              .from('role_permissions_online')
              .upsert(
                {
                  uuid: p.id,
                  role: p.role,
                  permission: p.permission,
                  granted: p.granted,
                  created_at: p.createdAt,
                  updated_at: p.updatedAt
                },
                { onConflict: 'role,permission' }
              )
              .select('id, uuid');

            if (!singleError && singleData && singleData.length) {
              await db.rolePermissions.update(p.id, { synced: true, remoteId: singleData[0].id });
            }
          } catch (err) {
            console.error('Erro ao processar permissão individual:', err, p.id);
          }
        }
      }
    }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de permissões:', err);
  }

  // Sincronizar tags (otimizado com batch upsert)
  try {
    if (db.tags) {
      const todasTags = await db.tags.toArray();
      const pendTags = todasTags.filter(t => t.synced === false); // Incluir deletadas também

      if (pendTags.length > 0) {
        
        const dadosParaUpsert = pendTags.map(t => ({
          id: t.id,
          name: t.name,
          color: t.color,
          description: t.description || null,
          category: t.category || null,
          created_by: t.createdBy,
          created_at: t.createdAt,
          updated_at: t.updatedAt,
          deleted_at: t.deletedAt || null,
          usage_count: t.usageCount
        }));

        const { data, error } = await supabase
          .from('tags')
          .upsert(dadosParaUpsert, { onConflict: 'id' })
          .select('id');

        if (!error && data) {
          await Promise.all(
            pendTags.map(t => db.tags.update(t.id, { synced: true, remoteId: t.id }))
          );
        } else if (error) {
          console.error('Erro ao sincronizar tags:', error);
        }
      }
    }

    // Sincronizar atribuições de tags
    if (db.tagAssignments) {
      const todasAssignments = await db.tagAssignments.toArray();
      const pendAssignments = todasAssignments.filter(a => a.synced === false);

      if (pendAssignments.length > 0) {
        const dadosParaUpsert = pendAssignments.map(a => ({
          id: a.id,
          entity_id: a.entityId,
          entity_type: a.entityType,
          tag_id: a.tagId,
          assigned_by: a.assignedBy,
          created_at: a.createdAt,
          updated_at: a.updatedAt,
          deleted_at: a.deletedAt || null
        }));

        const { data, error } = await supabase
          .from('tag_assignments')
          .upsert(dadosParaUpsert, { onConflict: 'id' })
          .select('id');

        if (!error && data) {
          await Promise.all(
            pendAssignments.map(a => db.tagAssignments.update(a.id, { synced: true, remoteId: a.id }))
          );
        } else if (error) {
          console.error('Erro ao sincronizar atribuições de tags:', error);
        }
      }
    }
  } catch (err) {
    console.error('Erro geral ao sincronizar tags:', err);
  }

  // ========================================
  // SINCRONIZAR SISTEMA DE ANIMAIS
  // ========================================

  // Sincronizar tipos de animal, status de animal e origens em paralelo (tabelas independentes)
  await Promise.all([
    // Sincronizar tipos de animal
    (async () => {
      try {
        if (db.tiposAnimal) {
          const todosTipos = await db.tiposAnimal.toArray();
          const pendTipos = todosTipos.filter(t => t.synced === false);

          if (pendTipos.length > 0) {
            const dadosTipos = pendTipos.map(t => ({
              id: t.remoteId || undefined,
              uuid: t.id,
              nome: t.nome,
              descricao: t.descricao || null,
              ordem: t.ordem || 0,
              ativo: t.ativo,
              created_at: t.createdAt,
              updated_at: t.updatedAt,
              deleted_at: t.deletedAt || null
            }));

            const { data, error } = await supabase
              .from('tipos_animal_online')
              .upsert(dadosTipos, {
                onConflict: 'uuid',
                ignoreDuplicates: false
              })
              .select('id, uuid');

            if (!error && data?.length) {
              const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
              const updates = pendTipos
                .map(t => {
                  const remoteId = uuidToRemoteId.get(t.id);
                  return remoteId != null ? { key: t.id, changes: { remoteId, synced: true } } : null;
                })
                .filter((u): u is NonNullable<typeof u> => u !== null);
              if (updates.length > 0) await db.tiposAnimal.bulkUpdate(updates);
            } else if (error) {
              console.error('❌ Erro ao sincronizar tipos de animal:', error);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao sincronizar tipos de animal:', err);
      }
    })(),
    // Sincronizar status de animal
    (async () => {
      try {
        if (db.statusAnimal) {
          const todosStatus = await db.statusAnimal.toArray();
          const pendStatus = todosStatus.filter(s => s.synced === false);

          if (pendStatus.length > 0) {
            const dadosStatus = pendStatus.map(s => ({
              id: s.remoteId || undefined,
              uuid: s.id,
              nome: s.nome,
              cor: s.cor || null,
              descricao: s.descricao || null,
              ordem: s.ordem || 0,
              ativo: s.ativo,
              created_at: s.createdAt,
              updated_at: s.updatedAt,
              deleted_at: s.deletedAt || null
            }));

            const { data, error } = await supabase
              .from('status_animal_online')
              .upsert(dadosStatus, {
                onConflict: 'uuid',
                ignoreDuplicates: false
              })
              .select('id, uuid');

            if (!error && data?.length) {
              const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
              const updates = pendStatus
                .map(s => {
                  const remoteId = uuidToRemoteId.get(s.id);
                  return remoteId != null ? { key: s.id, changes: { remoteId, synced: true } } : null;
                })
                .filter((u): u is NonNullable<typeof u> => u !== null);
              if (updates.length > 0) await db.statusAnimal.bulkUpdate(updates);
            } else if (error) {
              console.error('❌ Erro ao sincronizar status de animal:', error);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao sincronizar status de animal:', err);
      }
    })(),
    // Sincronizar origens
    (async () => {
      try {
        if (db.origens) {
          const todasOrigens = await db.origens.toArray();
          const pendOrigens = todasOrigens.filter(o => o.synced === false);

          if (pendOrigens.length > 0) {
            const dadosOrigens = pendOrigens.map(o => ({
              id: o.remoteId || undefined,
              uuid: o.id,
              nome: o.nome,
              descricao: o.descricao || null,
              ordem: o.ordem || 0,
              ativo: o.ativo,
              created_at: o.createdAt,
              updated_at: o.updatedAt,
              deleted_at: o.deletedAt || null
            }));

            const { data, error } = await supabase
              .from('origens_online')
              .upsert(dadosOrigens, {
                onConflict: 'uuid',
                ignoreDuplicates: false
              })
              .select('id, uuid');

            if (!error && data?.length) {
              const uuidToRemoteId = new Map(data.map((d: any) => [d.uuid, d.id]));
              const updates = pendOrigens
                .map(o => {
                  const remoteId = uuidToRemoteId.get(o.id);
                  return remoteId != null ? { key: o.id, changes: { remoteId, synced: true } } : null;
                })
                .filter((u): u is NonNullable<typeof u> => u !== null);
              if (updates.length > 0) await db.origens.bulkUpdate(updates);
            } else if (error) {
              console.error('❌ Erro ao sincronizar origens:', error);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao sincronizar origens:', err);
      }
    })()
  ]);

  // Sincronizar animais (otimizado com batch upsert e processamento em lotes)
  try {
    if (db.animais) {
      const todosAnimais = await db.animais.toArray();
      const pendAnimais = todosAnimais.filter(a => a.synced === false);

      if (pendAnimais.length > 0) {
        console.log(`📊 Sincronizando ${pendAnimais.length} animal(is) pendente(s)`);
        
        // Buscar remoteIds dos relacionamentos e criar Maps para lookup O(1)
        const tipos = await db.tiposAnimal.toArray();
        const status = await db.statusAnimal.toArray();
        const origens = await db.origens.toArray();
        const fazendas = await db.fazendas.toArray();
        const racas = await db.racas.toArray();
        
        const tiposMap = new Map(tipos.map(t => [t.id, t]));
        const statusMap = new Map(status.map(s => [s.id, s]));
        const origensMap = new Map(origens.map(o => [o.id, o]));
        const fazendasMap = new Map(fazendas.map(f => [f.id, f]));
        const racasMap = new Map(racas.map(r => [r.id, r]));
        
        // Processar em lotes de 500 para evitar problemas com payload muito grande
        const BATCH_SIZE = 500;
        const totalBatches = Math.ceil(pendAnimais.length / BATCH_SIZE);
        let totalSincronizados = 0;
        
        for (let i = 0; i < pendAnimais.length; i += BATCH_SIZE) {
          const slice = pendAnimais.slice(i, i + BATCH_SIZE);
          // Só enviar animais cuja fazenda já está sincronizada (fazenda_id NOT NULL no servidor)
          const batch = slice.filter(a => fazendasMap.get(a.fazendaId)?.remoteId != null);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          if (batch.length === 0) continue;

          const dadosAnimais = batch.map(a => {
            const tipo = tiposMap.get(a.tipoId);
            const statusAnimal = statusMap.get(a.statusId);
            const origem = origensMap.get(a.origemId);
            const fazenda = fazendasMap.get(a.fazendaId);
            const raca = a.racaId ? racasMap.get(a.racaId) : null;
            const fazendaOrigem = a.fazendaOrigemId ? fazendasMap.get(a.fazendaOrigemId) : null;

            // Normalizar datas para YYYY-MM-DD (PostgreSQL DATE) — evita 400 quando está em dd/mm/yyyy
            const dataNascimentoIso = a.dataNascimento ? converterDataParaFormatoBanco(a.dataNascimento) : '';
            const dataCadastroIso = a.dataCadastro ? converterDataParaFormatoBanco(a.dataCadastro) : '';
            // data_nascimento é NOT NULL no servidor; usar data_cadastro ou hoje como fallback
            const dataNascimentoEnviar = dataNascimentoIso || dataCadastroIso || new Date().toISOString().slice(0, 10);

            const dados: any = {
              uuid: a.id,
              brinco: a.brinco,
              nome: a.nome || null,
              tipo_id: tipo?.remoteId || null,
              raca_id: raca?.remoteId || null,
              sexo: a.sexo,
              status_id: statusAnimal?.remoteId || null,
              data_nascimento: dataNascimentoEnviar,
              data_cadastro: dataCadastroIso || dataNascimentoEnviar || null,
              data_entrada: a.dataEntrada ? converterDataParaFormatoBanco(a.dataEntrada) || null : null,
              data_saida: a.dataSaida ? converterDataParaFormatoBanco(a.dataSaida) || null : null,
              origem_id: origem?.remoteId || null,
              fazenda_id: fazenda?.remoteId ?? null,
              fazenda_origem_id: fazendaOrigem?.remoteId || null,
              proprietario_anterior: a.proprietarioAnterior || null,
              matriz_id: a.matrizId || null,
              reprodutor_id: a.reprodutorId || null,
              valor_compra: a.valorCompra || null,
              valor_venda: a.valorVenda || null,
              pelagem: a.pelagem || null,
              peso_atual: a.pesoAtual || null,
              lote: a.lote || null,
              categoria: a.categoria || null,
              obs: a.obs || null,
              created_at: a.createdAt,
              updated_at: a.updatedAt,
              deleted_at: a.deletedAt || null
            };
            // Não enviar id no payload: em lote misto (novos + já sincronizados) o PostgREST inclui a coluna e preenche null nos novos, gerando erro NOT NULL. O upsert por uuid devolve id no .select().
            return dados;
          });

          const { data, error } = await supabase
            .from('animais_online')
            .upsert(dadosAnimais, {
              onConflict: 'uuid',
              ignoreDuplicates: false
            })
            .select('id, uuid');

          if (!error && data) {
            // Criar Map para lookup O(1) ao invés de find() O(n)
            const remoteMap = new Map(data.map(d => [d.uuid, d]));
            
            // Preparar updates em lote
            const updates = batch
              .map(animal => {
                const remote = remoteMap.get(animal.id);
                if (remote) {
                  return {
                    key: animal.id,
                    changes: {
                      remoteId: remote.id,
                      synced: true
                    }
                  };
                }
                return null;
              })
              .filter((u): u is { key: string; changes: { remoteId: number; synced: boolean } } => u !== null);

            // Executar updates em lote
            if (updates.length > 0) {
              await db.animais.bulkUpdate(updates);
            }
            
            totalSincronizados += batch.length;
            console.log(`  ✓ Lote ${batchNum}/${totalBatches}: ${batch.length} animais sincronizados`);
          } else if (error) {
            console.error(`❌ Erro ao sincronizar lote ${batchNum}/${totalBatches} de animais:`, error?.message || error, error?.details, error?.hint);
          }
        }
        
        console.log(`✅ ${totalSincronizados}/${pendAnimais.length} animais sincronizados`);
      }
    }
  } catch (err) {
    console.error('Erro ao sincronizar animais:', err);
  }

  // Sincronizar genealogias
  try {
    if (db.genealogias) {
      const todasGenealogias = await db.genealogias.toArray();
      const pendGenealogias = todasGenealogias.filter(g => g.synced === false);

      if (pendGenealogias.length > 0) {
        console.log(`📊 Sincronizando ${pendGenealogias.length} genealogia(s) pendente(s)`);
        
        // Buscar remoteIds dos relacionamentos e criar Map para lookup O(1)
        const tiposAnimal = await db.tiposAnimal.toArray();
        const tiposAnimalMap = new Map(tiposAnimal.map(t => [t.id, t]));
        
        // Processar em lotes de 500 para evitar problemas com payload muito grande
        const BATCH_SIZE = 500;
        const totalBatches = Math.ceil(pendGenealogias.length / BATCH_SIZE);
        let totalSincronizadas = 0;
        
        for (let i = 0; i < pendGenealogias.length; i += BATCH_SIZE) {
          const batch = pendGenealogias.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          
          const dadosGenealogias = batch.map(g => {
            const tipoMatriz = g.tipoMatrizId ? tiposAnimalMap.get(g.tipoMatrizId) : null;
            
            const dados: any = {
              uuid: g.id,
              animal_id: g.animalId,
              matriz_id: g.matrizId || null,
              tipo_matriz_id: tipoMatriz?.remoteId || null,
              reprodutor_id: g.reprodutorId || null,
              avo_materna: g.avoMaterna || null,
              avo_paterna: g.avoPaterna || null,
              avo_materno: g.avoPaternoMaterno || null,
              avo_paterno: g.avoPaternoPatro || null,
              geracoes: g.geracoes || 1,
              observacoes: g.observacoes || null,
              created_at: g.createdAt,
              updated_at: g.updatedAt,
              deleted_at: g.deletedAt || null
            };
            // Não enviar id no payload (mesmo motivo que em animais: evita null em lote misto).
            return dados;
          });

          const { data, error } = await supabase
            .from('genealogias_online')
            .upsert(dadosGenealogias, {
              onConflict: 'uuid',
              ignoreDuplicates: false
            })
            .select('id, uuid');

          if (!error && data) {
            // Criar Map para lookup O(1) ao invés de find() O(n)
            const remoteMap = new Map(data.map(d => [d.uuid, d]));
            
            // Preparar updates em lote
            const updates = batch
              .map(gen => {
                const remote = remoteMap.get(gen.id);
                if (remote) {
                  return {
                    key: gen.id,
                    changes: {
                      remoteId: remote.id,
                      synced: true
                    }
                  };
                }
                return null;
              })
              .filter((u): u is { key: string; changes: { remoteId: number; synced: boolean } } => u !== null);

            // Executar updates em lote
            if (updates.length > 0) {
              await db.genealogias.bulkUpdate(updates);
            }
            
            totalSincronizadas += batch.length;
            console.log(`  ✓ Lote ${batchNum}/${totalBatches}: ${batch.length} genealogias sincronizadas`);
          } else if (error) {
            console.error(`❌ Erro ao sincronizar lote ${batchNum}/${totalBatches} de genealogias:`, error?.message || error, error?.details, error?.hint);
          }
        }
        
        console.log(`✅ ${totalSincronizadas}/${pendGenealogias.length} genealogias sincronizadas`);
      }
    }
  } catch (err) {
    console.error('Erro ao sincronizar genealogias:', err);
  }
}

export async function pullUpdates() {
  console.log('📥 Iniciando pull de atualizações do servidor...');
  const totalSteps = 28; // Total de etapas no pull (24 + 4 confinamento)
  let currentStep = 0;

  // Buscar categorias (motor genérico) — forceFullPull: tabela pequena
  try {
    currentStep++;
    startSyncStep('Pull Categorias');
    emitSyncProgress('pull', currentStep, totalSteps, 'Sincronizando Categorias...');
    const n = await pullEntity({
      remoteTable: 'categorias_online',
      orderBy: 'updated_at',
      updatedAtField: 'updated_at',
      localTable: db.categorias as any,
      mapper: (s: any) => ({ id: s.uuid, nome: s.nome, createdAt: s.created_at, updatedAt: s.updated_at, synced: true, remoteId: s.id }),
      forceFullPull: true
    });
    endSyncStep('Pull Categorias', n);
  } catch (err) {
    console.error('Erro ao processar pull de categorias:', err);
    endSyncStep('Pull Categorias', 0);
  }

  // Buscar raças (motor genérico) — forceFullPull: tabela pequena, evita perder registros por checkpoint incremental
  try {
    currentStep++;
    startSyncStep('Pull Raças');
    emitSyncProgress('pull', currentStep, totalSteps, 'Sincronizando Raças...');
    const n = await pullEntity({
      remoteTable: 'racas_online',
      orderBy: 'updated_at',
      updatedAtField: 'updated_at',
      localTable: db.racas as any,
      mapper: (s: any) => ({ id: s.uuid, nome: s.nome, createdAt: s.created_at, updatedAt: s.updated_at, synced: true, remoteId: s.id }),
      forceFullPull: true
    });
    endSyncStep('Pull Raças', n);
  } catch (err) {
    console.error('Erro ao processar pull de raças:', err);
    endSyncStep('Pull Raças', 0);
  }

  // Buscar fazendas (motor genérico) — forceFullPull: tabela pequena
  try {
    currentStep++;
    startSyncStep('Pull Fazendas');
    emitSyncProgress('pull', currentStep, totalSteps, 'Sincronizando Fazendas...');
    const n = await pullEntity({
      remoteTable: 'fazendas_online',
      orderBy: 'updated_at',
      updatedAtField: 'updated_at',
      localTable: db.fazendas as any,
      mapper: (s: any) => ({ id: s.uuid, nome: s.nome, logoUrl: s.logo_url, createdAt: s.created_at, updatedAt: s.updated_at, synced: true, remoteId: s.id }),
      forceFullPull: true
    });
    endSyncStep('Pull Fazendas', n);
  } catch (err) {
    console.error('Erro ao processar pull de fazendas:', err);
    endSyncStep('Pull Fazendas', 0);
  }

  // Buscar matrizes — desativado: uso apenas animais
  if (SYNC_LEGACY_NASCIMENTOS_MATRIZES) {
  try {
    const { data: servMatrizes, error: errorMatrizes } = await supabase.from('matrizes_online').select('*');
    if (errorMatrizes) {
      console.error('Erro ao buscar matrizes do servidor:', {
        error: errorMatrizes,
        message: errorMatrizes.message,
        code: errorMatrizes.code,
        details: errorMatrizes.details,
        hint: errorMatrizes.hint
      });
      // Não excluir dados locais em caso de erro
    } else if (servMatrizes && servMatrizes.length > 0) {
      // IMPORTANTE: Só processar se houver dados no servidor
      // Se servMatrizes for [] (vazio), preservar dados locais

      // Criar conjunto de UUIDs que existem no servidor
      const servUuids = new Set(servMatrizes.map((m: any) => m.uuid));

      // Buscar todas as matrizes locais que foram sincronizadas (têm remoteId)
      const todasMatrizesLocais = await db.matrizes.toArray();
      const matrizesSincronizadas = todasMatrizesLocais.filter((m: any) => m.remoteId != null);

      // Excluir localmente as que não existem mais no servidor
      // Mas só se o servidor retornou dados (não está vazio)
      for (const local of matrizesSincronizadas) {
        if (!servUuids.has(local.id)) {
          await db.matrizes.delete(local.id);
        }
      }

      // Adicionar/atualizar matrizes do servidor
      for (const s of servMatrizes as any[]) {
        const local = await db.matrizes.get(s.uuid);

        // Converter data_nascimento (ISO) para formato dd/mm/aaaa usado localmente
        let dataNascimentoBR: string | undefined = undefined;
        if (s.data_nascimento) {
          const formatted = formatDateBR(s.data_nascimento);
          dataNascimentoBR = formatted || undefined;
        }

        // Usar categoria_uuid se disponível, senão usar categoria (compatibilidade com dados antigos)
        const categoriaId = s.categoria_uuid || s.categoria || '';
        
        // Buscar nome da raça baseado no UUID (se houver raca_uuid)
        let racaNome: string | undefined = undefined;
        if (s.raca_uuid) {
          const racaEncontrada = await db.racas.get(s.raca_uuid);
          if (racaEncontrada) {
            racaNome = racaEncontrada.nome;
          }
        } else if (s.raca) {
          // Fallback: usar raca (texto) se raca_uuid não estiver disponível
          racaNome = s.raca;
        }
        
        if (!local) {
          if (!s.uuid) {
            console.warn('Matriz do servidor sem UUID, ignorando:', s);
            continue;
          }

          // Usar put ao invés de add para evitar erro de chave duplicada
          try {
            await db.matrizes.put({
              id: s.uuid,
              identificador: s.identificador,
              fazendaId: s.fazenda_uuid,
              categoriaId: categoriaId,
              raca: racaNome,
              dataNascimento: dataNascimentoBR,
              pai: s.pai || undefined,
              mae: s.mae || undefined,
              ativo: s.ativo,
              createdAt: s.created_at,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            } as any);
          } catch (putError: any) {
            // Se ainda der erro, tentar atualizar
            if (putError.name === 'ConstraintError' || putError.message?.includes('Key already exists')) {
              await db.matrizes.update(s.uuid, {
                identificador: s.identificador,
                fazendaId: s.fazenda_uuid,
                categoriaId: categoriaId,
                raca: racaNome,
                dataNascimento: dataNascimentoBR,
                pai: s.pai || undefined,
                mae: s.mae || undefined,
                ativo: s.ativo,
                updatedAt: s.updated_at,
                synced: true,
                remoteId: s.id
              } as any);
            } else {
              throw putError;
            }
          }
        } else {
          // IMPORTANTE: Não sobrescrever se há alterações locais não sincronizadas
          // ou se os dados locais são mais recentes que os do servidor
          if (!local.synced) {
            const servUpdated = s.updated_at ? new Date(s.updated_at).getTime() : 0;
            const localUpdated = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
            const margemTimestamp = 1000; // 1 segundo de margem
            
            // Se dados locais são mais recentes ou iguais (dentro da margem), não sobrescrever
            if (localUpdated >= servUpdated - margemTimestamp) {
              console.log(`⏸️ Matriz ${s.uuid} tem alterações locais não sincronizadas, pulando pull`);
              continue;
            }
          }
          
          // Atualizar apenas se a versão do servidor for mais recente ou se não tiver remoteId
          if (!local.remoteId || new Date(local.updatedAt) < new Date(s.updated_at)) {
            await db.matrizes.update(local.id, {
              identificador: s.identificador,
              fazendaId: s.fazenda_uuid,
              categoriaId: categoriaId,
              raca: racaNome,
              dataNascimento: dataNascimentoBR,
              pai: s.pai || undefined,
              mae: s.mae || undefined,
              ativo: s.ativo,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            } as any);
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao processar pull de matrizes:', err);
  }
  }

  // Buscar nascimentos — desativado: uso apenas animais
  if (SYNC_LEGACY_NASCIMENTOS_MATRIZES) {
  try {
    const servNasc = await fetchAllFromSupabase('nascimentos_online', 'id');
    if (servNasc && servNasc.length > 0) {
      // IMPORTANTE: Só processar se houver dados no servidor
      // Se servNasc for [] (vazio), preservar dados locais
      // Buscar lista de registros excluídos localmente
    let deletedUuids = new Set<string>();
    try {
      if (db.deletedRecords) {
        const deletedRecords = await db.deletedRecords.toArray();
        deletedUuids = new Set(deletedRecords.map(d => d.uuid));
      }
    } catch (err) {
      // Ignorar erro se a tabela não existir
    }
    
    // Criar conjunto de UUIDs que existem no servidor
    const servUuids = new Set(servNasc.map(n => n.uuid));
    
    // Buscar todos os nascimentos locais
    const todosNascimentosLocais = await db.nascimentos.toArray();
    const nascimentosSincronizados = todosNascimentosLocais.filter(n => n.remoteId != null);
    
    // Criar um mapa de remoteId para UUID para verificação rápida
    const remoteIdToUuid = new Map<number, string>();
    todosNascimentosLocais.forEach(n => {
      if (n.remoteId) {
        remoteIdToUuid.set(n.remoteId, n.id);
      }
    });
    
    // Excluir localmente os que não existem mais no servidor (e não foram excluídos localmente)
    for (const local of nascimentosSincronizados) {
      const existeNoServidor = servUuids.has(local.id);
      const foiExcluidoLocalmente = deletedUuids.has(local.id);
      
      if (!existeNoServidor && !foiExcluidoLocalmente) {
        // Registrar exclusão para evitar recriação
        try {
          if (db.deletedRecords) {
            const { uuid } = await import('../utils/uuid');
            await db.deletedRecords.add({
              id: uuid(),
              uuid: local.id,
              remoteId: local.remoteId || null,
              deletedAt: new Date().toISOString(),
              synced: true // Já foi excluído no servidor
            });
          }
        } catch (err) {
          console.warn('Erro ao registrar exclusão:', err);
        }
        // Excluir desmamas associadas
        const desmamasAssociadas = await db.desmamas.where('nascimentoId').equals(local.id).toArray();
        for (const d of desmamasAssociadas) {
          await db.desmamas.delete(d.id);
        }
        // Excluir nascimento
        await db.nascimentos.delete(local.id);
      }
    }
    
    // Adicionar/atualizar nascimentos do servidor
    for (const s of servNasc) {
      // Não recriar se foi excluído localmente
      if (deletedUuids.has(s.uuid)) {
        continue;
      }
      
      // Verificar se o registro ainda existe localmente antes de adicionar
      const local = await db.nascimentos.get(s.uuid);
      if (!local) {
        // Verificar novamente se não foi excluído antes de adicionar (race condition)
        if (deletedUuids.has(s.uuid)) {
          continue;
        }
        // Verificar se não existe outro registro com o mesmo remoteId (evitar duplicados)
        const existingUuidByRemoteId = remoteIdToUuid.get(s.id);
        if (existingUuidByRemoteId && existingUuidByRemoteId !== s.uuid) {
          // Se já existe um registro com esse remoteId mas UUID diferente, 
          // pode ser um duplicado - deletar o antigo e criar o novo
          try {
            await db.nascimentos.delete(existingUuidByRemoteId);
          } catch (err) {
            console.warn('Erro ao remover duplicado:', err);
          }
        }
        // Buscar nome da raça baseado no UUID (se houver raca_uuid)
        let racaNome: string | undefined = undefined;
        if (s.raca_uuid) {
          const racaEncontrada = await db.racas.get(s.raca_uuid);
          if (racaEncontrada) {
            racaNome = racaEncontrada.nome;
          }
        } else if (s.raca) {
          // Fallback: usar raca (texto) se raca_uuid não estiver disponível
          racaNome = s.raca;
        }
        
        try {
          // Usar put ao invés de add para evitar erro de chave duplicada
          await db.nascimentos.put({
            id: s.uuid,
            fazendaId: s.fazenda_uuid,
            matrizId: s.matriz_id,
            mes: s.mes,
            ano: s.ano,
            novilha: s.novilha || false,
            vaca: s.vaca || false,
            brincoNumero: s.brinco_numero,
            dataNascimento: s.data_nascimento,
            sexo: s.sexo,
            raca: racaNome,
            obs: s.obs,
            morto: s.morto || false,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            synced: true,
            remoteId: s.id
          });
        } catch (addError: any) {
          // Se der erro ao adicionar (ex: chave duplicada), tentar atualizar
          if (addError.name === 'ConstraintError' || addError.message?.includes('already exists')) {
            const existing = await db.nascimentos.get(s.uuid);
            if (existing) {
              // Buscar nome da raça baseado no UUID (se houver raca_uuid)
              let racaNome: string | undefined = undefined;
              if (s.raca_uuid) {
                const racaEncontrada = await db.racas.get(s.raca_uuid);
                if (racaEncontrada) {
                  racaNome = racaEncontrada.nome;
                }
              } else if (s.raca) {
                // Fallback: usar raca (texto) se raca_uuid não estiver disponível
                racaNome = s.raca;
              }
              
              await db.nascimentos.update(s.uuid, {
                fazendaId: s.fazenda_uuid,
                matrizId: s.matriz_id,
                mes: s.mes,
                ano: s.ano,
                novilha: s.novilha || false,
                vaca: s.vaca || false,
                brincoNumero: s.brinco_numero,
                dataNascimento: s.data_nascimento,
                sexo: s.sexo,
                raca: racaNome,
                obs: s.obs,
                morto: s.morto || false,
                updatedAt: s.updated_at,
                synced: true,
                remoteId: s.id
              });
            }
          } else {
            console.error('Erro ao adicionar nascimento do servidor:', addError, s.uuid);
          }
        }
      } else {
        // Atualizar se o servidor tem versão mais recente ou se não tem remoteId
        if (!local.remoteId || new Date(local.updatedAt) < new Date(s.updated_at)) {
          await db.nascimentos.update(local.id, {
            fazendaId: s.fazenda_uuid,
            matrizId: s.matriz_id,
            mes: s.mes,
            ano: s.ano,
            novilha: s.novilha || false,
            vaca: s.vaca || false,
            brincoNumero: s.brinco_numero,
            dataNascimento: s.data_nascimento,
            sexo: s.sexo,
            raca: s.raca,
            obs: s.obs,
            morto: s.morto || false,
            updatedAt: s.updated_at,
            synced: true,
            remoteId: s.id
          });
        }
      }
    }
  }
  } catch (err) {
    console.error('Erro ao processar pull de nascimentos:', err);
    throw err;
  }
  }

  // Buscar desmamas
  try {
    const servDesm = await fetchAllFromSupabase('desmamas_online', 'id');
    if (servDesm && servDesm.length > 0) {
      // IMPORTANTE: Só processar se houver dados no servidor
      // Se servDesm for [] (vazio), preservar dados locais
      
      // Criar conjunto de UUIDs que existem no servidor
      const servUuids = new Set(servDesm.map(d => d.uuid));
      
      // Buscar todas as desmamas locais que foram sincronizadas (têm remoteId)
      const todasDesmamasLocais = await db.desmamas.toArray();
      const desmamasSincronizadas = todasDesmamasLocais.filter(d => d.remoteId != null);
      
      // Excluir localmente as que não existem mais no servidor
      // Mas só se o servidor retornou dados (não está vazio)
      for (const local of desmamasSincronizadas) {
        if (!servUuids.has(local.id)) {
          await db.desmamas.delete(local.id);
        }
      }
    
    // Adicionar/atualizar desmamas do servidor
    for (const s of servDesm) {
      if (!s.uuid) {
        console.warn('Desmama do servidor sem UUID, ignorando:', s);
        continue;
      }

      const local = await db.desmamas.get(s.uuid);
      if (!local) {
        // Usar put ao invés de add para evitar erro de chave duplicada
        try {
          await db.desmamas.put({
            id: s.uuid,
            nascimentoId: s.nascimento_uuid,
            animalId: s.animal_id || undefined,
            dataDesmama: s.data_desmama,
            pesoDesmama: s.peso_desmama,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            synced: true,
            remoteId: s.id
          });
        } catch (putError: any) {
          if (putError.name === 'ConstraintError') {
            await db.desmamas.update(s.uuid, {
              nascimentoId: s.nascimento_uuid,
              animalId: s.animal_id || undefined,
              dataDesmama: s.data_desmama,
              pesoDesmama: s.peso_desmama,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
          } else {
            throw putError;
          }
        }
      } else {
        // Atualizar apenas se a versão do servidor for mais recente ou se não tiver remoteId
        if (!local.remoteId || new Date(local.updatedAt) < new Date(s.updated_at)) {
          await db.desmamas.update(local.id, {
            nascimentoId: s.nascimento_uuid,
            animalId: s.animal_id || undefined,
            dataDesmama: s.data_desmama,
            pesoDesmama: s.peso_desmama,
            updatedAt: s.updated_at,
            synced: true,
            remoteId: s.id
          });
        }
      }
    }
    }
  } catch (err) {
    console.error('Erro ao processar pull de desmamas:', err);
    throw err;
  }

  // Buscar pesagens
  try {
    const servPesagens = await fetchAllFromSupabase('pesagens_online', 'id');
    if (servPesagens && servPesagens.length > 0) {
      const servUuids = new Set(servPesagens.map(p => p.uuid));
      const todasPesagensLocais = await db.pesagens.toArray();
      const pesagensSincronizadas = todasPesagensLocais.filter(p => p.remoteId != null);
      
      // Verificar quais pesagens foram excluídas localmente (verificar deletedRecords diretamente)
      const deletedUuids = new Set<string>();
      if (db.deletedRecords) {
        const todasExclusoes = await db.deletedRecords.toArray();
        for (const deleted of todasExclusoes) {
          deletedUuids.add(deleted.uuid);
        }
      }
      
      for (const local of pesagensSincronizadas) {
        const existeNoServidor = servUuids.has(local.id);
        const foiExcluidoLocalmente = deletedUuids.has(local.id);
        
        if (!existeNoServidor && !foiExcluidoLocalmente) {
          // Foi excluído no servidor mas não localmente, excluir localmente
          await db.pesagens.delete(local.id);
        }
      }
      
      // Não recriar pesagens que foram excluídas localmente
      for (const s of servPesagens) {
        if (!s.uuid) {
          console.warn('Pesagem do servidor sem UUID, ignorando:', s);
          continue;
        }
        
        // Não recriar pesagens que foram excluídas localmente
        if (deletedUuids.has(s.uuid)) {
          continue;
        }

        const local = await db.pesagens.get(s.uuid);
        if (!local) {
          try {
            await db.pesagens.put({
              id: s.uuid,
              nascimentoId: s.nascimento_id || s.nascimento_uuid || undefined, // Suportar ambos os nomes
              animalId: s.animal_id || undefined,
              dataPesagem: s.data_pesagem,
              peso: s.peso,
              observacao: s.observacao || undefined,
              createdAt: s.created_at,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
          } catch (putError: any) {
            if (putError.name === 'ConstraintError') {
              await db.pesagens.update(s.uuid, {
                nascimentoId: s.nascimento_id || s.nascimento_uuid || undefined, // Suportar ambos os nomes
                animalId: s.animal_id || undefined,
                dataPesagem: s.data_pesagem,
                peso: s.peso,
                observacao: s.observacao || undefined,
                updatedAt: s.updated_at,
                synced: true,
                remoteId: s.id
              });
            } else {
              throw putError;
            }
          }
        } else {
          // IMPORTANTE: Não sobrescrever se há alterações locais não sincronizadas
          // ou se os dados locais são mais recentes que os do servidor
          if (!local.synced) {
            const servUpdated = s.updated_at ? new Date(s.updated_at).getTime() : 0;
            const localUpdated = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
            const margemTimestamp = 1000; // 1 segundo de margem
            
            // Se dados locais são mais recentes ou iguais (dentro da margem), não sobrescrever
            if (localUpdated >= servUpdated - margemTimestamp) {
              console.log(`⏸️ Pesagem ${s.uuid} tem alterações locais não sincronizadas, pulando pull`);
              continue;
            }
          }
          
          // Atualizar apenas se a versão do servidor for mais recente ou se não tiver remoteId
          if (!local.remoteId || new Date(local.updatedAt) < new Date(s.updated_at)) {
            await db.pesagens.update(local.id, {
              nascimentoId: s.nascimento_id || s.nascimento_uuid || undefined,
              animalId: s.animal_id || undefined,
              dataPesagem: s.data_pesagem,
              peso: s.peso,
              observacao: s.observacao || undefined,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao processar pull de pesagens:', err);
    throw err;
  }

  // Buscar vacinações
  try {
    let servVacinacoes: any[] = [];
    try {
      servVacinacoes = await fetchAllFromSupabase('vacinacoes_online', 'id');
    } catch (errorVacinacoes: any) {
      // Se a tabela não existe (404 ou PGRST205), apenas logar e continuar (modo offline-first)
      if (errorVacinacoes?.code === 'PGRST205' || errorVacinacoes?.code === '42P01' || errorVacinacoes?.message?.includes('Could not find the table')) {
        console.warn('Tabela vacinacoes_online não existe no servidor. Execute a migração 024_add_vacinacoes_online.sql no Supabase.');
      } else {
        console.error('Erro ao buscar vacinações do servidor:', errorVacinacoes);
      }
    }
    
    if (servVacinacoes && servVacinacoes.length > 0) {
      const servUuids = new Set(servVacinacoes.map(v => v.uuid));
      const todasVacinacoesLocais = await db.vacinacoes.toArray();
      const vacinacoesSincronizadas = todasVacinacoesLocais.filter(v => v.remoteId != null);
      
      // Verificar quais vacinações foram excluídas localmente (verificar deletedRecords diretamente)
      const deletedUuids = new Set<string>();
      if (db.deletedRecords) {
        const todasExclusoes = await db.deletedRecords.toArray();
        for (const deleted of todasExclusoes) {
          deletedUuids.add(deleted.uuid);
        }
      }
      
      for (const local of vacinacoesSincronizadas) {
        const existeNoServidor = servUuids.has(local.id);
        const foiExcluidoLocalmente = deletedUuids.has(local.id);
        
        if (!existeNoServidor && !foiExcluidoLocalmente) {
          // Foi excluído no servidor mas não localmente, excluir localmente
          await db.vacinacoes.delete(local.id);
        }
      }
    
      for (const s of servVacinacoes) {
        if (!s.uuid) {
          console.warn('Vacinação do servidor sem UUID, ignorando:', s);
          continue;
        }
        
        // Não recriar vacinações que foram excluídas localmente
        if (deletedUuids.has(s.uuid)) {
          continue;
        }

        const local = await db.vacinacoes.get(s.uuid);
        if (!local) {
          try {
            await db.vacinacoes.put({
              id: s.uuid,
              nascimentoId: s.nascimento_id || undefined,
              animalId: s.animal_id || undefined,
              vacina: s.vacina,
              dataAplicacao: s.data_aplicacao,
              dataVencimento: s.data_vencimento || undefined,
              lote: s.lote || undefined,
              responsavel: s.responsavel || undefined,
              observacao: s.observacao || undefined,
              createdAt: s.created_at,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
          } catch (putError: any) {
            if (putError.name === 'ConstraintError') {
              await db.vacinacoes.update(s.uuid, {
                nascimentoId: s.nascimento_id || undefined,
                animalId: s.animal_id || undefined,
                vacina: s.vacina,
                dataAplicacao: s.data_aplicacao,
                dataVencimento: s.data_vencimento || undefined,
                lote: s.lote || undefined,
                responsavel: s.responsavel || undefined,
                observacao: s.observacao || undefined,
                updatedAt: s.updated_at,
                synced: true,
                remoteId: s.id
              });
            } else {
              throw putError;
            }
          }
        } else {
          // IMPORTANTE: Não sobrescrever se há alterações locais não sincronizadas
          // ou se os dados locais são mais recentes que os do servidor
          if (!local.synced) {
            const servUpdated = s.updated_at ? new Date(s.updated_at).getTime() : 0;
            const localUpdated = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
            const margemTimestamp = 1000; // 1 segundo de margem
            
            // Se dados locais são mais recentes ou iguais (dentro da margem), não sobrescrever
            if (localUpdated >= servUpdated - margemTimestamp) {
              console.log(`⏸️ Vacinação ${s.uuid} tem alterações locais não sincronizadas, pulando pull`);
              continue;
            }
          }
          
          // Atualizar apenas se a versão do servidor for mais recente ou se não tiver remoteId
          if (!local.remoteId || new Date(local.updatedAt) < new Date(s.updated_at)) {
            await db.vacinacoes.update(local.id, {
              nascimentoId: s.nascimento_id || undefined,
              animalId: s.animal_id || undefined,
              vacina: s.vacina,
              dataAplicacao: s.data_aplicacao,
              dataVencimento: s.data_vencimento || undefined,
              lote: s.lote || undefined,
              responsavel: s.responsavel || undefined,
              observacao: s.observacao || undefined,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
          }
        }
      }
    }
  } catch (err: any) {
    // Se a tabela não existe, apenas logar e continuar (não quebrar a sincronização)
    if (err?.code === 'PGRST205' || err?.code === '42P01' || err?.message?.includes('Could not find the table')) {
      console.warn('Tabela vacinacoes_online não existe no servidor. Execute a migração 024_add_vacinacoes_online.sql no Supabase.');
    } else {
      console.error('Erro ao processar pull de vacinações:', err);
      // Não fazer throw para não quebrar a sincronização completa
    }
  }

  // Buscar tags (incluir deletadas para sincronizar soft deletes)
  try {
    const { data: servTags, error: errorTags } = await supabase
      .from('tags')
      .select('*'); // Remover filtro de deleted_at para sincronizar exclusões
      
    if (errorTags) {
      if (errorTags.code === 'PGRST205' || errorTags.code === '42P01' || errorTags.message?.includes('Could not find')) {
        console.warn('Tabela tags não existe no servidor. Execute a migração 022_add_tags_system.sql no Supabase.');
      } else {
        console.error('Erro ao buscar tags do servidor:', errorTags);
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
            remoteId: s.id
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
            synced: true
          });
        }
      }
    }

    // Buscar atribuições de tags (incluir deletadas para sincronizar soft deletes)
    const { data: servAssignments, error: errorAssignments } = await supabase
      .from('tag_assignments')
      .select('*'); // Remover filtro de deleted_at para sincronizar exclusões
      
    if (errorAssignments) {
      if (errorAssignments.code !== 'PGRST205' && errorAssignments.code !== '42P01') {
        console.error('Erro ao buscar atribuições de tags:', errorAssignments);
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
            remoteId: s.id
          });
        } else if (new Date(local.updatedAt) < new Date(s.updated_at)) {
          await db.tagAssignments.update(s.id, {
            updatedAt: s.updated_at,
            deletedAt: s.deleted_at,
            synced: true
          });
        }
      }
    }
  } catch (err: any) {
    if (err?.code !== 'PGRST205' && err?.code !== '42P01') {
      console.error('Erro ao processar tags:', err);
    }
  }

  // Buscar usuários (motor genérico: incremental + batch)
  try {
    currentStep++;
    startSyncStep('Pull Usuários');
    emitSyncProgress('pull', currentStep, totalSteps, 'Sincronizando Usuários...');
    const nUsuarios = await pullEntity({
      remoteTable: 'usuarios_online',
      orderBy: 'updated_at',
      updatedAtField: 'updated_at',
      localTable: db.usuarios as any,
      mapper: (s: any) => ({ id: s.uuid, nome: s.nome, email: s.email, senhaHash: s.senha_hash, role: s.role, fazendaId: s.fazenda_uuid || undefined, ativo: s.ativo, createdAt: s.created_at, updatedAt: s.updated_at, synced: true, remoteId: s.id })
    });
    endSyncStep('Pull Usuários', nUsuarios);
  } catch (err) {
    console.error('Erro ao processar pull de usuários:', err);
    endSyncStep('Pull Usuários', 0);
    throw err;
  }

  // Pull de auditoria (motor genérico: incremental + batch, limit 1000)
  try {
    if (db.audits) {
      await pullEntity({
        remoteTable: 'audits_online',
        orderBy: 'timestamp',
        updatedAtField: 'timestamp',
        updatedAtFieldLocal: 'timestamp',
        localTable: db.audits as any,
        limit: 1000,
        mapper: (s: any) => ({ id: s.uuid, entity: s.entity, entityId: s.entity_id, action: s.action, timestamp: s.timestamp, userId: s.user_uuid || null, userNome: s.user_nome || null, before: s.before_json ? JSON.stringify(s.before_json) : null, after: s.after_json ? JSON.stringify(s.after_json) : null, description: s.description || null, synced: true, remoteId: s.id })
      });
    }
  } catch (err) {
    console.error('Erro ao processar pull de auditoria:', err);
  }

  // Buscar configurações de alerta
  try {
    if (db.alertSettings) {
      const { data: servSettings, error: errorSettings } = await supabase
        .from('alert_settings_online')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (errorSettings) {
        console.error('Erro ao buscar configurações de alerta do servidor:', {
          error: errorSettings,
          message: errorSettings.message,
          code: errorSettings.code
        });
        // Se a tabela não existe, pode ser que a migration não foi executada
        if (errorSettings.code === '42P01' || errorSettings.message?.includes('does not exist')) {
          console.warn('Tabela alert_settings_online não existe. Execute a migration 019_add_alert_settings_online.sql no Supabase.');
        }
      } else if (servSettings && servSettings.length > 0) {
        const s = servSettings[0];
        const local = await db.alertSettings.get('alert-settings-global');
        
        if (!local) {
          // Criar local se não existir - usar put para evitar erro de chave duplicada
          try {
            await db.alertSettings.put({
              id: 'alert-settings-global',
              limiteMesesDesmama: s.limite_meses_desmama,
              janelaMesesMortalidade: s.janela_meses_mortalidade,
              limiarMortalidade: s.limiar_mortalidade,
              createdAt: s.created_at,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
          } catch (putError: any) {
            if (putError.name === 'ConstraintError') {
              await db.alertSettings.update('alert-settings-global', {
                limiteMesesDesmama: s.limite_meses_desmama,
                janelaMesesMortalidade: s.janela_meses_mortalidade,
                limiarMortalidade: s.limiar_mortalidade,
                updatedAt: s.updated_at,
                synced: true,
                remoteId: s.id
              });
            } else {
              throw putError;
            }
          }
          
          // Atualizar localStorage e disparar evento
          if (typeof window !== 'undefined') {
            const settings = {
              limiteMesesDesmama: s.limite_meses_desmama,
              janelaMesesMortalidade: s.janela_meses_mortalidade,
              limiarMortalidade: s.limiar_mortalidade
            };
            window.localStorage.setItem('alertSettings', JSON.stringify(settings));
            window.dispatchEvent(new CustomEvent('alertSettingsUpdated', { detail: settings }));
          }
        } else {
          // Verificar se os valores são diferentes (comparação mais confiável que timestamp)
          // IMPORTANTE: Converter para número para evitar problemas de tipo (string vs number)
          const limiteDiferente = Number(local.limiteMesesDesmama) !== Number(s.limite_meses_desmama);
          const janelaDiferente = Number(local.janelaMesesMortalidade) !== Number(s.janela_meses_mortalidade);
          const limiarDiferente = Number(local.limiarMortalidade) !== Number(s.limiar_mortalidade);
          const valoresDiferentes = limiteDiferente || janelaDiferente || limiarDiferente;
          
          const servUpdated = new Date(s.updated_at).getTime();
          const localUpdated = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
          
          // SEMPRE atualizar se valores são diferentes (comparação mais confiável)
          // Também atualizar se servidor é mais recente (com margem de 1 segundo para evitar problemas de precisão)
          // OU se não está sincronizado OU se remoteId mudou
          const margemTimestamp = 1000; // 1 segundo de margem
          const deveAtualizar = valoresDiferentes || 
                                (servUpdated > localUpdated + margemTimestamp) || 
                                !local.synced || 
                                local.remoteId !== s.id;
          
          if (deveAtualizar) {
            await db.alertSettings.update('alert-settings-global', {
              limiteMesesDesmama: s.limite_meses_desmama,
              janelaMesesMortalidade: s.janela_meses_mortalidade,
              limiarMortalidade: s.limiar_mortalidade,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
            
            // Sempre atualizar localStorage e disparar evento quando puxar do servidor
            if (typeof window !== 'undefined') {
              const settings = {
                limiteMesesDesmama: s.limite_meses_desmama,
                janelaMesesMortalidade: s.janela_meses_mortalidade,
                limiarMortalidade: s.limiar_mortalidade
              };
              window.localStorage.setItem('alertSettings', JSON.stringify(settings));
              window.dispatchEvent(new CustomEvent('alertSettingsUpdated', { detail: settings }));
            }
          } else if (local.synced && local.remoteId !== s.id) {
            // Atualizar apenas remoteId se mudou
            await db.alertSettings.update('alert-settings-global', { remoteId: s.id });
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao processar pull de configurações de alerta:', err);
    // Não lançar erro - configurações não são críticas para funcionamento
  }

  // Buscar configurações do app
  try {
    if (db.appSettings) {
      const { data: servSettings, error: errorSettings } = await supabase
        .from('app_settings_online')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (errorSettings) {
        console.error('Erro ao buscar configurações do app do servidor:', {
          error: errorSettings,
          message: errorSettings.message,
          code: errorSettings.code,
          details: errorSettings.details,
          hint: errorSettings.hint
        });
      } else if (servSettings && servSettings.length > 0) {
        const s = servSettings[0];
        const local = await db.appSettings.get('app-settings-global');
        
        if (!local) {
          // Criar local se não existir
          // Usar put ao invés de add para evitar erro de chave duplicada
          try {
            await db.appSettings.put({
              id: 'app-settings-global',
              timeoutInatividade: s.timeout_inatividade,
              intervaloSincronizacao: s.intervalo_sincronizacao ?? 30,
              primaryColor: s.primary_color || 'gray',
              createdAt: s.created_at,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
          } catch (putError: any) {
            if (putError.name === 'ConstraintError') {
            await db.appSettings.update('app-settings-global', {
              timeoutInatividade: s.timeout_inatividade,
              intervaloSincronizacao: s.intervalo_sincronizacao ?? 30,
              primaryColor: s.primary_color || 'gray',
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
            } else {
              throw putError;
            }
          }
          
          // Disparar evento para atualizar o hook
          if (typeof window !== 'undefined') {
            const settings = {
              timeoutInatividade: s.timeout_inatividade,
              intervaloSincronizacao: s.intervalo_sincronizacao ?? 30,
              primaryColor: s.primary_color || 'gray'
            };
            window.dispatchEvent(new CustomEvent('appSettingsUpdated', { detail: settings }));
          }
        } else {
          // Verificar se os valores são diferentes
          const timeoutDiferente = Number(local.timeoutInatividade) !== Number(s.timeout_inatividade);
          const intervaloSincronizacaoDiferente = Number(local.intervaloSincronizacao ?? 30) !== Number(s.intervalo_sincronizacao ?? 30);
          const primaryColorDiferente = (local.primaryColor || 'gray') !== (s.primary_color || 'gray');
          
          const servUpdated = new Date(s.updated_at).getTime();
          const localUpdated = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
          
          // SEMPRE atualizar se valores são diferentes
          // Também atualizar se servidor é mais recente (com margem de 1 segundo)
          // OU se não está sincronizado OU se remoteId mudou
          const margemTimestamp = 1000; // 1 segundo de margem
          const deveAtualizar = timeoutDiferente || 
                                intervaloSincronizacaoDiferente ||
                                primaryColorDiferente ||
                                (servUpdated > localUpdated + margemTimestamp) || 
                                !local.synced || 
                                local.remoteId !== s.id;
          
          if (deveAtualizar) {
            await db.appSettings.update('app-settings-global', {
              timeoutInatividade: s.timeout_inatividade,
              intervaloSincronizacao: s.intervalo_sincronizacao ?? 30,
              primaryColor: s.primary_color || 'gray',
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
            
            // Disparar evento para atualizar o hook
            if (typeof window !== 'undefined') {
              const settings = {
                timeoutInatividade: s.timeout_inatividade,
                intervaloSincronizacao: s.intervalo_sincronizacao ?? 30,
                primaryColor: s.primary_color || 'gray'
              };
              window.dispatchEvent(new CustomEvent('appSettingsUpdated', { detail: settings }));
            }
          } else if (local.synced && local.remoteId !== s.id) {
            // Atualizar apenas remoteId se mudou
            await db.appSettings.update('app-settings-global', { remoteId: s.id });
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao processar pull de configurações do app:', err);
    // Não lançar erro - configurações não são críticas para funcionamento
  }

  // Buscar permissões por role (motor genérico: incremental + batch)
  try {
    await pullEntity({
      remoteTable: 'role_permissions_online',
      orderBy: 'updated_at',
      updatedAtField: 'updated_at',
      localTable: db.rolePermissions as any,
      mapper: (s: any) => ({ id: s.uuid, role: s.role, permission: s.permission, granted: s.granted, createdAt: s.created_at, updatedAt: s.updated_at, synced: true, remoteId: s.id })
    });
  } catch (err) {
    console.error('Erro ao processar pull de permissões:', err);
    // Não lançar erro - permissões não são críticas para funcionamento básico
  }

  // ========================================
  // PULL SISTEMA DE ANIMAIS
  // ========================================

  // Pull tipos, status e origens (motor genérico - bulkPut)
  try {
    await pullEntitySimple('tipos_animal_online', db.tiposAnimal as any, (s: any) => ({ id: s.uuid, nome: s.nome, descricao: s.descricao, ordem: s.ordem, ativo: s.ativo, createdAt: s.created_at, updatedAt: s.updated_at, deletedAt: s.deleted_at, synced: true, remoteId: s.id }));
  } catch (err) {
    console.error('Erro ao fazer pull de tipos de animal:', err);
  }
  try {
    await pullEntitySimple('status_animal_online', db.statusAnimal as any, (s: any) => ({ id: s.uuid, nome: s.nome, cor: s.cor, descricao: s.descricao, ordem: s.ordem, ativo: s.ativo, createdAt: s.created_at, updatedAt: s.updated_at, deletedAt: s.deleted_at, synced: true, remoteId: s.id }));
  } catch (err) {
    console.error('Erro ao fazer pull de status de animal:', err);
  }
  try {
    await pullEntitySimple('origens_online', db.origens as any, (s: any) => ({ id: s.uuid, nome: s.nome, descricao: s.descricao, ordem: s.ordem, ativo: s.ativo, createdAt: s.created_at, updatedAt: s.updated_at, deletedAt: s.deleted_at, synced: true, remoteId: s.id }));
  } catch (err) {
    console.error('Erro ao fazer pull de origens:', err);
  }

  // Pull animais
  try {
    currentStep++;
    startSyncStep('Pull Animais');
    emitSyncProgress('pull', currentStep, totalSteps, 'Sincronizando Animais...');
    
    // Verificar raças disponíveis antes de sincronizar animais
    const racasDisponiveis = await db.racas.toArray();
    console.log(`📊 Raças disponíveis no Dexie antes do pull de animais: ${racasDisponiveis.length}`, 
                racasDisponiveis.map(r => ({ id: r.id, remoteId: r.remoteId, nome: r.nome })));
    
    // Buscar animais com paginação + incremental
    const { getLastPulledAt, setLastPulledAt } = await import('../utils/syncCheckpoints');
    const lastPulledAnimais = getLastPulledAt('animais_online');
    const servAnimais = await fetchAllPaginated<any>('animais_online', {
      orderBy: 'id',
      updatedAtField: lastPulledAnimais ? 'updated_at' : undefined,
      lastPulledAt: lastPulledAnimais || undefined
    });

    if (servAnimais && servAnimais.length > 0) {
      // 🚀 OTIMIZAÇÃO: Carregar todos locais em memória (evita 1857× get individuais)
      const [tiposLocais, statusLocais, origensLocais, fazendasLocais, racasLocais, animaisLocais] = await Promise.all([
        db.tiposAnimal.toArray(),
        db.statusAnimal.toArray(),
        db.origens.toArray(),
        db.fazendas.toArray(),
        db.racas.toArray(),
        db.animais.toArray()
      ]);
      const tiposMap = new Map(tiposLocais.map(t => [t.remoteId, t]));
      const statusMap = new Map(statusLocais.map(st => [st.remoteId, st]));
      const origensMap = new Map(origensLocais.map(o => [o.remoteId, o]));
      const fazendasMap = new Map(fazendasLocais.map(f => [f.remoteId, f]));
      const racasMap = new Map(racasLocais.map(r => [r.remoteId, r]));
      const animaisLocaisMap = new Map(animaisLocais.map(a => [a.id, a]));

      // Buscar racas ausentes em batch (evita await no loop)
      const racasIdsAusentes = [...new Set(servAnimais.map((s: any) => s.raca_id).filter(Boolean))].filter(
        (id: number) => !racasMap.has(id)
      );
      if (racasIdsAusentes.length > 0) {
        try {
          const { data: racasSupabase } = await supabase.from('racas_online').select('*').in('id', racasIdsAusentes);
          if (racasSupabase) {
            const toPutRacas = racasSupabase.map((r: any) => ({ id: r.uuid, nome: r.nome, createdAt: r.created_at, updatedAt: r.updated_at, synced: true, remoteId: r.id }));
            await db.racas.bulkPut(toPutRacas);
            toPutRacas.forEach(r => racasMap.set(r.remoteId!, r));
          }
        } catch (_) { /* ignora */ }
      }

      const margemTimestamp = 1000;
      const toPut: any[] = [];
      for (const s of servAnimais) {
        const animalLocal = animaisLocaisMap.get(s.uuid);
        if (animalLocal && animalLocal.deletedAt && !animalLocal.synced) continue;
        if (animalLocal && !animalLocal.synced) {
          const servUpdated = s.updated_at ? new Date(s.updated_at).getTime() : 0;
          const localUpdated = animalLocal.updatedAt ? new Date(animalLocal.updatedAt).getTime() : 0;
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
          tipoId: tipoLocal?.id || '',
          racaId: racaLocal?.id,
          sexo: s.sexo,
          statusId: statusLocal?.id || '',
          dataNascimento: s.data_nascimento,
          dataCadastro: s.data_cadastro,
          dataEntrada: s.data_entrada,
          dataSaida: s.data_saida,
          origemId: origemLocal?.id || '',
          fazendaId: fazendaLocal?.id || '',
          fazendaOrigemId: s.fazenda_origem_id ? fazendasMap.get(s.fazenda_origem_id)?.id : undefined,
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
          remoteId: s.id
        });
      }
      // bulkPut em lotes de 300 (IndexedDB performa melhor com lotes moderados)
      const BATCH_ANIMAIS = 300;
      for (let i = 0; i < toPut.length; i += BATCH_ANIMAIS) {
        await db.animais.bulkPut(toPut.slice(i, i + BATCH_ANIMAIS));
      }
    }
    const maxUpdatedAnimais = servAnimais?.length ? servAnimais.reduce((max, a) => a.updated_at && (!max || a.updated_at > max) ? a.updated_at : max, null as string | null) : null;
    if (maxUpdatedAnimais) setLastPulledAt('animais_online', maxUpdatedAnimais);
    endSyncStep('Pull Animais', servAnimais?.length || 0);
  } catch (err) {
    console.error('Erro ao fazer pull de animais:', err);
    endSyncStep('Pull Animais', 0);
  }

  // Pull genealogias (paginação + incremental)
  try {
    const { getLastPulledAt: getCheckpoint, setLastPulledAt: setCheckpoint } = await import('../utils/syncCheckpoints');
    const lastPulledGenealogias = getCheckpoint('genealogias_online');
    const servGenealogias = await fetchAllPaginated<any>('genealogias_online', {
      orderBy: 'id',
      updatedAtField: lastPulledGenealogias ? 'updated_at' : undefined,
      lastPulledAt: lastPulledGenealogias || undefined
    });
    if (servGenealogias && servGenealogias.length > 0) {
      // Mapear remoteIds para UUIDs locais - criar Map para lookup O(1)
      const tiposLocais = await db.tiposAnimal.toArray();
      const tiposLocaisMap = new Map(tiposLocais.map(t => [t.remoteId, t]));
      
      // Buscar todas as genealogias locais para verificação
      const todasGenealogiasLocais = await db.genealogias.toArray();
      const genealogiasLocaisMap = new Map(todasGenealogiasLocais.map(g => [g.id, g]));
      
      // Preparar registros para inserção/atualização em lote, respeitando alterações locais
      const genealogiasParaInserir = [];
      
      for (const s of servGenealogias) {
        const local = genealogiasLocaisMap.get(s.uuid);
        
        // IMPORTANTE: Não sobrescrever se há alterações locais não sincronizadas
        // ou se os dados locais são mais recentes que os do servidor
        if (local && !local.synced) {
          const servUpdated = s.updated_at ? new Date(s.updated_at).getTime() : 0;
          const localUpdated = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
          const margemTimestamp = 1000; // 1 segundo de margem
          
          // Se dados locais são mais recentes ou iguais (dentro da margem), não sobrescrever
          if (localUpdated >= servUpdated - margemTimestamp) {
            console.log(`⏸️ Genealogia ${s.uuid} tem alterações locais não sincronizadas, pulando pull`);
            continue;
          }
        }
        
        // Atualizar apenas se não existe localmente, não tem remoteId, ou servidor é mais recente
        if (!local || !local.remoteId || (local.updatedAt && new Date(local.updatedAt) < new Date(s.updated_at))) {
          const tipoMatrizLocal = s.tipo_matriz_id ? tiposLocaisMap.get(s.tipo_matriz_id) : null;
          
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
            remoteId: s.id
          });
        }
      }
      
      // Inserir/atualizar em lote apenas os que devem ser atualizados
      if (genealogiasParaInserir.length > 0) {
        await db.genealogias.bulkPut(genealogiasParaInserir);
      }
      const maxUpdatedGenealogias = servGenealogias?.length ? servGenealogias.reduce((max, g) => g.updated_at && (!max || g.updated_at > max) ? g.updated_at : max, null as string | null) : null;
      if (maxUpdatedGenealogias) setCheckpoint('genealogias_online', maxUpdatedGenealogias);
    }
  } catch (err) {
    console.error('Erro ao fazer pull de genealogias:', err);
  }
}

/**
 * Sincroniza apenas usuários do servidor (usado na inicialização)
 * Mais rápido que pullUpdates completo
 * IMPORTANTE: Não exclui usuários locais, apenas adiciona/atualiza do servidor
 */
export async function pullUsuarios() {
  try {
    const { data: servUsuarios, error: errorUsuarios } = await supabase.from('usuarios_online').select('*');
    if (errorUsuarios) {
      console.error('Erro ao buscar usuários do servidor:', errorUsuarios);
      // Não lançar erro - permitir continuar com dados locais
      return;
    }
    if (servUsuarios && servUsuarios.length > 0) {
      // IMPORTANTE: Não excluir usuários locais nesta função!
      const usuariosLocais = await db.usuarios.toArray();
      const usuariosMap = new Map(usuariosLocais.map(u => [u.id, u]));
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
          remoteId: s.id
        };
        if (!local) {
          toPut.push(rec);
        } else if (local.remoteId && new Date(local.updatedAt) < new Date(s.updated_at)) {
          toUpdate.push({ key: s.uuid, changes: rec });
        } else if (!local.remoteId) {
          toUpdate.push({
            key: s.uuid,
            changes: {
              synced: true,
              remoteId: s.id,
              updatedAt: s.updated_at > local.updatedAt ? s.updated_at : local.updatedAt
            }
          });
        }
      }
      if (toPut.length > 0) await db.usuarios.bulkPut(toPut);
      if (toUpdate.length > 0) await db.usuarios.bulkUpdate(toUpdate);
    }
    // Se servUsuarios for null ou vazio, não fazer nada (preservar dados locais)
  } catch (err) {
    console.error('Erro ao processar pull de usuários:', err);
    // Não lançar erro para não bloquear o login
    // Apenas logar o erro e continuar com dados locais
  }

  // Buscar notificações lidas (motor genérico: incremental + batch)
  try {
    if (db.notificacoesLidas) {
      await pullEntity({
        remoteTable: 'notificacoes_lidas_online',
        orderBy: 'marcada_em',
        updatedAtField: 'marcada_em',
        updatedAtFieldLocal: 'marcadaEm',
        localTable: db.notificacoesLidas as any,
        mapper: (s: any) => ({ id: s.uuid, tipo: s.tipo, usuarioId: s.usuario_uuid || s.usuario_id || '', marcadaEm: s.marcada_em, synced: true, remoteId: s.id })
      });
    }
  } catch (err: any) {
    console.error('Erro ao processar pull de notificações lidas:', err?.message);
  }

  // Pull de auditoria
  try {
    if (db.audits) {
      const { data: servAudits, error: errorAudits } = await supabase
        .from('audits_online')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000); // Limitar a 1000 registros mais recentes para evitar sobrecarga

      if (errorAudits) {
        console.error('Erro ao buscar auditoria do servidor:', {
          error: errorAudits,
          message: errorAudits.message,
          code: errorAudits.code,
          details: errorAudits.details,
          hint: errorAudits.hint
        });
      } else if (servAudits && servAudits.length > 0) {
        const servUuids = new Set(servAudits.map((a: any) => a.uuid).filter(Boolean));
        const todosAuditsLocais = await db.audits.toArray();
        const auditsLocaisMap = new Map(todosAuditsLocais.map(a => [a.id, a]));
        const idsParaDeletar = todosAuditsLocais
          .filter(a => a.remoteId != null && !servUuids.has(a.id))
          .map(a => a.id);
        if (idsParaDeletar.length > 0) await db.audits.bulkDelete(idsParaDeletar);
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
            remoteId: s.id
          };
          if (!local) {
            toPut.push(rec);
          } else if (!local.remoteId || new Date(local.timestamp) < new Date(s.timestamp)) {
            toUpdate.push({ key: s.uuid, changes: rec });
          }
        }
        if (toPut.length > 0) await db.audits.bulkPut(toPut);
        if (toUpdate.length > 0) await db.audits.bulkUpdate(toUpdate);
      }
    }
  } catch (err) {
    console.error('Erro ao processar pull de auditoria:', err);
    // Não lançar erro - auditoria não é crítica para funcionamento
  }

  // ========================================
  // MÓDULO DE CONFINAMENTO
  // ========================================

  // Pull de confinamentos
  try {
    currentStep++;
    startSyncStep('Pull Confinamentos');
    emitSyncProgress('pull', currentStep, totalSteps, 'Sincronizando Confinamentos...');
    const n = await pullEntity({
      remoteTable: 'confinamentos_online',
      orderBy: 'updated_at',
      updatedAtField: 'updated_at',
      localTable: db.confinamentos as any,
      mapper: (s: any) => ({
        id: s.uuid,
        fazendaId: s.fazenda_uuid || s.fazenda_id || '',
        nome: s.nome,
        dataInicio: s.data_inicio,
        dataFimPrevista: s.data_fim_prevista || undefined,
        dataFimReal: s.data_fim_real || undefined,
        status: s.status,
        observacoes: s.observacoes || undefined,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        synced: true,
        remoteId: s.id,
        deletedAt: s.deleted_at || undefined
      })
    });
    endSyncStep('Pull Confinamentos', n);
  } catch (err) {
    console.error('Erro ao processar pull de confinamentos:', err);
    endSyncStep('Pull Confinamentos', 0);
  }

  // Pull de confinamento_animais
  try {
    currentStep++;
    startSyncStep('Pull Confinamento Animais');
    emitSyncProgress('pull', currentStep, totalSteps, 'Sincronizando Vínculos Animal-Confinamento...');
    const n = await pullEntity({
      remoteTable: 'confinamento_animais_online',
      orderBy: 'updated_at',
      updatedAtField: 'updated_at',
      localTable: db.confinamentoAnimais as any,
      mapper: (s: any) => ({
        id: s.uuid,
        confinamentoId: s.confinamento_uuid || s.confinamento_id || '',
        animalId: s.animal_uuid || s.animal_id || '',
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
        deletedAt: s.deleted_at || undefined
      })
    });
    endSyncStep('Pull Confinamento Animais', n);
  } catch (err) {
    console.error('Erro ao processar pull de confinamento_animais:', err);
    endSyncStep('Pull Confinamento Animais', 0);
  }

  // Pull de confinamento_pesagens
  try {
    currentStep++;
    startSyncStep('Pull Confinamento Pesagens');
    emitSyncProgress('pull', currentStep, totalSteps, 'Sincronizando Pesagens de Confinamento...');
    const n = await pullEntity({
      remoteTable: 'confinamento_pesagens_online',
      orderBy: 'updated_at',
      updatedAtField: 'updated_at',
      localTable: db.confinamentoPesagens as any,
      mapper: (s: any) => ({
        id: s.uuid,
        confinamentoAnimalId: s.confinamento_animal_uuid || s.confinamento_animal_id || '',
        data: s.data,
        peso: s.peso,
        observacoes: s.observacoes || undefined,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        synced: true,
        remoteId: s.id,
        deletedAt: s.deleted_at || undefined
      })
    });
    endSyncStep('Pull Confinamento Pesagens', n);
  } catch (err) {
    console.error('Erro ao processar pull de confinamento_pesagens:', err);
    endSyncStep('Pull Confinamento Pesagens', 0);
  }

  // Pull de confinamento_alimentacao
  try {
    currentStep++;
    startSyncStep('Pull Confinamento Alimentação');
    emitSyncProgress('pull', currentStep, totalSteps, 'Sincronizando Alimentação de Confinamento...');
    const n = await pullEntity({
      remoteTable: 'confinamento_alimentacao_online',
      orderBy: 'updated_at',
      updatedAtField: 'updated_at',
      localTable: db.confinamentoAlimentacao as any,
      mapper: (s: any) => ({
        id: s.uuid,
        confinamentoId: s.confinamento_uuid || s.confinamento_id || '',
        data: s.data,
        tipoDieta: s.tipo_dieta || undefined,
        custoTotal: s.custo_total || undefined,
        observacoes: s.observacoes || undefined,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        synced: true,
        remoteId: s.id,
        deletedAt: s.deleted_at || undefined
      })
    });
    endSyncStep('Pull Confinamento Alimentação', n);
  } catch (err) {
    console.error('Erro ao processar pull de confinamento_alimentacao:', err);
    endSyncStep('Pull Confinamento Alimentação', 0);
  }
}

// Guard para evitar múltiplas sincronizações simultâneas
let isSyncing = false;

export async function syncAll(): Promise<{ ran: boolean }> {
  // Evitar múltiplas sincronizações simultâneas
  if (isSyncing) {
    return { ran: false };
  }

  isSyncing = true;
  
  // Inicializar estatísticas de sincronização
  currentSyncStats = {
    startTime: Date.now(),
    steps: {}
  };
  
  console.log('🚀 ========================================');
  console.log('🚀 INICIANDO SINCRONIZAÇÃO COMPLETA');
  console.log('🚀 ========================================');
  
  // Atualizar estado global de sincronização (usado por TopBar e página Sincronização)
  if (typeof window !== 'undefined') {
    const { setGlobalSyncing } = await import('../utils/syncState');
    setGlobalSyncing(true);
  }
  
  try {
    // IMPORTANTE: Fazer pull ANTES do push para evitar conflitos de timestamp
    // Isso garante que pegamos as mudanças do servidor antes de enviar as nossas
    await pullUpdates();
    await pushPending();
    
    // Finalizar estatísticas
    if (currentSyncStats) {
      currentSyncStats.endTime = Date.now();
      currentSyncStats.duration = currentSyncStats.endTime - currentSyncStats.startTime;
      
      // Calcular total de registros processados
      const totalRecords = Object.values(currentSyncStats.steps).reduce(
        (sum, step) => sum + step.recordsProcessed,
        0
      );
      
      console.log('✅ ========================================');
      console.log(`✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO`);
      console.log(`✅ Tempo total: ${(currentSyncStats.duration / 1000).toFixed(2)}s`);
      console.log(`✅ Total de registros processados: ${totalRecords}`);
      console.log('✅ ========================================');
      
      // Detalhes por etapa
      const stepsWithData = Object.entries(currentSyncStats.steps).filter(
        ([, step]) => step.recordsProcessed > 0
      );
      
      if (stepsWithData.length > 0) {
        console.log('📊 Detalhes por etapa:');
        stepsWithData.forEach(([name, step]) => {
          const duration = step.duration ? (step.duration / 1000).toFixed(2) : '?';
          console.log(`   • ${name}: ${step.recordsProcessed} registros em ${duration}s`);
        });
      }
    }
    
    // Salvar timestamp da última sincronização bem-sucedida (manual ou automática)
    if (typeof window !== 'undefined') {
      const timestamp = new Date().toISOString();
      localStorage.setItem('lastSyncTimestamp', timestamp);
      
      // Disparar evento para atualizar componentes que escutam (com estatísticas)
      window.dispatchEvent(new CustomEvent('syncCompleted', { 
        detail: { 
          timestamp, 
          success: true,
          stats: currentSyncStats
        }
      }));
    }
    return { ran: true };
  } catch (error) {
    console.error('❌ ========================================');
    console.error('❌ ERRO DURANTE SINCRONIZAÇÃO');
    console.error('❌ ========================================');
    console.error('❌ Detalhes:', error);
    
    // Finalizar estatísticas com erro
    if (currentSyncStats) {
      currentSyncStats.endTime = Date.now();
      currentSyncStats.duration = currentSyncStats.endTime - currentSyncStats.startTime;
    }
    
    // Disparar evento de erro
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syncCompleted', { 
        detail: { 
          timestamp: new Date().toISOString(), 
          success: false, 
          error,
          stats: currentSyncStats
        } 
      }));
    }
    throw error; // Propagar erro para o caller
  } finally {
    isSyncing = false;
    if (typeof window !== 'undefined') {
      const { setGlobalSyncing } = await import('../utils/syncState');
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
  if (typeof window !== 'undefined') {
    const { clearLastPulledAt } = await import('../utils/syncCheckpoints');
    clearLastPulledAt(); // Limpa todos os checkpoints = full pull em todas as tabelas
  }
  return syncAll();
}
