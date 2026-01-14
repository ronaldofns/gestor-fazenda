import { db } from '../db/dexieDB';
import { SyncEvent, SyncEventType, SyncEntity } from '../db/models';
import { uuid } from './uuid';

const MAX_TENTATIVAS = 5; // Máximo de tentativas antes de marcar como erro permanente

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
 * Processa um evento de sincronização
 * Retorna true se foi processado com sucesso, false caso contrário
 */
export async function processSyncEvent(event: SyncEvent): Promise<boolean> {
  try {
    const { supabase } = await import('../api/supabaseClient');
    
    // Incrementar tentativas
    const tentativas = event.tentativas + 1;
    const now = new Date().toISOString();

    // Determinar a tabela do Supabase baseada na entidade
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
      vacina: 'vacinacoes_online'
    };

    // Mapeamento de campos UUID (algumas tabelas usam 'uuid', outras 'id')
    const uuidFieldMap: Record<SyncEntity, string> = {
      fazenda: 'uuid',
      raca: 'uuid',
      categoria: 'uuid',
      nascimento: 'uuid',
      desmama: 'uuid',
      matriz: 'uuid',
      usuario: 'id', // usuarios_online usa 'id' como UUID
      audit: 'uuid',
      notificacaoLida: 'id', // notificacoes_lidas_online usa 'id' como chave
      alertSettings: 'id',
      appSettings: 'id',
      rolePermission: 'id',
      pesagem: 'uuid',
      vacina: 'uuid'
    };

    const tableName = tableMap[event.entidade];
    if (!tableName) {
      throw new Error(`Tabela não encontrada para entidade: ${event.entidade}`);
    }

    let result: any;
    let error: any = null;

    switch (event.tipo) {
      case 'INSERT':
      case 'UPDATE': {
        const payload = event.payload ? JSON.parse(event.payload) : {};
        const uuidField = uuidFieldMap[event.entidade];
        
        // Determinar o campo de conflito baseado na entidade
        const conflictField = uuidField === 'uuid' ? 'uuid' : 'id';
        
        const { data, error: upsertError } = await supabase
          .from(tableName)
          .upsert(payload, { onConflict: conflictField })
          .select('id, uuid');

        result = data;
        error = upsertError;
        break;
      }
      case 'DELETE': {
        // Para DELETE, precisamos do remoteId
        if (!event.remoteId) {
          // Se não tem remoteId, o registro nunca foi ao servidor, então já está "deletado"
          await db.syncEvents.update(event.id, {
            synced: true,
            tentativas,
            updatedAt: now
          });
          return true;
        }

        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .eq('id', event.remoteId);

        error = deleteError;
        break;
      }
    }

    if (error) {
      // Se excedeu o máximo de tentativas, marcar como erro permanente
      if (tentativas >= MAX_TENTATIVAS) {
        await db.syncEvents.update(event.id, {
          tentativas,
          erro: error.message || 'Erro ao sincronizar após múltiplas tentativas',
          updatedAt: now
        });
        return false;
      }

      // Atualizar com erro e incrementar tentativas
      await db.syncEvents.update(event.id, {
        tentativas,
        erro: error.message || 'Erro desconhecido',
        updatedAt: now
      });
      return false;
    }

    // Sucesso - marcar como sincronizado
    const remoteId = result && result.length > 0 ? result[0].id : event.remoteId;
    await db.syncEvents.update(event.id, {
      synced: true,
      tentativas,
      erro: null,
      remoteId,
      updatedAt: now
    });

    return true;
  } catch (error: any) {
    const tentativas = event.tentativas + 1;
    const now = new Date().toISOString();

    if (tentativas >= MAX_TENTATIVAS) {
      await db.syncEvents.update(event.id, {
        tentativas,
        erro: error.message || 'Erro ao processar evento',
        updatedAt: now
      });
      return false;
    }

    await db.syncEvents.update(event.id, {
      tentativas,
      erro: error.message || 'Erro desconhecido',
      updatedAt: now
    });
    return false;
  }
}

/**
 * Processa todos os eventos pendentes na fila
 */
export async function processSyncQueue(): Promise<{
  processados: number;
  sucesso: number;
  falhas: number;
  erros: Array<{ event: SyncEvent; error: string }>;
}> {
  // Buscar todos os eventos e filtrar manualmente para evitar problemas com índices
  const todosEventos = await db.syncEvents.toArray();
  const eventos = todosEventos.filter(e => !e.synced);

  const resultados = {
    processados: 0,
    sucesso: 0,
    falhas: 0,
    erros: [] as Array<{ event: SyncEvent; error: string }>
  };

  // Processar eventos em ordem (mais antigos primeiro)
  eventos.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  for (const event of eventos) {
    resultados.processados++;
    const sucesso = await processSyncEvent(event);
    
    if (sucesso) {
      resultados.sucesso++;
    } else {
      resultados.falhas++;
      if (event.erro) {
        resultados.erros.push({ event, error: event.erro });
      }
    }
  }

  return resultados;
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
    porTipo: {
      INSERT: 0,
      UPDATE: 0,
      DELETE: 0
    } as Record<SyncEventType, number>,
    porEntidade: {} as Record<SyncEntity, number>
  };

  for (const event of todos) {
    stats.porTipo[event.tipo]++;
    stats.porEntidade[event.entidade] = (stats.porEntidade[event.entidade] || 0) + 1;
  }

  return stats;
}

/**
 * Limpa eventos sincronizados antigos (mais de 7 dias)
 */
export async function cleanupOldSyncEvents(): Promise<number> {
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

  const eventosAntigos = await db.syncEvents
    .where('synced')
    .equals(true)
    .and(e => new Date(e.updatedAt) < seteDiasAtras)
    .toArray();

  const ids = eventosAntigos.map(e => e.id);
  await db.syncEvents.bulkDelete(ids);

  return ids.length;
}
