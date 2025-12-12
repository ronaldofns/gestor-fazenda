import Dexie from 'dexie';
import { Nascimento, Desmama, Fazenda, Raca, Usuario } from './models';

interface DeletedRecord {
  id: string;
  uuid: string; // UUID do registro excluído
  remoteId?: number | null; // ID remoto no Supabase (para poder excluir depois)
  deletedAt: string;
  synced: boolean; // Se a exclusão foi sincronizada com o servidor
}

class AppDB extends Dexie {
  fazendas!: Dexie.Table<Fazenda, string>;
  racas!: Dexie.Table<Raca, string>;
  nascimentos!: Dexie.Table<Nascimento, string>;
  desmamas!: Dexie.Table<Desmama, string>;
  usuarios!: Dexie.Table<Usuario, string>; // Tabela de usuários locais
  deletedRecords!: Dexie.Table<DeletedRecord, string>; // Tabela para rastrear exclusões

  constructor() {
    super('FazendaDB');
    this.version(4).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced' // Nova tabela para rastrear exclusões
    });
    this.version(5).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId', // Adicionar synced e remoteId para racas
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced'
    }).upgrade(async (tx) => {
      // Migrar raças existentes para incluir synced: false
      const racas = await tx.table('racas').toArray();
      for (const raca of racas) {
        await tx.table('racas').update(raca.id, {
          synced: false,
          remoteId: null
        });
      }
    });
    
    // Versão 6: Adicionar índice createdAt para ordenação
    this.version(6).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced'
    });
    
    // Versão 7: Adicionar campo morto aos nascimentos
    this.version(7).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced'
    }).upgrade(async (tx) => {
      // Atualizar todos os nascimentos existentes como vivos (morto = false)
      const nascimentos = await tx.table('nascimentos').toArray();
      for (const nascimento of nascimentos) {
        if (nascimento.morto === undefined) {
          await tx.table('nascimentos').update(nascimento.id, {
            morto: false
          });
        }
      }
    });
    
    // Versão 8: Adicionar tabela de usuários locais
    this.version(8).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced'
    });
  }
}

export const db = new AppDB();

// Garantir que o banco está aberto e tratar erros de compatibilidade
db.open().catch(err => {
  console.error('Erro ao abrir banco de dados:', err);
  // Em caso de erro, tentar recriar o banco
  if (err.name === 'DatabaseClosedError' || err.name === 'OpenFailedError') {
    console.warn('Tentando recriar banco de dados...');
    // Não fazer nada aqui, deixar o componente tentar abrir novamente
  }
});
