import Dexie from "dexie";
import {
  Desmama,
  Fazenda,
  Raca,
  Categoria,
  Usuario,
  Tag,
  Matriz,
  AuditLog,
  NotificacaoLida,
  AlertSettingsDB,
  AppSettingsDB,
  RolePermission,
  UserRole,
  PermissionType,
  SyncEvent,
  Pesagem,
  Vacina,
  Animal,
  TipoAnimal,
  StatusAnimal,
  Origem,
  Genealogia,
  Confinamento,
  ConfinamentoAnimal,
  ConfinamentoAlimentacao,
  OcorrenciaAnimal,
} from "./models";
import { uuid } from "../utils/uuid";

/** Tipo de entidade para exclusão (define qual tabela do Supabase atualizar). */
export type DeletedRecordEntity = "animal" | "pesagem" | "vacina";

interface DeletedRecord {
  id: string;
  uuid: string; // UUID do registro excluído
  remoteId?: number | string | null; // ID remoto no Supabase (para poder excluir depois)
  deletedAt: string;
  synced: boolean; // Se a exclusão foi sincronizada com o servidor
  /** Tipo da entidade: garante que a exclusão seja aplicada apenas na tabela correta. */
  entity?: DeletedRecordEntity;
}

export interface TagAssignment {
  id: string;
  entityId: string;
  entityType: "nascimento" | "matriz" | "fazenda" | "animal";
  tagId: string;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  synced: boolean;
  remoteId?: string | null;
}

class AppDB extends Dexie {
  fazendas!: Dexie.Table<Fazenda, string>;
  racas!: Dexie.Table<Raca, string>;
  categorias!: Dexie.Table<Categoria, string>;
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
  tags!: Dexie.Table<Tag, string>; // Tabela de tags customizáveis
  tagAssignments!: Dexie.Table<TagAssignment, string>; // Tabela de atribuições de tags

  // NOVO SISTEMA DE ANIMAIS
  animais!: Dexie.Table<Animal, string>; // Tabela principal de animais
  tiposAnimal!: Dexie.Table<TipoAnimal, string>; // Tipos (Bezerro, Vaca, etc.)
  statusAnimal!: Dexie.Table<StatusAnimal, string>; // Status (Ativo, Vendido, etc.)
  origens!: Dexie.Table<Origem, string>; // Origens (Nascido, Comprado, etc.)
  genealogias!: Dexie.Table<Genealogia, string>; // Árvore genealógica completa

  // MÓDULO DE CONFINAMENTO
  confinamentos!: Dexie.Table<Confinamento, string>; // Tabela de confinamentos (lotes/ciclos)
  confinamentoAnimais!: Dexie.Table<ConfinamentoAnimal, string>; // Vínculo animal-confinamento
  confinamentoAlimentacao!: Dexie.Table<ConfinamentoAlimentacao, string>; // Controle de alimentação e custos
  ocorrenciaAnimais!: Dexie.Table<OcorrenciaAnimal, string>; // Sanidade: doença, tratamento, morte, outro

  constructor() {
    super("FazendaDB");
    this.version(4).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca",
      desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
      deletedRecords: "id, uuid, remoteId, deletedAt, synced", // Nova tabela para rastrear exclusões
    });
    this.version(5)
      .stores({
        fazendas: "id, nome, synced, remoteId",
        racas: "id, nome, synced, remoteId", // Adicionar synced e remoteId para racas
        nascimentos:
          "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca",
        desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
        deletedRecords: "id, uuid, remoteId, deletedAt, synced",
      })
      .upgrade(async (tx) => {
        // Migrar raças existentes para incluir synced: false
        const racas = await tx.table("racas").toArray();
        for (const raca of racas) {
          await tx.table("racas").update(raca.id, {
            synced: false,
            remoteId: null,
          });
        }
      });

    // Versão 6: Adicionar índice createdAt para ordenação
    this.version(6).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt",
      desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
      deletedRecords: "id, uuid, remoteId, deletedAt, synced",
    });

    // Versão 7: Adicionar campo morto aos nascimentos
    this.version(7)
      .stores({
        fazendas: "id, nome, synced, remoteId",
        racas: "id, nome, synced, remoteId",
        nascimentos:
          "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
        desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
        deletedRecords: "id, uuid, remoteId, deletedAt, synced",
      })
      .upgrade(async (tx) => {
        // Atualizar todos os nascimentos existentes como vivos (morto = false)
        const nascimentos = await tx.table("nascimentos").toArray();
        for (const nascimento of nascimentos) {
          if (nascimento.morto === undefined) {
            await tx.table("nascimentos").update(nascimento.id, {
              morto: false,
            });
          }
        }
      });

    // Versão 8: Adicionar tabela de usuários locais
    this.version(8).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
      desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
      usuarios: "id, email, nome, role, fazendaId, ativo",
      deletedRecords: "id, uuid, remoteId, deletedAt, synced",
    });

    // Versão 9: Adicionar tabela de matrizes
    this.version(9).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
      desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
      usuarios: "id, email, nome, role, fazendaId, ativo",
      matrizes:
        "id, identificador, fazendaId, categoria, raca, dataNascimento, ativo",
      deletedRecords: "id, uuid, remoteId, deletedAt, synced",
    });

    // Versão 10: Tabela de auditoria
    this.version(10).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
      desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
      usuarios: "id, email, nome, role, fazendaId, ativo",
      matrizes:
        "id, identificador, fazendaId, categoria, raca, dataNascimento, ativo",
      deletedRecords: "id, uuid, remoteId, deletedAt, synced",
      audits: "id, entity, entityId, action, timestamp, userId",
    });

    // Versão 11: Adicionar tabela de categorias e atualizar matrizes para usar categoriaId
    this.version(11)
      .stores({
        fazendas: "id, nome, synced, remoteId",
        racas: "id, nome, synced, remoteId",
        categorias: "id, nome, synced, remoteId",
        nascimentos:
          "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
        desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
        usuarios: "id, email, nome, role, fazendaId, ativo",
        matrizes:
          "id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo",
        deletedRecords: "id, uuid, remoteId, deletedAt, synced",
        audits: "id, entity, entityId, action, timestamp, userId",
      })
      .upgrade(async (tx) => {
        // Migrar categorias existentes (novilha e vaca) para a nova tabela
        const categoriaNovilhaId = "categoria-novilha";
        const categoriaVacaId = "categoria-vaca";
        const now = new Date().toISOString();

        await tx.table("categorias").add({
          id: categoriaNovilhaId,
          nome: "Novilha",
          createdAt: now,
          updatedAt: now,
          synced: false,
          remoteId: null,
        });

        await tx.table("categorias").add({
          id: categoriaVacaId,
          nome: "Vaca",
          createdAt: now,
          updatedAt: now,
          synced: false,
          remoteId: null,
        });

        // Migrar matrizes existentes: converter categoria (string) para categoriaId
        const matrizes = await tx.table("matrizes").toArray();
        for (const matriz of matrizes) {
          const categoriaId =
            (matriz as { categoria?: string }).categoria === "novilha"
              ? categoriaNovilhaId
              : categoriaVacaId;
          await tx.table("matrizes").update(matriz.id, {
            categoriaId: categoriaId,
          } as Record<string, unknown>);
        }
      });

    // Versão 12: Adicionar índice composto para busca de matrizes por identificador + fazendaId
    this.version(12).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      categorias: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
      desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
      usuarios: "id, email, nome, role, fazendaId, ativo",
      matrizes:
        "id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo",
      deletedRecords: "id, uuid, remoteId, deletedAt, synced",
      audits: "id, entity, entityId, action, timestamp, userId",
    });

    // Versão 13: Adicionar tabela de notificações lidas
    this.version(13)
      .stores({
        fazendas: "id, nome, synced, remoteId",
        racas: "id, nome, synced, remoteId",
        categorias: "id, nome, synced, remoteId",
        nascimentos:
          "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
        desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
        usuarios: "id, email, nome, role, fazendaId, ativo",
        matrizes:
          "id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo",
        deletedRecords: "id, uuid, remoteId, deletedAt, synced",
        audits: "id, entity, entityId, action, timestamp, userId",
        notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
      })
      .upgrade(async (tx) => {
        // Migrar notificações lidas existentes para incluir synced: false
        const notificacoes = await tx.table("notificacoesLidas").toArray();
        for (const notif of notificacoes) {
          await tx.table("notificacoesLidas").update(notif.id, {
            synced: false,
            remoteId: null,
          } as Record<string, unknown>);
        }
      });

    // Versão 14: Adicionar tabela de configurações de alerta
    this.version(14)
      .stores({
        fazendas: "id, nome, synced, remoteId",
        racas: "id, nome, synced, remoteId",
        categorias: "id, nome, synced, remoteId",
        nascimentos:
          "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
        desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
        usuarios: "id, email, nome, role, fazendaId, ativo",
        matrizes:
          "id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo",
        deletedRecords: "id, uuid, remoteId, deletedAt, synced",
        audits: "id, entity, entityId, action, timestamp, userId",
        notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
        alertSettings: "id, synced, remoteId",
      })
      .upgrade(async (tx) => {
        // Migrar configurações do localStorage para IndexedDB
        if (typeof window !== "undefined") {
          try {
            const stored = window.localStorage.getItem("alertSettings");
            if (stored) {
              const parsed = JSON.parse(stored);
              const now = new Date().toISOString();
              await tx.table("alertSettings").put({
                id: "alert-settings-global",
                limiteMesesDesmama: parsed.limiteMesesDesmama || 8,
                janelaMesesMortalidade: parsed.janelaMesesMortalidade || 6,
                limiarMortalidade: parsed.limiarMortalidade || 10,
                createdAt: now,
                updatedAt: now,
                synced: false,
                remoteId: null,
              });
            }
          } catch (err) {
            console.error("Erro ao migrar configurações de alerta:", err);
          }
        }
      });

    // Versão 15: Adicionar tabela de permissões por role
    this.version(15)
      .stores({
        fazendas: "id, nome, synced, remoteId",
        racas: "id, nome, synced, remoteId",
        categorias: "id, nome, synced, remoteId",
        nascimentos:
          "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
        desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
        usuarios: "id, email, nome, role, fazendaId, ativo",
        matrizes:
          "id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo",
        deletedRecords: "id, uuid, remoteId, deletedAt, synced",
        audits: "id, entity, entityId, action, timestamp, userId",
        notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
        alertSettings: "id, synced, remoteId",
        rolePermissions:
          "id, role, permission, synced, remoteId, [role+permission]",
      })
      .upgrade(async (tx) => {
        // Inicializar permissões padrão para cada role
        // Usar crypto.randomUUID() nativo do navegador (não requer import dinâmico)
        const generateUUID = () => {
          if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return crypto.randomUUID();
          }
          // Fallback para navegadores antigos
          return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
            /[xy]/g,
            (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === "x" ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            },
          );
        };

        const now = new Date().toISOString();
        const roles: UserRole[] = ["admin", "gerente", "peao", "visitante"];
        const permissions: PermissionType[] = [
          "gerenciar_usuarios",
          "gerenciar_fazendas",
          "gerenciar_racas",
          "gerenciar_tipos_animais",
          "gerenciar_status_animais",
          "gerenciar_categorias",
          "cadastrar_animal",
          "editar_animal",
          "excluir_animal",
          "cadastrar_desmama",
          "editar_desmama",
          "excluir_desmama",
          "cadastrar_pesagem",
          "editar_pesagem",
          "excluir_pesagem",
          "cadastrar_vacina",
          "editar_vacina",
          "excluir_vacina",
          "ver_dashboard",
          "ver_notificacoes",
          "ver_sincronizacao",
          "ver_planilha",
          "ver_confinamentos",
          "gerenciar_confinamentos",
          "ver_fazendas",
          "ver_usuarios",
          "exportar_dados",
          "gerar_relatorios",
        ];

        // Permissões padrão por role (alinhado às funcionalidades atuais)
        const defaultPermissions: Record<UserRole, PermissionType[]> = {
          admin: permissions, // Admin tem todas as permissões
          gerente: [
            "ver_dashboard",
            "ver_notificacoes",
            "ver_sincronizacao",
            "ver_planilha",
            "ver_confinamentos",
            "gerenciar_confinamentos",
            "ver_fazendas",
            "cadastrar_animal",
            "editar_animal",
            "cadastrar_desmama",
            "editar_desmama",
            "cadastrar_pesagem",
            "editar_pesagem",
            "cadastrar_vacina",
            "editar_vacina",
            "exportar_dados",
            "gerar_relatorios",
          ],
          peao: [
            "ver_dashboard",
            "ver_notificacoes",
            "ver_planilha",
            "ver_confinamentos",
            "cadastrar_animal",
            "cadastrar_desmama",
            "cadastrar_pesagem",
            "cadastrar_vacina",
          ],
          visitante: [
            "ver_dashboard",
            "ver_notificacoes",
            "ver_planilha",
            "ver_confinamentos",
            "ver_fazendas",
          ],
        };

        // Criar permissões para cada role
        // IMPORTANTE: Fazer todas as operações dentro da transação sem await de imports
        const promises: Promise<void>[] = [];
        for (const role of roles) {
          const rolePerms = defaultPermissions[role];
          for (const permission of permissions) {
            const granted = rolePerms.includes(permission);
            promises.push(
              tx.table("rolePermissions").add({
                id: generateUUID(),
                role,
                permission,
                granted,
                createdAt: now,
                updatedAt: now,
                synced: false,
                remoteId: null,
              }),
            );
          }
        }
        // Aguardar todas as operações de uma vez
        await Promise.all(promises);
      });

    // Versão 16: Adicionar tabela de configurações do app
    this.version(16)
      .stores({
        fazendas: "id, nome, synced, remoteId",
        racas: "id, nome, synced, remoteId",
        categorias: "id, nome, synced, remoteId",
        nascimentos:
          "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
        desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
        usuarios: "id, email, nome, role, fazendaId, ativo",
        matrizes:
          "id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo",
        deletedRecords: "id, uuid, remoteId, deletedAt, synced",
        audits: "id, entity, entityId, action, timestamp, userId",
        notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
        alertSettings: "id, synced, remoteId",
        rolePermissions:
          "id, role, permission, synced, remoteId, [role+permission]",
        appSettings: "id, synced, remoteId",
      })
      .upgrade(async (tx) => {
        // Inicializar configurações padrão do app
        const now = new Date().toISOString();
        const defaultPrimaryColor = "green"; // Verde padrão (adequado para fazendas)
        const existing = await tx
          .table("appSettings")
          .get("app-settings-global");
        if (!existing) {
          await tx.table("appSettings").add({
            id: "app-settings-global",
            timeoutInatividade: 15, // 15 minutos padrão
            primaryColor: defaultPrimaryColor,
            createdAt: now,
            updatedAt: now,
            synced: false,
            remoteId: null,
          });
        }
      });

    // Versão 17: Adicionar campo intervaloSincronizacao nas configurações do app
    this.version(17)
      .stores({
        fazendas: "id, nome, synced, remoteId",
        racas: "id, nome, synced, remoteId",
        categorias: "id, nome, synced, remoteId",
        nascimentos:
          "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
        desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
        usuarios: "id, email, nome, role, fazendaId, ativo",
        matrizes:
          "id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo",
        deletedRecords: "id, uuid, remoteId, deletedAt, synced",
        audits: "id, entity, entityId, action, timestamp, userId",
        notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
        alertSettings: "id, synced, remoteId",
        rolePermissions:
          "id, role, permission, synced, remoteId, [role+permission]",
        appSettings: "id, synced, remoteId",
      })
      .upgrade(async (tx) => {
        // Adicionar campo intervaloSincronizacao aos registros existentes
        const existing = await tx
          .table("appSettings")
          .get("app-settings-global");
        if (existing) {
          const updateData: Record<string, unknown> = {};
          if (
            existing.intervaloSincronizacao === undefined ||
            existing.intervaloSincronizacao === null
          ) {
            updateData.intervaloSincronizacao = 30; // 30 segundos padrão
          }
          if (Object.keys(updateData).length > 0) {
            await tx
              .table("appSettings")
              .update("app-settings-global", updateData);
          }
        }
      });

    // Versão 18: Adicionar tabela de fila de eventos de sincronização
    this.version(18).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      categorias: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
      desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
      usuarios: "id, email, nome, role, fazendaId, ativo",
      matrizes:
        "id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo",
      deletedRecords: "id, uuid, remoteId, deletedAt, synced",
      audits: "id, entity, entityId, action, timestamp, userId",
      notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
      alertSettings: "id, synced, remoteId",
      rolePermissions:
        "id, role, permission, synced, remoteId, [role+permission]",
      appSettings: "id, synced, remoteId",
      syncEvents:
        "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo]",
    });

    // Versão 19: Adicionar campos de lock (lockedBy, lockedByNome, lockedAt) nas tabelas principais
    this.version(19).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      categorias: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
      desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
      usuarios: "id, email, nome, role, fazendaId, ativo",
      matrizes:
        "id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo",
      deletedRecords: "id, uuid, remoteId, deletedAt, synced",
      audits: "id, entity, entityId, action, timestamp, userId",
      notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
      alertSettings: "id, synced, remoteId",
      rolePermissions:
        "id, role, permission, synced, remoteId, [role+permission]",
      appSettings: "id, synced, remoteId",
      syncEvents:
        "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo]",
    });

    // Versão 20: Adicionar tabela de pesagens periódicas
    this.version(20).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      categorias: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
      desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
      pesagens:
        "id, nascimentoId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem]",
      vacinacoes:
        "id, nascimentoId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao]",
      usuarios: "id, email, nome, role, fazendaId, ativo",
      matrizes:
        "id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo",
      deletedRecords: "id, uuid, remoteId, deletedAt, synced",
      audits: "id, entity, entityId, action, timestamp, userId",
      notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
      alertSettings: "id, synced, remoteId",
      rolePermissions:
        "id, role, permission, synced, remoteId, [role+permission]",
      appSettings: "id, synced, remoteId",
      syncEvents:
        "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo]",
    });

    // Versão 21: Adicionar tabela de vacinações
    this.version(21).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      categorias: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
      desmamas: "id, nascimentoId, dataDesmama, synced, remoteId",
      pesagens:
        "id, nascimentoId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem]",
      vacinacoes:
        "id, nascimentoId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao]",
      usuarios: "id, email, nome, role, fazendaId, ativo",
      matrizes:
        "id, identificador, fazendaId, [identificador+fazendaId], categoriaId, raca, dataNascimento, ativo",
      deletedRecords: "id, uuid, remoteId, deletedAt, synced",
      audits: "id, entity, entityId, action, timestamp, userId",
      notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
      alertSettings: "id, synced, remoteId",
      rolePermissions:
        "id, role, permission, synced, remoteId, [role+permission]",
      appSettings: "id, synced, remoteId",
      syncEvents:
        "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo]",
    });

    // Versão 22: Otimizar índices compostos para melhor performance
    this.version(22).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      categorias: "id, nome, synced, remoteId",
      // Adicionar índices compostos para queries frequentes
      nascimentos:
        "id, matrizId, fazendaId, [fazendaId+dataNascimento], [fazendaId+mes+ano], [fazendaId+synced], mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
      desmamas:
        "id, nascimentoId, dataDesmama, synced, remoteId, [nascimentoId+synced]",
      pesagens:
        "id, nascimentoId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem], [nascimentoId+synced]",
      vacinacoes:
        "id, nascimentoId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao], [nascimentoId+synced]",
      usuarios: "id, email, nome, role, fazendaId, ativo, [fazendaId+ativo]",
      matrizes:
        "id, identificador, fazendaId, [identificador+fazendaId], [fazendaId+ativo], categoriaId, raca, dataNascimento, ativo",
      deletedRecords:
        "id, uuid, remoteId, deletedAt, synced, [synced+deletedAt]",
      audits:
        "id, entity, entityId, action, timestamp, userId, [entity+entityId], [userId+timestamp]",
      notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
      alertSettings: "id, synced, remoteId",
      rolePermissions:
        "id, role, permission, synced, remoteId, [role+permission]",
      appSettings: "id, synced, remoteId",
      syncEvents:
        "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo], [synced+createdAt]",
    });

    // Versão 23: Adicionar índice synced para matrizes e usuarios
    this.version(23).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      categorias: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, [fazendaId+dataNascimento], [fazendaId+mes+ano], [fazendaId+synced], mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
      desmamas:
        "id, nascimentoId, dataDesmama, synced, remoteId, [nascimentoId+synced]",
      pesagens:
        "id, nascimentoId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem], [nascimentoId+synced]",
      vacinacoes:
        "id, nascimentoId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao], [nascimentoId+synced]",
      usuarios:
        "id, email, nome, role, fazendaId, ativo, synced, [fazendaId+ativo]",
      matrizes:
        "id, identificador, fazendaId, [identificador+fazendaId], [fazendaId+ativo], categoriaId, raca, dataNascimento, ativo, synced",
      deletedRecords:
        "id, uuid, remoteId, deletedAt, synced, [synced+deletedAt]",
      audits:
        "id, entity, entityId, action, timestamp, userId, [entity+entityId], [userId+timestamp]",
      notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
      alertSettings: "id, synced, remoteId",
      rolePermissions:
        "id, role, permission, synced, remoteId, [role+permission]",
      appSettings: "id, synced, remoteId",
      syncEvents:
        "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo], [synced+createdAt]",
    });

    // Versão 24: Adicionar tabelas de tags
    this.version(24).stores({
      fazendas: "id, nome, synced, remoteId",
      racas: "id, nome, synced, remoteId",
      categorias: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, [fazendaId+dataNascimento], [fazendaId+mes+ano], [fazendaId+synced], mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
      desmamas:
        "id, nascimentoId, dataDesmama, synced, remoteId, [nascimentoId+synced]",
      pesagens:
        "id, nascimentoId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem], [nascimentoId+synced]",
      vacinacoes:
        "id, nascimentoId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao], [nascimentoId+synced]",
      usuarios:
        "id, email, nome, role, fazendaId, ativo, synced, [fazendaId+ativo]",
      matrizes:
        "id, identificador, fazendaId, [identificador+fazendaId], [fazendaId+ativo], categoriaId, raca, dataNascimento, ativo, synced",
      deletedRecords:
        "id, uuid, remoteId, deletedAt, synced, [synced+deletedAt]",
      audits:
        "id, entity, entityId, action, timestamp, userId, [entity+entityId], [userId+timestamp]",
      notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
      alertSettings: "id, synced, remoteId",
      rolePermissions:
        "id, role, permission, synced, remoteId, [role+permission]",
      appSettings: "id, synced, remoteId",
      syncEvents:
        "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo], [synced+createdAt]",
      tags: "id, name, category, createdBy, synced, remoteId, [createdBy+synced], usageCount",
      tagAssignments:
        "id, entityId, entityType, tagId, [entityId+entityType], [entityType+tagId], [tagId+entityId], assignedBy, synced, remoteId, [synced+entityType]",
    });

    // Versão 25: NOVO SISTEMA DE ANIMAIS
    // IMPORTANTE: Apenas adicionar as NOVAS tabelas, sem redefinir as existentes!
    // Isso preserva os dados de usuários e outras tabelas
    this.version(25)
      .stores({
        // NOVAS TABELAS DO SISTEMA DE ANIMAIS
        animais:
          "id, brinco, tipoId, racaId, sexo, statusId, fazendaId, [fazendaId+brinco], [fazendaId+statusId], [fazendaId+synced], [tipoId+statusId], dataNascimento, dataCadastro, synced, remoteId, deletedAt, createdAt",
        tiposAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
        statusAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
        origens: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
        genealogias:
          "id, animalId, matrizId, reprodutorId, synced, remoteId, deletedAt, [animalId+synced]",
      })
      .upgrade(async (tx) => {
        // Inserir tipos padrão de animal (sem redundância)
        const tiposPadrao: Omit<TipoAnimal, "id">[] = [
          {
            nome: "Bezerro(a)",
            descricao: "Até 12 meses",
            ordem: 1,
            ativo: true,
            synced: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            nome: "Novilho(a)",
            descricao: "De 12 a 24 meses",
            ordem: 2,
            ativo: true,
            synced: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            nome: "Vaca",
            descricao: "Fêmea adulta",
            ordem: 3,
            ativo: true,
            synced: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            nome: "Touro",
            descricao: "Macho reprodutor",
            ordem: 4,
            ativo: true,
            synced: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            nome: "Boi",
            descricao: "Macho castrado para engorda",
            ordem: 5,
            ativo: true,
            synced: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            nome: "Garrote",
            descricao: "Macho jovem para engorda",
            ordem: 6,
            ativo: true,
            synced: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        // Verificar se já existem dados (evitar duplicação)
        const tiposExistentes = await tx.table("tiposAnimal").count();

        if (tiposExistentes === 0) {
          // Só inserir se não houver dados
          for (const tipo of tiposPadrao) {
            await tx.table("tiposAnimal").add({ ...tipo, id: uuid() });
          }

          // Inserir status padrão
          const statusPadrao: Omit<StatusAnimal, "id">[] = [
            {
              nome: "Ativo",
              cor: "#10b981",
              descricao: "Animal ativo no rebanho",
              ordem: 1,
              ativo: true,
              synced: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              nome: "Vendido",
              cor: "#3b82f6",
              descricao: "Animal vendido",
              ordem: 2,
              ativo: true,
              synced: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              nome: "Morto",
              cor: "#ef4444",
              descricao: "Animal morto",
              ordem: 3,
              ativo: true,
              synced: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              nome: "Transferido",
              cor: "#f59e0b",
              descricao: "Transferido para outra fazenda",
              ordem: 4,
              ativo: true,
              synced: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              nome: "Doente",
              cor: "#ec4899",
              descricao: "Animal em tratamento",
              ordem: 5,
              ativo: true,
              synced: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ];

          for (const status of statusPadrao) {
            await tx.table("statusAnimal").add({ ...status, id: uuid() });
          }

          // Inserir origens padrão
          const origensPadrao: Omit<Origem, "id">[] = [
            {
              nome: "Nascido na Fazenda",
              descricao: "Animal nascido na propriedade",
              ordem: 1,
              ativo: true,
              synced: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              nome: "Comprado",
              descricao: "Animal adquirido de terceiros",
              ordem: 2,
              ativo: true,
              synced: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              nome: "Transferido",
              descricao: "Transferido de outra fazenda do grupo",
              ordem: 3,
              ativo: true,
              synced: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              nome: "Doado",
              descricao: "Animal recebido como doação",
              ordem: 4,
              ativo: true,
              synced: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ];

          for (const origem of origensPadrao) {
            await tx.table("origens").add({ ...origem, id: uuid() });
          }

          console.log(
            "✅ Dados padrão do sistema de animais inseridos com sucesso!",
          );
        } else {
          console.log("ℹ️ Dados padrão já existem, pulando inserção.");
        }
      });

    // Versão 26: Adicionar animalId à tabela desmamas
    this.version(26)
      .stores({
        fazendas: "id, nome, synced, remoteId",
        racas: "id, nome, synced, remoteId",
        categorias: "id, nome, synced, remoteId",
        nascimentos:
          "id, matrizId, fazendaId, [fazendaId+dataNascimento], [fazendaId+mes+ano], [fazendaId+synced], mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
        desmamas:
          "id, nascimentoId, animalId, dataDesmama, synced, remoteId, [nascimentoId+synced], [animalId+synced]",
        pesagens:
          "id, nascimentoId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem], [nascimentoId+synced]",
        vacinacoes:
          "id, nascimentoId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao], [nascimentoId+synced]",
        usuarios:
          "id, email, nome, role, fazendaId, ativo, synced, [fazendaId+ativo]",
        matrizes:
          "id, identificador, fazendaId, [identificador+fazendaId], [fazendaId+ativo], categoriaId, raca, dataNascimento, ativo, synced",
        deletedRecords:
          "id, uuid, remoteId, deletedAt, synced, [synced+deletedAt]",
        audits:
          "id, entity, entityId, action, timestamp, userId, [entity+entityId], [userId+timestamp]",
        notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
        alertSettings: "id, synced, remoteId",
        rolePermissions:
          "id, role, permission, synced, remoteId, [role+permission]",
        appSettings: "id, synced, remoteId",
        syncEvents:
          "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo], [synced+createdAt]",
        tags: "id, name, category, createdBy, synced, remoteId, [createdBy+synced], usageCount",
        tagAssignments:
          "id, entityId, entityType, tagId, [entityId+entityType], [entityType+tagId], [tagId+entityId], assignedBy, synced, remoteId, [synced+entityType]",
        animais:
          "id, brinco, tipoId, racaId, sexo, statusId, fazendaId, [fazendaId+brinco], [fazendaId+statusId], [fazendaId+synced], [tipoId+statusId], dataNascimento, dataCadastro, synced, remoteId, deletedAt, createdAt",
        tiposAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
        statusAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
        origens: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
        genealogias:
          "id, animalId, matrizId, reprodutorId, synced, remoteId, deletedAt, [animalId+synced]",
      })
      .upgrade(async (tx) => {
        // Migração: Vincular desmamas existentes aos animais através do nascimento
        console.log("🔄 Migrando desmamas para vincular com animais...");

        const desmamas = await tx.table("desmamas").toArray();
        const animais = await tx.table("animais").toArray();
        const nascimentos = await tx.table("nascimentos").toArray();

        // Criar mapa: nascimentoId -> animalId
        // Buscar animal pelo brinco + fazenda do nascimento
        const nascimentoToAnimalMap = new Map<string, string>();

        for (const nascimento of nascimentos) {
          if (!nascimento.brincoNumero || !nascimento.brincoNumero.trim())
            continue;

          // Buscar animal com mesmo brinco e fazenda
          const animal = animais.find(
            (a) =>
              !a.deletedAt &&
              a.brinco === nascimento.brincoNumero.trim() &&
              a.fazendaId === nascimento.fazendaId &&
              a.dataNascimento === nascimento.dataNascimento,
          );

          if (animal) {
            nascimentoToAnimalMap.set(nascimento.id, animal.id);
          }
        }

        // Atualizar desmamas com animalId
        let atualizadas = 0;
        for (const desmama of desmamas) {
          const animalId = nascimentoToAnimalMap.get(desmama.nascimentoId);
          if (animalId) {
            await tx.table("desmamas").update(desmama.id, { animalId });
            atualizadas++;
          }
        }

        console.log(
          `✅ ${atualizadas}/${desmamas.length} desmamas vinculadas a animais`,
        );
      });

    // Versão 27: Adicionar animalId às tabelas pesagens e vacinacoes
    this.version(27)
      .stores({
        fazendas: "id, nome, synced, remoteId",
        racas: "id, nome, synced, remoteId",
        categorias: "id, nome, synced, remoteId",
        nascimentos:
          "id, matrizId, fazendaId, [fazendaId+dataNascimento], [fazendaId+mes+ano], [fazendaId+synced], mes, ano, dataNascimento, synced, remoteId, sexo, raca, createdAt, morto",
        desmamas:
          "id, nascimentoId, animalId, dataDesmama, synced, remoteId, [nascimentoId+synced], [animalId+synced]",
        pesagens:
          "id, nascimentoId, animalId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem], [nascimentoId+synced], [animalId+dataPesagem], [animalId+synced]",
        vacinacoes:
          "id, nascimentoId, animalId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao], [nascimentoId+synced], [animalId+dataAplicacao], [animalId+synced]",
        usuarios:
          "id, email, nome, role, fazendaId, ativo, synced, [fazendaId+ativo]",
        matrizes:
          "id, identificador, fazendaId, [identificador+fazendaId], [fazendaId+ativo], categoriaId, raca, dataNascimento, ativo, synced",
        deletedRecords:
          "id, uuid, remoteId, deletedAt, synced, [synced+deletedAt]",
        audits:
          "id, entity, entityId, action, timestamp, userId, [entity+entityId], [userId+timestamp]",
        notificacoesLidas: "id, tipo, marcadaEm, synced, remoteId",
        alertSettings: "id, synced, remoteId",
        rolePermissions:
          "id, role, permission, synced, remoteId, [role+permission]",
        appSettings: "id, synced, remoteId",
        syncEvents:
          "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo], [synced+createdAt]",
        tags: "id, name, category, createdBy, synced, remoteId, [createdBy+synced], usageCount",
        tagAssignments:
          "id, entityId, entityType, tagId, [entityId+entityType], [entityType+tagId], [tagId+entityId], assignedBy, synced, remoteId, [synced+entityType]",
        animais:
          "id, brinco, tipoId, racaId, sexo, statusId, fazendaId, [fazendaId+brinco], [fazendaId+statusId], [fazendaId+synced], [tipoId+statusId], dataNascimento, dataCadastro, synced, remoteId, deletedAt, createdAt",
        tiposAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
        statusAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
        origens: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
        genealogias:
          "id, animalId, matrizId, reprodutorId, synced, remoteId, deletedAt, [animalId+synced]",
      })
      .upgrade(async (tx) => {
        // Migração: Vincular pesagens e vacinas existentes aos animais através do nascimento
        // Log removido - migração só executa uma vez na atualização do banco
        // console.log('🔄 Migrando pesagens e vacinas para vincular com animais...');

        const pesagens = await tx.table("pesagens").toArray();
        const vacinacoes = await tx.table("vacinacoes").toArray();
        const animais = await tx.table("animais").toArray();
        const nascimentos = await tx.table("nascimentos").toArray();

        // Criar mapa: nascimentoId -> animalId
        const nascimentoToAnimalMap = new Map<string, string>();

        for (const nascimento of nascimentos) {
          if (!nascimento.brincoNumero || !nascimento.brincoNumero.trim())
            continue;

          const animal = animais.find(
            (a) =>
              !a.deletedAt &&
              a.brinco === nascimento.brincoNumero.trim() &&
              a.fazendaId === nascimento.fazendaId &&
              a.dataNascimento === nascimento.dataNascimento,
          );

          if (animal) {
            nascimentoToAnimalMap.set(nascimento.id, animal.id);
          }
        }

        // Atualizar pesagens com animalId
        let _pesagensAtualizadas = 0;
        for (const pesagem of pesagens) {
          if (pesagem.nascimentoId) {
            const animalId = nascimentoToAnimalMap.get(pesagem.nascimentoId);
            if (animalId) {
              await tx.table("pesagens").update(pesagem.id, { animalId });
              _pesagensAtualizadas++;
            }
          }
        }

        // Atualizar vacinas com animalId
        let _vacinasAtualizadas = 0;
        for (const vacina of vacinacoes) {
          if (vacina.nascimentoId) {
            const animalId = nascimentoToAnimalMap.get(vacina.nascimentoId);
            if (animalId) {
              await tx.table("vacinacoes").update(vacina.id, { animalId });
              _vacinasAtualizadas++;
            }
          }
        }

        // Logs removidos - migração só executa uma vez
        // console.log(`✅ ${pesagensAtualizadas}/${pesagens.length} pesagens vinculadas a animais`);
        // console.log(`✅ ${vacinasAtualizadas}/${vacinacoes.length} vacinas vinculadas a animais`);
      });

    // Versão 26: Adicionar índice usuarioId na tabela notificacoesLidas
    this.version(26).stores({
      fazendas: "id, nome, synced, remoteId, [synced+nome]",
      racas: "id, nome, synced, remoteId",
      categorias: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, sexo, raca, brincoNumero, synced, remoteId, [fazendaId+mes+ano], [matrizId+synced], [fazendaId+dataNascimento], [fazendaId+synced]",
      desmamas:
        "id, nascimentoId, animalId, dataDesmama, synced, remoteId, [nascimentoId+synced], [animalId+synced]",
      pesagens:
        "id, nascimentoId, animalId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem], [nascimentoId+synced], [animalId+dataPesagem], [animalId+synced]",
      vacinacoes:
        "id, nascimentoId, animalId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao], [nascimentoId+synced], [animalId+dataAplicacao], [animalId+synced]",
      usuarios:
        "id, email, nome, role, fazendaId, ativo, synced, [fazendaId+ativo]",
      matrizes:
        "id, identificador, fazendaId, [identificador+fazendaId], [fazendaId+ativo], categoriaId, raca, dataNascimento, ativo, synced",
      deletedRecords:
        "id, uuid, remoteId, deletedAt, synced, [synced+deletedAt]",
      audits:
        "id, entity, entityId, action, timestamp, userId, [entity+entityId], [userId+timestamp]",
      notificacoesLidas:
        "id, tipo, usuarioId, marcadaEm, synced, remoteId, [usuarioId+tipo]",
      alertSettings: "id, synced, remoteId",
      rolePermissions:
        "id, role, permission, synced, remoteId, [role+permission]",
      appSettings: "id, synced, remoteId",
      syncEvents:
        "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo], [synced+createdAt]",
      tags: "id, name, category, createdBy, synced, remoteId, [createdBy+synced], usageCount",
      tagAssignments:
        "id, entityId, entityType, tagId, [entityId+entityType], [entityType+tagId], [tagId+entityId], assignedBy, synced, remoteId, [synced+entityType]",
      animais:
        "id, brinco, tipoId, racaId, sexo, statusId, fazendaId, [fazendaId+brinco], [fazendaId+statusId], [fazendaId+synced], [tipoId+statusId], dataNascimento, dataCadastro, synced, remoteId, deletedAt, createdAt",
      tiposAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
      statusAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
      origens: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
      genealogias:
        "id, animalId, matrizId, reprodutorId, synced, remoteId, deletedAt, [animalId+synced]",
    });

    // Versão 27: Adicionar módulo de confinamento
    this.version(27).stores({
      fazendas: "id, nome, synced, remoteId, [synced+nome]",
      racas: "id, nome, synced, remoteId",
      categorias: "id, nome, synced, remoteId",
      nascimentos:
        "id, matrizId, fazendaId, mes, ano, dataNascimento, sexo, raca, brincoNumero, synced, remoteId, [fazendaId+mes+ano], [matrizId+synced], [fazendaId+dataNascimento], [fazendaId+synced]",
      desmamas:
        "id, nascimentoId, animalId, dataDesmama, synced, remoteId, [nascimentoId+synced], [animalId+synced]",
      pesagens:
        "id, nascimentoId, animalId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem], [nascimentoId+synced], [animalId+dataPesagem], [animalId+synced]",
      vacinacoes:
        "id, nascimentoId, animalId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao], [nascimentoId+synced], [animalId+dataAplicacao], [animalId+synced]",
      usuarios:
        "id, email, nome, role, fazendaId, ativo, synced, [fazendaId+ativo]",
      matrizes:
        "id, identificador, fazendaId, [identificador+fazendaId], [fazendaId+ativo], categoriaId, raca, dataNascimento, ativo, synced",
      deletedRecords:
        "id, uuid, remoteId, deletedAt, synced, [synced+deletedAt]",
      audits:
        "id, entity, entityId, action, timestamp, userId, [entity+entityId], [userId+timestamp]",
      notificacoesLidas:
        "id, tipo, usuarioId, marcadaEm, synced, remoteId, [usuarioId+tipo]",
      alertSettings: "id, synced, remoteId",
      rolePermissions:
        "id, role, permission, synced, remoteId, [role+permission]",
      appSettings: "id, synced, remoteId",
      syncEvents:
        "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo], [synced+createdAt]",
      tags: "id, name, category, createdBy, synced, remoteId, [createdBy+synced], usageCount",
      tagAssignments:
        "id, entityId, entityType, tagId, [entityId+entityType], [entityType+tagId], [tagId+entityId], assignedBy, synced, remoteId, [synced+entityType]",
      animais:
        "id, brinco, tipoId, racaId, sexo, statusId, fazendaId, [fazendaId+brinco], [fazendaId+statusId], [fazendaId+synced], [tipoId+statusId], dataNascimento, dataCadastro, synced, remoteId, deletedAt, createdAt",
      tiposAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
      statusAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
      origens: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
      genealogias:
        "id, animalId, matrizId, reprodutorId, synced, remoteId, deletedAt, [animalId+synced]",
      // MÓDULO DE CONFINAMENTO
      confinamentos:
        "id, fazendaId, nome, status, dataInicio, dataFimPrevista, dataFimReal, synced, remoteId, deletedAt, updatedAt, [fazendaId+status], [fazendaId+synced], [status+dataInicio]",
      confinamentoAnimais:
        "id, confinamentoId, animalId, dataEntrada, dataSaida, synced, remoteId, deletedAt, updatedAt, [confinamentoId+animalId], [animalId+dataSaida], [animalId+synced], [confinamentoId+synced]",
      // confinamentoPesagens removed
      confinamentoAlimentacao:
        "id, confinamentoId, data, synced, remoteId, deletedAt, updatedAt, [confinamentoId+data], [confinamentoId+synced]",
    });

    // Versão 28: Remover tabela nascimentos (uso apenas animais)
    this.version(28).stores({
      fazendas: "id, nome, synced, remoteId, [synced+nome]",
      racas: "id, nome, synced, remoteId",
      categorias: "id, nome, synced, remoteId",
      nascimentos: null,
      desmamas:
        "id, nascimentoId, animalId, dataDesmama, synced, remoteId, [nascimentoId+synced], [animalId+synced]",
      pesagens:
        "id, nascimentoId, animalId, dataPesagem, synced, remoteId, [nascimentoId+dataPesagem], [nascimentoId+synced], [animalId+dataPesagem], [animalId+synced]",
      vacinacoes:
        "id, nascimentoId, animalId, dataAplicacao, dataVencimento, synced, remoteId, [nascimentoId+dataAplicacao], [nascimentoId+synced], [animalId+dataAplicacao], [animalId+synced]",
      usuarios:
        "id, email, nome, role, fazendaId, ativo, synced, [fazendaId+ativo]",
      matrizes:
        "id, identificador, fazendaId, [identificador+fazendaId], [fazendaId+ativo], categoriaId, raca, dataNascimento, ativo, synced",
      deletedRecords:
        "id, uuid, remoteId, deletedAt, synced, [synced+deletedAt]",
      audits:
        "id, entity, entityId, action, timestamp, userId, [entity+entityId], [userId+timestamp]",
      notificacoesLidas:
        "id, tipo, usuarioId, marcadaEm, synced, remoteId, [usuarioId+tipo]",
      alertSettings: "id, synced, remoteId",
      rolePermissions:
        "id, role, permission, synced, remoteId, [role+permission]",
      appSettings: "id, synced, remoteId",
      syncEvents:
        "id, tipo, entidade, entityId, synced, createdAt, [entidade+entityId+tipo], [synced+createdAt]",
      tags: "id, name, category, createdBy, synced, remoteId, [createdBy+synced], usageCount",
      tagAssignments:
        "id, entityId, entityType, tagId, [entityId+entityType], [entityType+tagId], [tagId+entityId], assignedBy, synced, remoteId, [synced+entityType]",
      animais:
        "id, brinco, tipoId, racaId, sexo, statusId, fazendaId, [fazendaId+brinco], [fazendaId+statusId], [fazendaId+synced], [tipoId+statusId], dataNascimento, dataCadastro, synced, remoteId, deletedAt, createdAt",
      tiposAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
      statusAnimal: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
      origens: "id, nome, ativo, synced, remoteId, deletedAt, ordem",
      genealogias:
        "id, animalId, matrizId, reprodutorId, synced, remoteId, deletedAt, [animalId+synced]",
      confinamentos:
        "id, fazendaId, nome, status, dataInicio, dataFimPrevista, dataFimReal, synced, remoteId, deletedAt, updatedAt, [fazendaId+status], [fazendaId+synced], [status+dataInicio]",
      confinamentoAnimais:
        "id, confinamentoId, animalId, dataEntrada, dataSaida, synced, remoteId, deletedAt, updatedAt, [confinamentoId+animalId], [animalId+dataSaida], [animalId+synced], [confinamentoId+synced]",
      // confinamentoPesagens removed
      confinamentoAlimentacao:
        "id, confinamentoId, data, synced, remoteId, deletedAt, updatedAt, [confinamentoId+data], [confinamentoId+synced]",
    });

    // Versão 29: Usar apenas animalId em desmamas, pesagens e vacinacoes (remover índices nascimentoId)
    this.version(29)
      .stores({
        desmamas:
          "id, animalId, dataDesmama, synced, remoteId, [animalId+synced]",
        pesagens:
          "id, animalId, dataPesagem, synced, remoteId, [animalId+dataPesagem], [animalId+synced]",
        vacinacoes:
          "id, animalId, dataAplicacao, dataVencimento, synced, remoteId, [animalId+dataAplicacao], [animalId+synced]",
      })
      .upgrade(async (tx) => {
        const desmamas = await tx.table("desmamas").toArray();
        for (const d of desmamas) {
          const rec = d as { animalId?: string; nascimentoId?: string };
          if (!rec.animalId && rec.nascimentoId) {
            await tx
              .table("desmamas")
              .update(d.id, { animalId: rec.nascimentoId });
          }
        }
        const pesagens = await tx.table("pesagens").toArray();
        for (const p of pesagens) {
          const rec = p as { animalId?: string; nascimentoId?: string };
          if (!rec.animalId && rec.nascimentoId) {
            await tx
              .table("pesagens")
              .update(p.id, { animalId: rec.nascimentoId });
          }
        }
        const vacinacoes = await tx.table("vacinacoes").toArray();
        for (const v of vacinacoes) {
          const rec = v as { animalId?: string; nascimentoId?: string };
          if (!rec.animalId && rec.nascimentoId) {
            await tx
              .table("vacinacoes")
              .update(v.id, { animalId: rec.nascimentoId });
          }
        }
      });

    // Versão 30: Tabela de ocorrências por animal (sanidade)
    this.version(30).stores({
      ocorrenciaAnimais:
        "id, animalId, confinamentoAnimalId, data, tipo, synced, remoteId, deletedAt, [animalId+data], [confinamentoAnimalId+data]",
    });
  }
}

export const db = new AppDB();

// Garantir que o banco está aberto e tratar erros de compatibilidade
db.open().catch((err) => {
  console.error("Erro ao abrir banco de dados:", err);
  // Em caso de erro, tentar recriar o banco
  if (err.name === "DatabaseClosedError" || err.name === "OpenFailedError") {
    console.warn("Tentando recriar banco de dados...");
    // Não fazer nada aqui, deixar o componente tentar abrir novamente
  }
});
