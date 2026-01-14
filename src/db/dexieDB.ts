import Dexie from 'dexie';
import { Nascimento, Desmama, Fazenda, Raca, Categoria, Usuario, Matriz, AuditLog, NotificacaoLida, AlertSettingsDB, AppSettingsDB, RolePermission, UserRole, PermissionType, SyncEvent, Pesagem, Vacina } from './models';

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
  categorias!: Dexie.Table<Categoria, string>;
  nascimentos!: Dexie.Table<Nascimento, string>;
  desmamas!: Dexie.Table<Desmama, string>;
  pesagens!: Dexie.Table<Pesagem, string>; // Tabela de pesagens periódicas
  vacinacoes!: Dexie.Table<Vacina, string>; // Tabela de vacinações
  usuarios!: Dexie.Table<Usuario, string>; // Tabela de usuários locais
  matrizes!: Dexie.Table<Matriz, string>;
  deletedRecords!: Dexie.Table<DeletedRecord, string>; // Tabela para rastrear exclusões
  audits!: Dexie.Table<AuditLog, string>; // Tabela de auditoria / histórico de alterações
  notificacoesLidas!: Dexie.Table<NotificacaoLida, string>; // Tabela para notificações marcadas como lidas
  alertSettings!: Dexie.Table<AlertSettingsDB, string>; // Tabela para configurações de alerta
  appSettings!: Dexie.Table<AppSettingsDB, string>; // Tabela para configurações do app
  rolePermissions!: Dexie.Table<RolePermission, string>; // Tabela para permissões por role
  syncEvents!: Dexie.Table<SyncEvent, string>; // Tabela para fila de eventos de sincronização

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

    // Versão 9: Adicionar tabela de matrizes
    this.version(9).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, categoria, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced'
    });

    // Versão 10: Tabela de auditoria
    this.version(10).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, categoria, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId'
    });

    // Versão 11: Adicionar tabela de categorias e atualizar matrizes para usar categoriaId
    this.version(11).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      categorias: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId'
    }).upgrade(async (tx) => {
      // Migrar categorias existentes (novilha e vaca) para a nova tabela
      const categoriaNovilhaId = 'categoria-novilha';
      const categoriaVacaId = 'categoria-vaca';
      const now = new Date().toISOString();
      
      await tx.table('categorias').add({
        id: categoriaNovilhaId,
        nome: 'Novilha',
        createdAt: now,
        updatedAt: now,
        synced: false,
        remoteId: null
      });
      
      await tx.table('categorias').add({
        id: categoriaVacaId,
        nome: 'Vaca',
        createdAt: now,
        updatedAt: now,
        synced: false,
        remoteId: null
      });

      // Migrar matrizes existentes: converter categoria (string) para categoriaId
      const matrizes = await tx.table('matrizes').toArray();
      for (const matriz of matrizes) {
        const categoriaId = (matriz as any).categoria === 'novilha' ? categoriaNovilhaId : categoriaVacaId;
        await tx.table('matrizes').update(matriz.id, {
          categoriaId: categoriaId
        } as any);
      }
    });

    // Versão 12: Adicionar índice composto para busca de matrizes por identificador + fazendaId
    this.version(12).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      categorias: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId'
    });

    // Versão 13: Adicionar tabela de notificações lidas
    this.version(13).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      categorias: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId',
      notificacoesLidas: 'id, tipo, marcadaEm, synced, remoteId'
    }).upgrade(async (tx) => {
      // Migrar notificações lidas existentes para incluir synced: false
      const notificacoes = await tx.table('notificacoesLidas').toArray();
      for (const notif of notificacoes) {
        await tx.table('notificacoesLidas').update(notif.id, {
          synced: false,
          remoteId: null
        } as any);
      }
    });

    // Versão 14: Adicionar tabela de configurações de alerta
    this.version(14).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      categorias: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId',
      notificacoesLidas: 'id, tipo, marcadaEm, synced, remoteId',
      alertSettings: 'id, synced, remoteId'
    }).upgrade(async (tx) => {
      // Migrar configurações do localStorage para IndexedDB
      if (typeof window !== 'undefined') {
        try {
          const stored = window.localStorage.getItem('alertSettings');
          if (stored) {
            const parsed = JSON.parse(stored);
            const now = new Date().toISOString();
            await tx.table('alertSettings').put({
              id: 'alert-settings-global',
              limiteMesesDesmama: parsed.limiteMesesDesmama || 8,
              janelaMesesMortalidade: parsed.janelaMesesMortalidade || 6,
              limiarMortalidade: parsed.limiarMortalidade || 10,
              createdAt: now,
              updatedAt: now,
              synced: false,
              remoteId: null
            });
          }
        } catch (err) {
          console.error('Erro ao migrar configurações de alerta:', err);
        }
      }
    });

    // Versão 15: Adicionar tabela de permissões por role
    this.version(15).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      categorias: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId',
      notificacoesLidas: 'id, tipo, marcadaEm, synced, remoteId',
      alertSettings: 'id, synced, remoteId',
      rolePermissions: 'id, role, permission, synced, remoteId, [role+permission]'
    }).upgrade(async (tx) => {
      // Inicializar permissões padrão para cada role
      // Usar crypto.randomUUID() nativo do navegador (não requer import dinâmico)
      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
        }
        // Fallback para navegadores antigos
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      const now = new Date().toISOString();
      const roles: UserRole[] = ['admin', 'gerente', 'peao', 'visitante'];
      const permissions: PermissionType[] = [
        'importar_planilha',
        'gerenciar_usuarios',
        'gerenciar_fazendas',
        'gerenciar_matrizes',
        'gerenciar_racas',
        'gerenciar_categorias',
        'cadastrar_nascimento',
        'editar_nascimento',
        'excluir_nascimento',
        'cadastrar_desmama',
        'editar_desmama',
        'excluir_desmama',
        'ver_dashboard',
        'ver_notificacoes',
        'exportar_dados',
        'gerar_relatorios'
      ];

      // Permissões padrão por role
      const defaultPermissions: Record<UserRole, PermissionType[]> = {
        admin: permissions, // Admin tem todas as permissões
        gerente: [
          'ver_dashboard',
          'ver_notificacoes',
          'cadastrar_nascimento',
          'editar_nascimento',
          'cadastrar_desmama',
          'editar_desmama',
          'gerenciar_matrizes',
          'exportar_dados',
          'gerar_relatorios'
        ],
        peao: [
          'ver_dashboard',
          'ver_notificacoes',
          'cadastrar_nascimento',
          'cadastrar_desmama'
        ],
        visitante: [
          'ver_dashboard',
          'ver_notificacoes'
        ]
      };

      // Criar permissões para cada role
      // IMPORTANTE: Fazer todas as operações dentro da transação sem await de imports
      const promises: Promise<any>[] = [];
      for (const role of roles) {
        const rolePerms = defaultPermissions[role];
        for (const permission of permissions) {
          const granted = rolePerms.includes(permission);
          promises.push(
            tx.table('rolePermissions').add({
              id: generateUUID(),
              role,
              permission,
              granted,
              createdAt: now,
              updatedAt: now,
              synced: false,
              remoteId: null
            })
          );
        }
      }
      // Aguardar todas as operações de uma vez
      await Promise.all(promises);
    });

    // Versão 16: Adicionar tabela de configurações do app
    this.version(16).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      categorias: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId',
      notificacoesLidas: 'id, tipo, marcadaEm, synced, remoteId',
      alertSettings: 'id, synced, remoteId',
      rolePermissions: 'id, role, permission, synced, remoteId, [role+permission]',
      appSettings: 'id, synced, remoteId'
    }).upgrade(async (tx) => {
      // Inicializar configurações padrão do app
      const now = new Date().toISOString();
      const defaultPrimaryColor = 'green'; // Verde padrão (adequado para fazendas)
      const existing = await tx.table('appSettings').get('app-settings-global');
      if (!existing) {
        await tx.table('appSettings').add({
          id: 'app-settings-global',
          timeoutInatividade: 15, // 15 minutos padrão
          primaryColor: defaultPrimaryColor,
          createdAt: now,
          updatedAt: now,
          synced: false,
          remoteId: null
        });
      }
    });

    // Versão 17: Adicionar campo intervaloSincronizacao nas configurações do app
    this.version(17).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      categorias: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId',
      notificacoesLidas: 'id, tipo, marcadaEm, synced, remoteId',
      alertSettings: 'id, synced, remoteId',
      rolePermissions: 'id, role, permission, synced, remoteId, [role+permission]',
      appSettings: 'id, synced, remoteId'
    }).upgrade(async (tx) => {
      // Adicionar campo intervaloSincronizacao aos registros existentes
      const existing = await tx.table('appSettings').get('app-settings-global');
      if (existing) {
        const updateData: any = {};
        if (existing.intervaloSincronizacao === undefined || existing.intervaloSincronizacao === null) {
          updateData.intervaloSincronizacao = 30; // 30 segundos padrão
        }
        if (Object.keys(updateData).length > 0) {
          await tx.table('appSettings').update('app-settings-global', updateData);
        }
      }
    });

    // Versão 18: Adicionar tabela de fila de eventos de sincronização
    this.version(18).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      categorias: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId',
      notificacoesLidas: 'id, tipo, marcadaEm, synced, remoteId',
      alertSettings: 'id, synced, remoteId',
      rolePermissions: 'id, role, permission, synced, remoteId, [role+permission]',
      appSettings: 'id, synced, remoteId',
      syncEvents: 'id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo]'
    });

    // Versão 19: Adicionar campos de lock (lockedBy, lockedByNome, lockedAt) nas tabelas principais
    this.version(19).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      categorias: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId',
      notificacoesLidas: 'id, tipo, marcadaEm, synced, remoteId',
      alertSettings: 'id, synced, remoteId',
      rolePermissions: 'id, role, permission, synced, remoteId, [role+permission]',
      appSettings: 'id, synced, remoteId',
      syncEvents: 'id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo]'
    });

    // Versão 20: Adicionar tabela de pesagens periódicas
    this.version(20).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      categorias: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      pesagens: 'id, nascimentoId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem]',
      vacinacoes: 'id, nascimentoId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao]',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId',
      notificacoesLidas: 'id, tipo, marcadaEm, synced, remoteId',
      alertSettings: 'id, synced, remoteId',
      rolePermissions: 'id, role, permission, synced, remoteId, [role+permission]',
      appSettings: 'id, synced, remoteId',
      syncEvents: 'id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo]'
    });

    // Versão 21: Adicionar tabela de vacinações
    this.version(21).stores({
      fazendas: 'id, nome, synced, remoteId',
      racas: 'id, nome, synced, remoteId',
      categorias: 'id, nome, synced, remoteId',
      nascimentos: 'id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto',
      desmamas: 'id, nascimentoId, dataDesmama, synced, remoteId',
      pesagens: 'id, nascimentoId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem]',
      vacinacoes: 'id, nascimentoId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao]',
      usuarios: 'id, email, nome, role, fazendaId, ativo',
      matrizes: 'id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo',
      deletedRecords: 'id, uuid, remoteId, deletedAt, synced',
      audits: 'id, entity, entityId, action, timestamp, userId',
      notificacoesLidas: 'id, tipo, marcadaEm, synced, remoteId',
      alertSettings: 'id, synced, remoteId',
      rolePermissions: 'id, role, permission, synced, remoteId, [role+permission]',
      appSettings: 'id, synced, remoteId',
      syncEvents: 'id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo]'
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
