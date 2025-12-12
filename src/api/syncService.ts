import { db } from '../db/dexieDB';
import { supabase } from './supabaseClient';

export async function pushPending() {
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
            const { error } = await supabase.from('nascimentos_online').delete().eq('id', deleted.remoteId);
            if (!error) {
              await db.deletedRecords.update(deleted.id, { synced: true });
            } else {
              // Se o erro for que o registro não existe mais, marcar como sincronizado
              if (error.code === 'PGRST116' || error.message?.includes('No rows') || error.message?.includes('not found')) {
                await db.deletedRecords.update(deleted.id, { synced: true });
              } else {
                console.error('Erro ao sincronizar exclusão no servidor:', error, deleted.uuid);
              }
            }
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

  // Sincronizar raças primeiro (antes de fazendas, pois são mais simples)
  try {
    // Query mais segura: buscar todos e filtrar manualmente
    const todasRacas = await db.racas.toArray();
    const pendRacas = todasRacas.filter(r => r.synced === false);
    for (const r of pendRacas) {
      try {
        const { data, error } = await supabase
          .from('racas_online')
          .upsert(
            {
              uuid: r.id,
              nome: r.nome,
              created_at: r.createdAt,
              updated_at: r.updatedAt
            },
            { onConflict: 'uuid' }
          )
          .select('id, uuid');

        if (!error && data && data.length) {
          await db.racas.update(r.id, { synced: true, remoteId: data[0].id });
        } else if (error) {
          console.error('Erro ao sincronizar raça:', {
            error: error,
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            racaId: r.id,
            nome: r.nome
          });
        }
      } catch (err) {
        console.error('Erro ao processar raça:', err, r.id);
      }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de raças:', err);
  }

  // Sincronizar fazendas
  try {
    // Query mais segura: buscar todos e filtrar manualmente para evitar erros com dados antigos
    const todasFazendas = await db.fazendas.toArray();
    const pendFaz = todasFazendas.filter(f => f.synced === false);
    for (const f of pendFaz) {
      try {
        const { data, error } = await supabase
          .from('fazendas_online')
          .upsert(
            {
              uuid: f.id,
              nome: f.nome,
              logo_url: f.logoUrl,
              created_at: f.createdAt,
              updated_at: f.updatedAt
            },
            { onConflict: 'uuid' }
          )
          .select('id, uuid');

        if (!error && data && data.length) {
          await db.fazendas.update(f.id, { synced: true, remoteId: data[0].id });
        } else if (error) {
          console.error('Erro ao sincronizar fazenda:', {
            error: error,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            fazendaId: f.id,
            nome: f.nome
          });
        }
      } catch (err) {
        console.error('Erro ao processar fazenda:', err, f.id);
      }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de fazendas:', err);
  }

  // Sincronizar nascimentos
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
          data_nascimento: n.dataNascimento,
          sexo: n.sexo,
          raca: n.raca,
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

  try {
    // Query mais segura para desmamas também
    const todasDesmamas = await db.desmamas.toArray();
    const pendDesm = todasDesmamas.filter(d => d.synced === false);
  for (const d of pendDesm) {
      try {
    const { data, error } = await supabase
      .from('desmamas_online')
      .upsert(
        {
          uuid: d.id,
          nascimento_uuid: d.nascimentoId,
          data_desmama: d.dataDesmama,
          peso_desmama: d.pesoDesmama,
          created_at: d.createdAt,
          updated_at: d.updatedAt
        },
        { onConflict: 'uuid' }
      )
      .select('id, uuid');

    if (!error && data && data.length) {
      await db.desmamas.update(d.id, { synced: true, remoteId: data[0].id });
        } else if (error) {
          console.error('Erro ao sincronizar desmama:', error, d.id);
        }
      } catch (err) {
        console.error('Erro ao processar desmama:', err, d.id);
      }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de desmamas:', err);
    throw err;
  }

  // Sincronizar usuários
  try {
    const todosUsuarios = await db.usuarios.toArray();
    const pendUsuarios = todosUsuarios.filter(u => u.synced === false);
    
    for (const u of pendUsuarios) {
      try {
        const { data, error } = await supabase
          .from('usuarios_online')
          .upsert(
            {
              uuid: u.id,
              nome: u.nome,
              email: u.email,
              senha_hash: u.senhaHash,
              role: u.role,
              fazenda_uuid: u.fazendaId || null,
              ativo: u.ativo,
              created_at: u.createdAt,
              updated_at: u.updatedAt
            },
            { onConflict: 'uuid' }
          )
          .select('id, uuid');

        if (!error && data && data.length) {
          await db.usuarios.update(u.id, { synced: true, remoteId: data[0].id });
        } else if (error) {
          console.error('Erro ao sincronizar usuário:', {
            error: error,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            usuarioId: u.id,
            email: u.email
          });
        }
      } catch (err: any) {
        console.error('Erro ao processar usuário:', {
          error: err,
          message: err?.message,
          stack: err?.stack,
          usuarioId: u.id,
          email: u.email
        });
      }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de usuários:', err);
    throw err;
  }
}

export async function pullUpdates() {
  // Buscar raças primeiro
  try {
    const { data: servRacas, error: errorRacas } = await supabase.from('racas_online').select('*');
    if (errorRacas) {
      console.error('Erro ao buscar raças do servidor:', {
        error: errorRacas,
        message: errorRacas.message,
        code: errorRacas.code,
        details: errorRacas.details,
        hint: errorRacas.hint
      });
      // Não excluir dados locais em caso de erro
    } else if (servRacas && servRacas.length > 0) {
      // IMPORTANTE: Só processar se houver dados no servidor
      // Se servRacas for [] (vazio), preservar dados locais
      
      // Criar conjunto de UUIDs que existem no servidor
      const servUuids = new Set(servRacas.map(r => r.uuid));
      
      // Buscar todas as raças locais que foram sincronizadas (têm remoteId)
      const todasRacasLocais = await db.racas.toArray();
      const racasSincronizadas = todasRacasLocais.filter(r => r.remoteId != null);
      
      // Excluir localmente as que não existem mais no servidor
      // Mas só se o servidor retornou dados (não está vazio)
      for (const local of racasSincronizadas) {
        if (!servUuids.has(local.id)) {
          await db.racas.delete(local.id);
        }
      }
      
      // Adicionar/atualizar raças do servidor
      for (const s of servRacas) {
        const local = await db.racas.get(s.uuid);
        if (!local) {
          await db.racas.add({
            id: s.uuid,
            nome: s.nome,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            synced: true,
            remoteId: s.id
          });
        } else {
          if (new Date(local.updatedAt) < new Date(s.updated_at)) {
            await db.racas.update(local.id, {
              nome: s.nome,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao processar pull de raças:', err);
  }

  // Buscar fazendas
  try {
    const { data: servFaz, error: errorFaz } = await supabase.from('fazendas_online').select('*');
    if (errorFaz) {
      console.error('Erro ao buscar fazendas do servidor:', {
        error: errorFaz,
        message: errorFaz.message,
        code: errorFaz.code,
        details: errorFaz.details,
        hint: errorFaz.hint
      });
      // Não excluir dados locais em caso de erro
    } else if (servFaz && servFaz.length > 0) {
      // IMPORTANTE: Só processar se houver dados no servidor
      // Se servFaz for [] (vazio), preservar dados locais
      
      // Criar conjunto de UUIDs que existem no servidor
      const servUuids = new Set(servFaz.map(f => f.uuid));
      
      // Buscar todas as fazendas locais que foram sincronizadas (têm remoteId)
      const todasFazendasLocais = await db.fazendas.toArray();
      const fazendasSincronizadas = todasFazendasLocais.filter(f => f.remoteId != null);
      
      // Excluir localmente as que não existem mais no servidor
      // Mas só se o servidor retornou dados (não está vazio)
      for (const local of fazendasSincronizadas) {
        if (!servUuids.has(local.id)) {
          console.log('Fazenda excluída no servidor, excluindo localmente:', local.id, local.nome);
          await db.fazendas.delete(local.id);
        }
      }
      
      // Adicionar/atualizar fazendas do servidor
      for (const s of servFaz) {
        const local = await db.fazendas.get(s.uuid);
        if (!local) {
          await db.fazendas.add({
            id: s.uuid,
            nome: s.nome,
            logoUrl: s.logo_url,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            synced: true,
            remoteId: s.id
          });
        } else {
          if (new Date(local.updatedAt) < new Date(s.updated_at)) {
            await db.fazendas.update(local.id, {
              nome: s.nome,
              logoUrl: s.logo_url,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao processar pull de fazendas:', err);
  }

  // Buscar nascimentos
  try {
    const { data: servNasc, error: errorNasc } = await supabase.from('nascimentos_online').select('*');
    if (errorNasc) {
      console.error('Erro ao buscar nascimentos do servidor:', {
        error: errorNasc,
        message: errorNasc.message,
        code: errorNasc.code,
        details: errorNasc.details,
        hint: errorNasc.hint
      });
      // Não excluir dados locais em caso de erro
    } else if (servNasc && servNasc.length > 0) {
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
            console.log(`Removendo duplicado: ${existingUuidByRemoteId} (mesmo remoteId: ${s.id})`);
          } catch (err) {
            console.warn('Erro ao remover duplicado:', err);
          }
        }
        try {
          await db.nascimentos.add({
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
            raca: s.raca,
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
                raca: s.raca,
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

  try {
    const { data: servDesm, error: errorDesm } = await supabase.from('desmamas_online').select('*');
    if (errorDesm) {
      console.error('Erro ao buscar desmamas do servidor:', {
        error: errorDesm,
        message: errorDesm.message,
        code: errorDesm.code,
        details: errorDesm.details,
        hint: errorDesm.hint
      });
      // Não excluir dados locais em caso de erro
    } else if (servDesm && servDesm.length > 0) {
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
          console.log('Desmama excluída no servidor, excluindo localmente:', local.id);
          await db.desmamas.delete(local.id);
        }
      }
    
    // Adicionar/atualizar desmamas do servidor
    for (const s of servDesm) {
      const local = await db.desmamas.get(s.uuid);
      if (!local) {
        await db.desmamas.add({
          id: s.uuid,
          nascimentoId: s.nascimento_uuid,
          dataDesmama: s.data_desmama,
          pesoDesmama: s.peso_desmama,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          synced: true,
          remoteId: s.id
        });
      } else {
        if (new Date(local.updatedAt) < new Date(s.updated_at)) {
          await db.desmamas.update(local.id, {
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

  // Buscar usuários
  try {
    const { data: servUsuarios, error: errorUsuarios } = await supabase.from('usuarios_online').select('*');
    if (errorUsuarios) {
      console.error('Erro ao buscar usuários do servidor:', errorUsuarios);
      // Não excluir dados locais em caso de erro
    } else if (servUsuarios && servUsuarios.length > 0) {
      // IMPORTANTE: Só processar se houver dados no servidor
      // Se servUsuarios for [] (vazio), preservar dados locais
      
      // Criar conjunto de UUIDs que existem no servidor
      const servUuids = new Set(servUsuarios.map(u => u.uuid));
      
      // Buscar todos os usuários locais que foram sincronizados (têm remoteId)
      const todosUsuariosLocais = await db.usuarios.toArray();
      const usuariosSincronizados = todosUsuariosLocais.filter(u => u.remoteId != null);
      
      // Excluir localmente os que não existem mais no servidor
      // Mas só se o servidor retornou dados (não está vazio)
      for (const local of usuariosSincronizados) {
        if (!servUuids.has(local.id)) {
          console.log('Usuário excluído no servidor, excluindo localmente:', local.id);
          await db.usuarios.delete(local.id);
        }
      }
      
      // Adicionar/atualizar usuários do servidor
      for (const s of servUsuarios) {
        const local = await db.usuarios.get(s.uuid);
        if (!local) {
          await db.usuarios.add({
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
          });
        } else {
          // Atualizar apenas se a versão do servidor for mais recente
          if (new Date(local.updatedAt) < new Date(s.updated_at)) {
            await db.usuarios.update(local.id, {
              nome: s.nome,
              email: s.email,
              senhaHash: s.senha_hash, // Atualizar hash se mudou no servidor
              role: s.role,
              fazendaId: s.fazenda_uuid || undefined,
              ativo: s.ativo,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao processar pull de usuários:', err);
    throw err;
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
      // Esta função é usada na inicialização e não deve perder dados locais
      // Apenas adicionar/atualizar usuários do servidor
      
      // Adicionar/atualizar usuários do servidor
      for (const s of servUsuarios) {
        const local = await db.usuarios.get(s.uuid);
        if (!local) {
          // Adicionar novo usuário do servidor
          await db.usuarios.add({
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
          });
        } else {
          // Atualizar apenas se a versão do servidor for mais recente
          // Mas preservar dados locais se o servidor não tiver remoteId
          if (local.remoteId && new Date(local.updatedAt) < new Date(s.updated_at)) {
            await db.usuarios.update(local.id, {
              nome: s.nome,
              email: s.email,
              senhaHash: s.senha_hash, // Atualizar hash se mudou no servidor
              role: s.role,
              fazendaId: s.fazenda_uuid || undefined,
              ativo: s.ativo,
              updatedAt: s.updated_at,
              synced: true,
              remoteId: s.id
            });
          } else if (!local.remoteId) {
            // Se o usuário local não tem remoteId, atualizar para ter
            await db.usuarios.update(local.id, {
              synced: true,
              remoteId: s.id,
              // Atualizar outros campos apenas se necessário
              updatedAt: s.updated_at > local.updatedAt ? s.updated_at : local.updatedAt
            });
          }
        }
      }
    }
    // Se servUsuarios for null ou vazio, não fazer nada (preservar dados locais)
  } catch (err) {
    console.error('Erro ao processar pull de usuários:', err);
    // Não lançar erro para não bloquear o login
    // Apenas logar o erro e continuar com dados locais
  }
}

export async function syncAll() {
  // Atualizar estado global de sincronização via evento customizado
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('syncStateChange', { detail: { syncing: true } }));
  }
  
  try {
    await pushPending();
    await pullUpdates();
  } finally {
    // Sempre atualizar estado para false ao finalizar
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syncStateChange', { detail: { syncing: false } }));
    }
  }
}
