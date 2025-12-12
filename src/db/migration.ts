import { db } from './dexieDB';

/**
 * Migra dados antigos para o novo formato
 * Adiciona campos fazendaId, mes, ano para registros que não os têm
 */
export async function migrateOldData() {
  try {
    // Verificar se há nascimentos sem fazendaId, mes ou ano
    const todosNascimentos = await db.nascimentos.toArray();
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    // Buscar primeira fazenda ou criar uma padrão
    const fazendas = await db.fazendas.toArray();
    let fazendaPadraoId: string;

    if (fazendas.length === 0) {
      // Criar fazenda padrão se não existir nenhuma
      const { uuid } = await import('../utils/uuid');
      fazendaPadraoId = uuid();
      const now = new Date().toISOString();
      await db.fazendas.add({
        id: fazendaPadraoId,
        nome: 'Fazenda Padrão',
        createdAt: now,
        updatedAt: now,
        synced: false
      });
    } else {
      fazendaPadraoId = fazendas[0].id;
    }

    // Migrar nascimentos antigos
    for (const nascimento of todosNascimentos) {
      const updates: any = {};
      let precisaAtualizar = false;

      if (!nascimento.fazendaId) {
        updates.fazendaId = fazendaPadraoId;
        precisaAtualizar = true;
      }

      if (!nascimento.mes || nascimento.mes < 1 || nascimento.mes > 12) {
        // Tentar extrair mês da data de nascimento, senão usar mês atual
        if (nascimento.dataNascimento) {
          try {
            const data = new Date(nascimento.dataNascimento);
            updates.mes = data.getMonth() + 1;
          } catch {
            updates.mes = mesAtual;
          }
        } else {
          updates.mes = mesAtual;
        }
        precisaAtualizar = true;
      }

      if (!nascimento.ano || nascimento.ano < 2000 || nascimento.ano > 2100) {
        // Tentar extrair ano da data de nascimento, senão usar ano atual
        if (nascimento.dataNascimento) {
          try {
            const data = new Date(nascimento.dataNascimento);
            updates.ano = data.getFullYear();
          } catch {
            updates.ano = anoAtual;
          }
        } else {
          updates.ano = anoAtual;
        }
        precisaAtualizar = true;
      }

      if (precisaAtualizar) {
        updates.updatedAt = new Date().toISOString();
        await db.nascimentos.update(nascimento.id, updates);
      }
    }

    // Migração: Adicionar campo morto aos nascimentos existentes
    const nascimentosSemMorto = await db.nascimentos
      .filter(n => n.morto === undefined)
      .toArray();
    
    for (const nascimento of nascimentosSemMorto) {
      await db.nascimentos.update(nascimento.id, {
        morto: false,
        updatedAt: new Date().toISOString()
      });
    }

    console.log('Migração de dados concluída');
  } catch (error) {
    console.error('Erro na migração de dados:', error);
  }
}

