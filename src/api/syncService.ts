import { db } from '../db/dexieDB';
import { supabase } from './supabaseClient';

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

  // Sincronizar categorias primeiro (antes de raças, pois são mais simples)
  try {
    // Query mais segura: buscar todos e filtrar manualmente
    const todasCategorias = await db.categorias.toArray();
    const pendCategorias = todasCategorias.filter(c => c.synced === false);
    for (const c of pendCategorias) {
      try {
        const { data, error } = await supabase
          .from('categorias_online')
          .upsert(
            {
              uuid: c.id,
              nome: c.nome,
              created_at: c.createdAt,
              updated_at: c.updatedAt
            },
            { onConflict: 'uuid' }
          )
          .select('id, uuid');

        if (!error && data && data.length) {
          await db.categorias.update(c.id, { synced: true, remoteId: data[0].id });
        } else if (error) {
          console.error('Erro ao sincronizar categoria:', {
            error: error,
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            categoriaId: c.id,
            nome: c.nome
          });
        }
      } catch (err) {
        console.error('Erro ao processar categoria:', err, c.id);
      }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de categorias:', err);
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

  // Sincronizar matrizes (vacas/novilhas)
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
          data_desmama: toIsoDate(d.dataDesmama),
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

  // Sincronizar auditoria (somente push - não puxa de volta)
  try {
    if (db.audits) {
      const todosAudits = await db.audits.toArray();
      const pendAudits = todosAudits.filter((a) => a.synced === false);

      for (const a of pendAudits) {
        try {
          const { data, error } = await supabase
            .from('audits_online')
            .upsert(
              {
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
              },
              { onConflict: 'uuid' }
            )
            .select('id, uuid');

          if (!error && data && data.length) {
            await db.audits.update(a.id, { synced: true, remoteId: data[0].id });
          } else if (error) {
            console.error('Erro ao sincronizar audit log:', {
              error,
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              auditId: a.id,
              entity: a.entity,
              entityId: a.entityId
            });
          }
        } catch (err) {
          console.error('Erro ao processar audit log:', err, a.id);
        }
      }
    }
  } catch (err) {
    console.error('Erro geral ao fazer push de auditoria:', err);
  }

  // Sincronizar notificações lidas
  try {
    if (db.notificacoesLidas) {
      const todasNotificacoes = await db.notificacoesLidas.toArray();
      const pendNotificacoes = todasNotificacoes.filter(n => n.synced === false);

      for (const n of pendNotificacoes) {
        try {
          const { data, error } = await supabase
            .from('notificacoes_lidas_online')
            .upsert(
              {
                uuid: n.id,
                tipo: n.tipo,
                marcada_em: n.marcadaEm,
                created_at: n.marcadaEm,
                updated_at: n.marcadaEm
              },
              { onConflict: 'uuid' }
            )
            .select('id, uuid');

          if (!error && data && data.length) {
            await db.notificacoesLidas.update(n.id, { synced: true, remoteId: data[0].id });
          } else if (error) {
            console.error('Erro ao sincronizar notificação lida:', {
              error: error,
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
              notificacaoId: n.id,
              tipo: n.tipo
            });
          }
        } catch (err: any) {
          console.error('Erro ao processar notificação lida:', {
            error: err,
            message: err?.message,
            stack: err?.stack,
            notificacaoId: n.id,
            tipo: n.tipo
          });
        }
      }
    }
  } catch (err: any) {
    console.error('Erro geral ao fazer push de notificações lidas:', {
      error: err,
      message: err?.message,
      stack: err?.stack
    });
  }

  // Sincronizar configurações de alerta
  try {
    if (db.alertSettings) {
      const todasSettings = await db.alertSettings.toArray();
      const pendSettings = todasSettings.filter(s => s.synced === false);
      
      for (const s of pendSettings) {
        try {
          // Sempre usar timestamp atual para garantir que seja mais recente
          const now = new Date().toISOString();
          const { data, error } = await supabase
            .from('alert_settings_online')
            .upsert(
              {
                uuid: s.id,
                limite_meses_desmama: s.limiteMesesDesmama,
                janela_meses_mortalidade: s.janelaMesesMortalidade,
                limiar_mortalidade: s.limiarMortalidade,
                created_at: s.createdAt || now,
                updated_at: now // Sempre atualizar para garantir que seja mais recente
              },
              { onConflict: 'uuid' }
            )
            .select('id, uuid, updated_at');

          if (!error && data && data.length) {
            // Atualizar com o updated_at retornado pelo servidor
            await db.alertSettings.update(s.id, { 
              synced: true, 
              remoteId: data[0].id,
              updatedAt: data[0].updated_at || now
            });
          } else if (error) {
            console.error('Erro ao sincronizar configurações de alerta:', {
              error: error,
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
              settingsId: s.id
            });
          }
        } catch (err: any) {
          console.error('Erro ao processar configurações de alerta:', {
            error: err,
            message: err?.message,
            stack: err?.stack,
            settingsId: s.id
          });
        }
      }
    }
  } catch (err: any) {
    console.error('Erro geral ao fazer push de configurações de alerta:', {
      error: err,
      message: err?.message,
      stack: err?.stack
    });
  }
}

export async function pullUpdates() {
  // Buscar categorias primeiro
  try {
    const { data: servCategorias, error: errorCategorias } = await supabase.from('categorias_online').select('*');
    if (errorCategorias) {
      console.error('Erro ao buscar categorias do servidor:', {
        error: errorCategorias,
        message: errorCategorias.message,
        code: errorCategorias.code,
        details: errorCategorias.details,
        hint: errorCategorias.hint
      });
    } else if (servCategorias && servCategorias.length > 0) {
      const servUuids = new Set(servCategorias.map(c => c.uuid));
      
      const todasCategoriasLocais = await db.categorias.toArray();
      const categoriasSincronizadas = todasCategoriasLocais.filter(c => c.remoteId != null);
      
      for (const local of categoriasSincronizadas) {
        if (!servUuids.has(local.id)) {
          await db.categorias.delete(local.id);
        }
      }
      
      for (const s of servCategorias) {
        const local = await db.categorias.get(s.uuid);
        if (!local) {
          await db.categorias.add({
            id: s.uuid,
            nome: s.nome,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            synced: true,
            remoteId: s.id
          });
        } else {
          if (new Date(local.updatedAt) < new Date(s.updated_at)) {
            await db.categorias.update(local.id, {
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
    console.error('Erro ao processar pull de categorias:', err);
  }

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

  // Buscar matrizes
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
          try {
            const d = new Date(s.data_nascimento);
            if (!isNaN(d.getTime())) {
              dataNascimentoBR = d.toLocaleDateString('pt-BR');
            }
          } catch {
            // Se der erro, mantém undefined e evita quebrar
          }
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
          // Verificar se já existe uma matriz com esse UUID antes de adicionar
          const existePorUuid = await db.matrizes.get(s.uuid);
          if (!existePorUuid) {
            try {
              await db.matrizes.add({
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
            } catch (addError: any) {
              // Se der erro de constraint, pode ser que a matriz já existe
              // Tentar atualizar ao invés de adicionar
              if (addError.name === 'ConstraintError' || addError.message?.includes('Key already exists')) {
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
                throw addError;
              }
            }
          }
        } else {
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

  // Buscar auditoria (pull) - sincronizar logs de auditoria de outros dispositivos
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
        // Criar conjunto de UUIDs que existem no servidor
        const servUuids = new Set(servAudits.map(a => a.uuid));

        // Buscar todos os audits locais que foram sincronizados (têm remoteId)
        const todosAuditsLocais = await db.audits.toArray();
        const auditsSincronizados = todosAuditsLocais.filter(a => a.remoteId != null);

        // Excluir localmente os que não existem mais no servidor
        // (apenas se foram sincronizados anteriormente)
        for (const local of auditsSincronizados) {
          if (!servUuids.has(local.id)) {
            await db.audits.delete(local.id);
          }
        }

        // Adicionar/atualizar audits do servidor
        for (const s of servAudits) {
          const local = await db.audits.get(s.uuid);
          if (!local) {
            try {
              await db.audits.add({
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
              });
            } catch (addError: any) {
              if (addError.name === 'ConstraintError' || addError.message?.includes('already exists')) {
                // Se já existe, atualizar
                const existing = await db.audits.get(s.uuid);
                if (existing) {
                  await db.audits.update(s.uuid, {
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
                  });
                }
              } else {
                console.error('Erro ao adicionar audit do servidor:', addError);
              }
            }
          } else {
            // Atualizar apenas se o servidor tem versão mais recente ou se não tem remoteId
            if (!local.remoteId || new Date(local.timestamp) < new Date(s.timestamp)) {
              await db.audits.update(local.id, {
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
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao processar pull de auditoria:', err);
    // Não lançar erro - auditoria não é crítica para funcionamento
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
          // Criar local se não existir
          await db.alertSettings.add({
            id: 'alert-settings-global',
            limiteMesesDesmama: s.limite_meses_desmama,
            janelaMesesMortalidade: s.janela_meses_mortalidade,
            limiarMortalidade: s.limiar_mortalidade,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            synced: true,
            remoteId: s.id
          });
          
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

  // Buscar notificações lidas
  try {
    const { data: servNotificacoes, error: errorNotificacoes } = await supabase.from('notificacoes_lidas_online').select('*');
    if (errorNotificacoes) {
      console.error('Erro ao buscar notificações lidas do servidor:', {
        error: errorNotificacoes,
        message: errorNotificacoes.message,
        code: errorNotificacoes.code,
        details: errorNotificacoes.details,
        hint: errorNotificacoes.hint
      });
      // Não excluir dados locais em caso de erro
    } else if (servNotificacoes) {
      // Processar mesmo se o array estiver vazio (para garantir que dados locais não sincronizados sejam preservados)
      // Mas só fazer merge se houver dados no servidor
      if (servNotificacoes.length > 0) {
        // IMPORTANTE: Só processar se houver dados no servidor
        // Se servNotificacoes for [] (vazio), preservar dados locais
        
        // Criar conjunto de UUIDs que existem no servidor
        const servUuids = new Set(servNotificacoes.map(n => n.uuid));
        
        // Buscar todas as notificações locais que foram sincronizadas (têm remoteId)
        if (db.notificacoesLidas) {
          const todasNotificacoesLocais = await db.notificacoesLidas.toArray();
          const notificacoesSincronizadas = todasNotificacoesLocais.filter(n => n.remoteId != null);
          
          // Excluir localmente as que não existem mais no servidor
          // Mas só se o servidor retornou dados (não está vazio)
          for (const local of notificacoesSincronizadas) {
            if (!servUuids.has(local.id)) {
              await db.notificacoesLidas.delete(local.id);
            }
          }
          
          // Adicionar/atualizar notificações do servidor
          for (const s of servNotificacoes) {
            const local = await db.notificacoesLidas.get(s.uuid);
            if (!local) {
              // Adicionar notificação do servidor que não existe localmente
              try {
                await db.notificacoesLidas.add({
                  id: s.uuid,
                  tipo: s.tipo,
                  marcadaEm: s.marcada_em,
                  synced: true,
                  remoteId: s.id
                });
              } catch (addError: any) {
                // Se der erro ao adicionar (ex: chave duplicada), tentar atualizar
                if (addError.name === 'ConstraintError' || addError.message?.includes('already exists')) {
                  const existing = await db.notificacoesLidas.get(s.uuid);
                  if (existing) {
                    await db.notificacoesLidas.update(s.uuid, {
                      tipo: s.tipo,
                      marcadaEm: s.marcada_em,
                      synced: true,
                      remoteId: s.id
                    });
                  }
                } else {
                  console.error('Erro ao adicionar notificação lida do servidor:', addError);
                }
              }
            } else {
              // Atualizar notificação existente
              // Se não tem remoteId OU se a versão do servidor for mais recente
              const servidorMaisRecente = !local.remoteId || new Date(local.marcadaEm) < new Date(s.marcada_em);
              if (servidorMaisRecente) {
                await db.notificacoesLidas.update(local.id, {
                  tipo: s.tipo,
                  marcadaEm: s.marcada_em,
                  synced: true,
                  remoteId: s.id
                });
              } else if (!local.remoteId) {
                // Se não tem remoteId mas a versão local é mais recente, apenas adicionar remoteId
                // Mas manter synced: false para que seja enviado ao servidor na próxima sincronização
                await db.notificacoesLidas.update(local.id, {
                  synced: false, // Manter como não sincronizado se a versão local é mais recente
                  remoteId: s.id
                });
              } else if (local.remoteId && local.remoteId !== s.id) {
                // Se tem remoteId diferente, pode ser um duplicado - atualizar para usar o do servidor
                await db.notificacoesLidas.update(local.id, {
                  synced: true,
                  remoteId: s.id
                });
              }
            }
          }
        }
      }
      // Se servNotificacoes.length === 0, não fazer nada (preservar dados locais)
    }
  } catch (err: any) {
    console.error('Erro ao processar pull de notificações lidas:', {
      error: err,
      message: err?.message,
      stack: err?.stack
    });
    // Não lançar erro para não bloquear o pull de outras tabelas
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
        const servUuids = new Set(servAudits.map(a => a.uuid));
        const todosAuditsLocais = await db.audits.toArray();
        const auditsSincronizados = todosAuditsLocais.filter(a => a.remoteId != null);

        for (const local of auditsSincronizados) {
          if (!servUuids.has(local.id)) {
            await db.audits.delete(local.id);
          }
        }

        for (const s of servAudits) {
          const local = await db.audits.get(s.uuid);
          if (!local) {
            try {
              await db.audits.add({
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
              });
            } catch (addError: any) {
              if (addError.name === 'ConstraintError' || addError.message?.includes('already exists')) {
                const existing = await db.audits.get(s.uuid);
                if (existing) {
                  await db.audits.update(s.uuid, {
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
                  });
                }
              } else {
                console.error('Erro ao adicionar audit do servidor:', addError);
              }
            }
          } else {
            if (!local.remoteId || new Date(local.timestamp) < new Date(s.timestamp)) {
              await db.audits.update(local.id, {
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
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao processar pull de auditoria:', err);
    // Não lançar erro - auditoria não é crítica para funcionamento
  }
}

export async function syncAll() {
  // Atualizar estado global de sincronização via evento customizado
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('syncStateChange', { detail: { syncing: true } }));
  }
  
  try {
    // IMPORTANTE: Fazer pull ANTES do push para evitar conflitos de timestamp
    // Isso garante que pegamos as mudanças do servidor antes de enviar as nossas
    await pullUpdates();
    await pushPending();
  } catch (error) {
    console.error('❌ Erro durante sincronização:', error);
    throw error;
  } finally {
    // Sempre atualizar estado para false ao finalizar
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syncStateChange', { detail: { syncing: false } }));
    }
  }
}
