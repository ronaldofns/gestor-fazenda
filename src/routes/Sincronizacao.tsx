import { useState, useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexieDB";
import useOnline from "../hooks/useOnline";
import { useAppSettings } from "../hooks/useAppSettings";
import { usePermissions } from "../hooks/usePermissions";
import { ColorPaletteKey } from "../hooks/useThemeColors";
import {
  getPrimaryButtonClass,
  getPrimaryCardClass,
  getTitleTextClass,
} from "../utils/themeHelpers";
import { Icons } from "../utils/iconMapping";
import {
  syncAll,
  syncAllFull,
  SyncProgress,
  SyncStats,
} from "../api/syncService";
import { showToast } from "../utils/toast";
import { setGlobalSyncing, getGlobalSyncing } from "../components/Sidebar";
import {
  getSyncQueueStats,
  createSyncEventsForPendingRecords,
  resetFailedSyncEvents,
} from "../utils/syncEvents";
import { exportarBackupCompleto, importarBackup } from "../utils/exportarDados";
import ConfirmDialog from "../components/ConfirmDialog";

interface PendenciaTabela {
  nome: string;
  quantidade: number;
  icone: any;
  detalhes?: Array<{
    id: string;
    dataPesagem?: string;
    peso?: number;
    animalId?: string;
    observacao?: string;
    [key: string]: any;
  }>;
}

interface SyncLog {
  timestamp: string;
  sucesso: boolean;
  erro?: string;
  detalhes?: string;
}

const STORAGE_KEY_LAST_SYNC = "lastSyncTimestamp";
const STORAGE_KEY_SYNC_LOGS = "syncLogs";
const MAX_LOGS = 20;

export default function Sincronizacao() {
  const online = useOnline();
  const { appSettings } = useAppSettings();
  const { hasPermission } = usePermissions();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;
  const podeExportarDados = hasPermission("exportar_dados");
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    variant?: "danger" | "warning" | "info";
  }>({
    open: false,
    message: "",
    onConfirm: () => {},
  });
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SYNC_LOGS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Buscar pendências de cada tabela
  // Pausar queries durante sincronização para melhorar performance
  const todasTabelas = useLiveQuery(async () => {
    // Se estiver sincronizando, retornar dados em cache ou vazio para não competir por recursos
    if (syncing) {
      return [];
    }

    const pendencias: PendenciaTabela[] = [];

    try {
      // Fazendas
      const fazendas = await db.fazendas.toArray();
      const pendFazendas = fazendas.filter((f) => f.synced === false);
      if (pendFazendas.length > 0) {
        pendencias.push({
          nome: "Fazendas",
          quantidade: pendFazendas.length,
          icone: Icons.Building2,
          detalhes: pendFazendas.map((f) => ({ id: f.id, nome: f.nome })),
        });
      }
    } catch (err) {
      console.error("Erro ao contar fazendas:", err);
    }

    try {
      // Raças
      const racas = await db.racas.toArray();
      const pendRacas = racas.filter((r) => r.synced === false);
      if (pendRacas.length > 0) {
        pendencias.push({
          nome: "Raças",
          quantidade: pendRacas.length,
          icone: Icons.Tag,
          detalhes: pendRacas.map((r) => ({ id: r.id, nome: r.nome })),
        });
      }
    } catch (err) {
      console.error("Erro ao contar raças:", err);
    }

    try {
      // Categorias
      const categorias = await db.categorias.toArray();
      const pendCategorias = categorias.filter((c) => c.synced === false);
      if (pendCategorias.length > 0) {
        pendencias.push({
          nome: "Categorias",
          quantidade: pendCategorias.length,
          icone: Icons.Folder,
          detalhes: pendCategorias.map((c) => ({ id: c.id, nome: c.nome })),
        });
      }
    } catch (err) {
      console.error("Erro ao contar categorias:", err);
    }

    try {
      // Desmamas
      const desmamas = await db.desmamas.toArray();
      const pendDesmamas = desmamas.filter((d) => d.synced === false);
      if (pendDesmamas.length > 0) {
        pendencias.push({
          nome: "Desmamas",
          quantidade: pendDesmamas.length,
          icone: Icons.Scale,
          detalhes: pendDesmamas.map((d) => ({
            id: d.id,
            dataDesmama: d.dataDesmama,
            pesoDesmama: d.pesoDesmama,
          })),
        });
      }
    } catch (err) {
      console.error("Erro ao contar desmamas:", err);
    }

    try {
      // Matrizes
      const matrizes = await db.matrizes.toArray();
      const pendMatrizes = matrizes.filter((m) => m.synced === false);
      if (pendMatrizes.length > 0) {
        pendencias.push({
          nome: "Matrizes",
          quantidade: pendMatrizes.length,
          icone: Icons.ListTree,
          detalhes: pendMatrizes.map((m) => ({
            id: m.id,
            identificador: m.identificador,
          })),
        });
      }
    } catch (err) {
      console.error("Erro ao contar matrizes:", err);
    }

    try {
      // Usuários
      const usuarios = await db.usuarios.toArray();
      const pendUsuarios = usuarios.filter((u) => u.synced === false);
      if (pendUsuarios.length > 0) {
        pendencias.push({
          nome: "Usuários",
          quantidade: pendUsuarios.length,
          icone: Icons.Users,
          detalhes: pendUsuarios.map((u) => ({
            id: u.id,
            nome: u.nome,
            email: u.email,
          })),
        });
      }
    } catch (err) {
      console.error("Erro ao contar usuários:", err);
    }

    try {
      // Auditoria
      const audits = await db.audits.toArray();
      const pendAudits = audits.filter((a) => a.synced === false);
      if (pendAudits.length > 0) {
        pendencias.push({
          nome: "Auditoria",
          quantidade: pendAudits.length,
          icone: Icons.FileText,
          detalhes: pendAudits.slice(0, 20).map((a) => ({
            id: a.id,
            entity: a.entity,
            entityId: a.entityId?.substring(0, 8),
            action: a.action,
          })),
        });
      }
    } catch (err) {
      console.error("Erro ao contar auditoria:", err);
    }

    try {
      // Notificações Lidas
      const notificacoesLidas = await db.notificacoesLidas.toArray();
      const pendNotificacoes = notificacoesLidas.filter(
        (n) => n.synced === false,
      );
      if (pendNotificacoes.length > 0) {
        pendencias.push({
          nome: "Notificações",
          quantidade: pendNotificacoes.length,
          icone: Icons.Bell,
          detalhes: pendNotificacoes.map((n) => ({
            id: n.id,
            tipo: n.tipo,
            marcadaEm: n.marcadaEm,
          })),
        });
      }
    } catch (err) {
      console.error("Erro ao contar notificações:", err);
    }

    try {
      // Configurações de Alerta
      const alertSettings = await db.alertSettings.toArray();
      const pendAlertSettings = alertSettings.filter((a) => a.synced === false);
      if (pendAlertSettings.length > 0) {
        pendencias.push({
          nome: "Config. Alertas",
          quantidade: pendAlertSettings.length,
          icone: Icons.AlertCircle,
          detalhes: pendAlertSettings.map((a) => ({ id: a.id })),
        });
      }
    } catch (err) {
      console.error("Erro ao contar alert settings:", err);
    }

    try {
      // Configurações do App
      const appSettings = await db.appSettings.toArray();
      const pendAppSettings = appSettings.filter((a) => a.synced === false);
      if (pendAppSettings.length > 0) {
        pendencias.push({
          nome: "Config. App",
          quantidade: pendAppSettings.length,
          icone: Icons.Settings,
          detalhes: pendAppSettings.map((a) => ({ id: a.id })),
        });
      }
    } catch (err) {
      console.error("Erro ao contar app settings:", err);
    }

    try {
      // Permissões
      if (db.rolePermissions) {
        const rolePermissions = await db.rolePermissions.toArray();
        const pendPermissoes = rolePermissions.filter(
          (p) => p.synced === false,
        );
        if (pendPermissoes.length > 0) {
          pendencias.push({
            nome: "Permissões",
            quantidade: pendPermissoes.length,
            icone: Icons.Shield,
            detalhes: pendPermissoes.map((p) => ({
              id: p.id,
              role: p.role,
              permission: p.permission,
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar permissões:", err);
    }

    try {
      // Pesagens
      if (db.pesagens) {
        const pesagens = await db.pesagens.toArray();
        const pendPesagens = pesagens.filter((p) => p.synced === false);
        if (pendPesagens.length > 0) {
          pendencias.push({
            nome: "Pesagens",
            quantidade: pendPesagens.length,
            icone: Icons.Scale,
            detalhes: pendPesagens.map((p) => ({
              id: p.id,
              dataPesagem: p.dataPesagem,
              peso: p.peso,
              animalId: p.animalId,
              observacao: p.observacao,
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar pesagens:", err);
    }

    try {
      // Vacinações
      if (db.vacinacoes) {
        const vacinacoes = await db.vacinacoes.toArray();
        const pendVacinacoes = vacinacoes.filter((v) => v.synced === false);
        if (pendVacinacoes.length > 0) {
          pendencias.push({
            nome: "Vacinações",
            quantidade: pendVacinacoes.length,
            icone: Icons.Injection,
            detalhes: pendVacinacoes.map((v) => ({
              id: v.id,
              vacina: v.vacina,
              dataAplicacao: v.dataAplicacao,
              animalId: v.animalId,
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar vacinações:", err);
    }

    try {
      // Tipos de Animal
      if (db.tiposAnimal) {
        const tiposAnimal = await db.tiposAnimal.toArray();
        const pendTipos = tiposAnimal.filter((t) => t.synced === false);
        if (pendTipos.length > 0) {
          pendencias.push({
            nome: "Tipos de Animal",
            quantidade: pendTipos.length,
            icone: Icons.Tag,
            detalhes: pendTipos.map((t) => ({ id: t.id, nome: t.nome })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar tipos de animal:", err);
    }

    try {
      // Status de Animal
      if (db.statusAnimal) {
        const statusAnimal = await db.statusAnimal.toArray();
        const pendStatus = statusAnimal.filter((s) => s.synced === false);
        if (pendStatus.length > 0) {
          pendencias.push({
            nome: "Status de Animal",
            quantidade: pendStatus.length,
            icone: Icons.Tag,
            detalhes: pendStatus.map((s) => ({ id: s.id, nome: s.nome })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar status de animal:", err);
    }

    try {
      // Origens
      if (db.origens) {
        const origens = await db.origens.toArray();
        const pendOrigens = origens.filter((o) => o.synced === false);
        if (pendOrigens.length > 0) {
          pendencias.push({
            nome: "Origens",
            quantidade: pendOrigens.length,
            icone: Icons.Tag,
            detalhes: pendOrigens.map((o) => ({ id: o.id, nome: o.nome })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar origens:", err);
    }

    try {
      // Tags
      if (db.tags) {
        const tags = await db.tags.toArray();
        const pendTags = tags.filter((t) => t.synced === false);
        if (pendTags.length > 0) {
          pendencias.push({
            nome: "Tags",
            quantidade: pendTags.length,
            icone: Icons.Tag,
            detalhes: pendTags.map((t) => ({ id: t.id, name: t.name })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar tags:", err);
    }

    try {
      // Atribuições de Tags
      if (db.tagAssignments) {
        const tagAssignments = await db.tagAssignments.toArray();
        const pendAssignments = tagAssignments.filter(
          (a) => a.synced === false,
        );
        if (pendAssignments.length > 0) {
          pendencias.push({
            nome: "Atribuições de Tags",
            quantidade: pendAssignments.length,
            icone: Icons.Tag,
            detalhes: pendAssignments.map((a) => ({
              id: a.id,
              entityType: a.entityType,
              entityId: a.entityId?.substring(0, 8),
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar tag assignments:", err);
    }

    try {
      // Animais
      if (db.animais) {
        const animais = await db.animais.toArray();
        const pendAnimais = animais.filter(
          (a) => !a.deletedAt && a.synced === false,
        );
        if (pendAnimais.length > 0) {
          pendencias.push({
            nome: "Animais",
            quantidade: pendAnimais.length,
            icone: Icons.Cow,
            detalhes: pendAnimais.map((a) => ({
              id: a.id,
              brinco: a.brinco,
              nome: a.nome,
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar animais:", err);
    }

    try {
      // Genealogias
      const pendentes = await db.genealogias
        .filter((g) => g.synced === false)
        .toArray();
      if (pendentes.length > 0) {
        console.log("🧬 Genealogias pendentes:", pendentes);
      }

      if (db.genealogias) {
        const genealogias = await db.genealogias.toArray();
        const pendGenealogias = genealogias.filter(
          (g) => !g.deletedAt && g.synced === false,
        );
        if (pendGenealogias.length > 0) {
          pendencias.push({
            nome: "Genealogias",
            quantidade: pendGenealogias.length,
            icone: Icons.ListTree,
            detalhes: pendGenealogias.map((g) => ({
              id: g.id,
              animalId: g.animalId?.substring(0, 8),
              geracoes: g.geracoes,
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar genealogias:", err);
    }

    try {
      // Exclusões
      if (db.deletedRecords) {
        const deletedRecords = await db.deletedRecords.toArray();
        const pendDeletedList = deletedRecords.filter(
          (d) => d.synced === false,
        );
        if (pendDeletedList.length > 0) {
          pendencias.push({
            nome: "Exclusões",
            quantidade: pendDeletedList.length,
            icone: Icons.Trash2,
            detalhes: pendDeletedList.map((d) => ({
              id: d.id,
              uuid: d.uuid?.substring(0, 8),
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar exclusões:", err);
    }

    try {
      // Confinamentos
      if (db.confinamentos) {
        const confinamentos = await db.confinamentos.toArray();
        const pendConfinamentos = confinamentos.filter(
          (c) => c.synced === false,
        );
        if (pendConfinamentos.length > 0) {
          pendencias.push({
            nome: "Confinamentos",
            quantidade: pendConfinamentos.length,
            icone: Icons.Warehouse,
            detalhes: pendConfinamentos.map((c) => ({
              id: c.id,
              nome: c.nome,
              dataInicio: c.dataInicio,
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar confinamentos:", err);
    }

    try {
      // Confinamento Animais (vínculos animal-confinamento)
      if (db.confinamentoAnimais) {
        const confinamentoAnimais = await db.confinamentoAnimais.toArray();
        const pendVinculos = confinamentoAnimais.filter(
          (v) => v.deletedAt == null && v.synced === false,
        );
        if (pendVinculos.length > 0) {
          pendencias.push({
            nome: "Confinamento Animais",
            quantidade: pendVinculos.length,
            icone: Icons.Cow,
            detalhes: pendVinculos.map((v) => ({
              id: v.id,
              confinamentoId: v.confinamentoId?.substring(0, 8),
              dataEntrada: v.dataEntrada,
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar confinamento animais:", err);
    }

    try {
      // Pesagens (tabela geral)
      if (db.pesagens) {
        const pesagens = await db.pesagens.toArray();
        const pendPesagens = pesagens.filter((p) => p.synced === false);
        if (pendPesagens.length > 0) {
          pendencias.push({
            nome: "Pesagens",
            quantidade: pendPesagens.length,
            icone: Icons.Scale,
            detalhes: pendPesagens.map((p) => ({
              id: p.id,
              data: p.dataPesagem || p.data,
              peso: p.peso,
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar pesagens:", err);
    }

    try {
      // Confinamento Alimentação
      if (db.confinamentoAlimentacao) {
        const confinamentoAlimentacao =
          await db.confinamentoAlimentacao.toArray();
        const pendAlimentacao = confinamentoAlimentacao.filter(
          (a) => a.deletedAt == null && a.synced === false,
        );
        if (pendAlimentacao.length > 0) {
          pendencias.push({
            nome: "Confinamento Alimentação",
            quantidade: pendAlimentacao.length,
            icone: Icons.Calendar,
            detalhes: pendAlimentacao.map((a) => ({
              id: a.id,
              data: a.data,
              tipoDieta: a.tipoDieta,
            })),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao contar confinamento alimentação:", err);
    }

    return pendencias;
  }, []);

  const totalPendencias = useMemo(() => {
    return todasTabelas?.reduce((sum, t) => sum + t.quantidade, 0) || 0;
  }, [todasTabelas]);

  // Estatísticas da fila de eventos
  // Pausar durante sincronização para melhorar performance
  const filaStats = useLiveQuery(async () => {
    if (syncing) {
      return null; // Pausar durante sincronização
    }
    try {
      if (db.syncEvents) {
        return await getSyncQueueStats();
      }
      return null;
    } catch (err) {
      console.error("Erro ao buscar estatísticas da fila:", err);
      return null;
    }
  }, [syncing]);

  // Eventos pendentes da fila
  // Pausar durante sincronização para melhorar performance
  const eventosPendentes = useLiveQuery(async () => {
    if (syncing) {
      return []; // Pausar durante sincronização
    }
    try {
      if (db.syncEvents) {
        const todosEventos = await db.syncEvents.toArray();
        const eventos = todosEventos
          .filter((e) => !e.synced)
          .sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        return eventos.slice(0, 10); // Mostrar apenas os 10 mais recentes
      }
      return [];
    } catch (err) {
      console.error("Erro ao buscar eventos pendentes:", err);
      return [];
    }
  }, [syncing]);

  const [ultimoSync, setUltimoSync] = useState<Date | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  });

  // Escutar eventos de sincronização completada (manual ou automática)
  useEffect(() => {
    const handleSyncCompleted = (e: Event) => {
      const customEvent = e as CustomEvent<{
        timestamp: string;
        success: boolean;
        stats?: SyncStats;
      }>;
      if (customEvent.detail.success) {
        const timestamp = new Date(customEvent.detail.timestamp);
        setUltimoSync(timestamp);
        // Atualizar localStorage também
        localStorage.setItem(STORAGE_KEY_LAST_SYNC, timestamp.toISOString());

        // Armazenar estatísticas
        if (customEvent.detail.stats) {
          setSyncStats(customEvent.detail.stats);
        }
      }

      // Limpar progresso quando sincronização terminar
      setSyncProgress(null);
    };

    window.addEventListener("syncCompleted", handleSyncCompleted);

    return () => {
      window.removeEventListener("syncCompleted", handleSyncCompleted);
    };
  }, []);

  // Escutar eventos de progresso de sincronização
  useEffect(() => {
    const handleSyncProgress = (e: Event) => {
      const customEvent = e as CustomEvent<SyncProgress>;
      setSyncProgress(customEvent.detail);
    };

    window.addEventListener("syncProgress", handleSyncProgress);

    return () => {
      window.removeEventListener("syncProgress", handleSyncProgress);
    };
  }, []);

  const formatarData = (date: Date | null) => {
    if (!date) return "Nunca";
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const adicionarLog = (log: SyncLog) => {
    setSyncLogs((prev) => {
      const novos = [log, ...prev].slice(0, MAX_LOGS);
      try {
        localStorage.setItem(STORAGE_KEY_SYNC_LOGS, JSON.stringify(novos));
      } catch (err) {
        console.error("Erro ao salvar logs:", err);
      }
      return novos;
    });
  };

  const handleSync = async (forceFull: boolean = false) => {
    if (!online) {
      showToast({
        type: "error",
        title: "Sem conexão",
        message: "Você precisa estar online para sincronizar.",
      });
      return;
    }

    if (syncing) return;

    setSyncing(true);
    setGlobalSyncing(true);

    const syncCompletedPromise = new Promise<{ stats?: SyncStats }>(
      (resolve) => {
        const handler = (e: Event) => {
          const customEvent = e as CustomEvent<{
            timestamp: string;
            success: boolean;
            stats?: SyncStats;
          }>;
          window.removeEventListener("syncCompleted", handler);
          resolve({ stats: customEvent.detail.stats });
        };
        window.addEventListener("syncCompleted", handler);
      },
    );

    try {
      const syncFn = forceFull ? syncAllFull : syncAll;
      const { ran } = await syncFn();

      if (!ran) {
        showToast({
          type: "info",
          title: "Sincronização em andamento",
          message:
            "Uma sincronização já está em execução. Aguarde a conclusão.",
        });
        return;
      }

      const { stats } = await syncCompletedPromise;
      const fim = new Date();

      setUltimoSync(fim);

      let totalRegistros = 0;
      let duracaoReal = "0.0";

      if (stats && stats.duration) {
        duracaoReal = (stats.duration / 1000).toFixed(1);
        totalRegistros = Object.values(stats.steps).reduce(
          (sum, step) => sum + step.recordsProcessed,
          0,
        );
      }

      const detalhesLog =
        totalRegistros > 0
          ? `Sincronização concluída em ${duracaoReal}s (${totalRegistros} registros)`
          : `Sincronização concluída em ${duracaoReal}s`;

      adicionarLog({
        timestamp: fim.toISOString(),
        sucesso: true,
        detalhes: forceFull ? `[Full] ${detalhesLog}` : detalhesLog,
      });

      const mensagemToast =
        totalRegistros > 0
          ? `${totalRegistros} registros sincronizados em ${duracaoReal}s.`
          : `Todos os dados foram sincronizados com sucesso em ${duracaoReal}s.`;

      showToast({
        type: "success",
        title: "Sincronização concluída",
        message: mensagemToast,
      });
    } catch (error: any) {
      const fim = new Date();
      const erroMsg = error?.message || "Erro desconhecido";

      adicionarLog({
        timestamp: fim.toISOString(),
        sucesso: false,
        erro: erroMsg,
        detalhes: error?.stack || "",
      });

      showToast({
        type: "error",
        title: "Erro na sincronização",
        message: erroMsg,
      });
    } finally {
      setSyncing(false);
      setGlobalSyncing(false);
    }
  };

  const handleSyncFullClick = () => {
    setConfirmDialog({
      open: true,
      title: "Forçar sincronização completa",
      message:
        "Isso irá buscar todos os dados do servidor novamente (full pull), ignorando o histórico incremental. Use quando houver suspeita de dados desatualizados ou checkpoint corrompido. Pode demorar mais e consumir mais dados. Deseja continuar?",
      variant: "warning",
      onConfirm: () => {
        setConfirmDialog({ open: false, message: "", onConfirm: () => {} });
        handleSync(true);
      },
    });
  };

  const handleCriarEventosPendencias = async () => {
    try {
      const { created, errors } = await createSyncEventsForPendingRecords();
      if (errors.length > 0) {
        showToast({
          type: "warning",
          message: `${created} evento(s) criado(s). Erros: ${errors.slice(0, 3).join("; ")}`,
        });
      } else if (created > 0) {
        showToast({
          type: "success",
          message: `${created} evento(s) criado(s) para pendências. Clique em "Sincronizar Agora" para enviar.`,
        });
      } else {
        showToast({
          type: "info",
          message: "Nenhuma pendência sem evento na fila.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        message: err?.message || "Erro ao criar eventos para pendências.",
      });
    }
  };

  const handleReenviarEventosComErro = async () => {
    try {
      const count = await resetFailedSyncEvents();
      if (count > 0) {
        showToast({
          type: "success",
          message: `${count} evento(s) com erro foram resetados. Clique em "Sincronizar Agora" para reenviar.`,
        });
      } else {
        showToast({
          type: "info",
          message: "Nenhum evento com erro para reenviar.",
        });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        message: err?.message || "Erro ao resetar eventos.",
      });
    }
  };

  const handleExportarBackup = async () => {
    if (!podeExportarDados) {
      showToast({
        type: "error",
        title: "Sem permissão",
        message: "Você não tem permissão para exportar dados.",
      });
      return;
    }
    try {
      const resultado = await exportarBackupCompleto();
      if (resultado && resultado.sucesso) {
        showToast({
          type: "success",
          title: "Backup exportado",
          message: `Arquivo: ${resultado.nomeArquivo}`,
        });
      }
    } catch (error: any) {
      console.error("Erro ao exportar backup:", error);
      showToast({
        type: "error",
        title: "Erro ao exportar backup",
        message: error.message,
      });
    }
  };

  const handleImportarBackupClick = () => {
    setConfirmDialog({
      open: true,
      title: "Importar Backup",
      message:
        "A importação irá adicionar os dados do backup ao sistema. Dados existentes não serão sobrescritos. Deseja continuar?",
      variant: "warning",
      onConfirm: () => {
        setConfirmDialog({ open: false, message: "", onConfirm: () => {} });
        fileInputRef.current?.click();
      },
    });
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const resultado = await importarBackup(file);

      if (resultado.sucesso) {
        showToast({
          type: "success",
          title: "Backup importado",
          message: resultado.mensagem,
        });
        if (resultado.totais && resultado.totais.importados) {
          const importados = resultado.totais.importados;
          const detalhes = Object.entries(importados)
            .filter(([_, qtd]) => (qtd as number) > 0)
            .map(([tabela, qtd]) => `${tabela}: ${qtd}`)
            .join(", ");
          if (detalhes) {
            console.log("Detalhes da importação:", detalhes);
          }
        }
      } else {
        showToast({
          type: "error",
          title: "Erro ao importar backup",
          message: resultado.mensagem,
        });
      }
    } catch (error: any) {
      console.error("Erro ao importar backup:", error);
      showToast({
        type: "error",
        title: "Erro ao importar backup",
        message: error.message,
      });
    } finally {
      setImporting(false);
      // Limpar input para permitir selecionar o mesmo arquivo novamente
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Escutar mudanças no estado global de sincronização
  useEffect(() => {
    const listener = (isSyncing: boolean) => {
      setSyncing(isSyncing);
    };
    const syncListeners = (window as any).__syncListeners || new Set();
    syncListeners.add(listener);
    (window as any).__syncListeners = syncListeners;

    const handleSyncStateChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ syncing: boolean }>;
      setSyncing(customEvent.detail.syncing);
    };

    window.addEventListener("syncStateChange", handleSyncStateChange);
    setSyncing(getGlobalSyncing());

    return () => {
      syncListeners.delete(listener);
      window.removeEventListener("syncStateChange", handleSyncStateChange);
    };
  }, []);

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-full mx-auto overflow-x-hidden">
      {/* Cabeçalho */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <div
            className={`p-2 rounded-lg ${getPrimaryCardClass(primaryColor)}`}
          >
            <Icons.RefreshCw
              className={`w-6 h-6 ${getTitleTextClass(primaryColor)}`}
            />
          </div>
          <h1
            className={`text-2xl sm:text-3xl font-bold ${getTitleTextClass(primaryColor)}`}
          >
            Centro de Sincronização
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 ml-12">
          Gerencie a sincronização de dados entre o dispositivo e o servidor
        </p>
      </div>

      {/* Status Geral - Card Principal */}
      <div
        className={`${getPrimaryCardClass(primaryColor)} rounded-xl p-4 sm:p-4 mb-4 shadow-sm border-2`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                online
                  ? "bg-green-100 dark:bg-green-900/30"
                  : "bg-red-100 dark:bg-red-900/30"
              }`}
            >
              {online ? (
                <Icons.Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Icons.WifiOff className="w-5 h-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Status da Conexão
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {online
                  ? "Conectado ao servidor"
                  : "Sem conexão com o servidor"}
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              online
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
            }`}
          >
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full animate-pulse ${
                online ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm font-semibold">
              {online ? "Online" : "Offline"}
            </span>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Icons.Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Última sincronização
              </p>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {ultimoSync ? formatarData(ultimoSync) : "Nunca"}
            </p>
            {ultimoSync && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {Math.floor((Date.now() - ultimoSync.getTime()) / 1000 / 60)}{" "}
                min atrás
              </p>
            )}
          </div>
          <div
            className={`rounded-lg p-4 border-2 ${
              totalPendencias > 0
                ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {totalPendencias > 0 ? (
                <Icons.AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <Icons.CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              )}
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Pendências locais
              </p>
            </div>
            <p
              className={`text-xl font-bold ${
                totalPendencias > 0
                  ? "text-yellow-700 dark:text-yellow-300"
                  : "text-green-700 dark:text-green-300"
              }`}
            >
              {totalPendencias}{" "}
              {totalPendencias === 1 ? "registro" : "registros"}
            </p>
            {totalPendencias === 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Tudo sincronizado!
              </p>
            )}
          </div>
        </div>

        {/* Botão de Sincronização e Backup */}
        <div className="flex items-center justify-center gap-3 flex-wrap pt-3 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={() => handleSync(false)}
            disabled={!online || syncing}
            className={`
              ${getPrimaryButtonClass(primaryColor)}
              ${!online || syncing ? "opacity-50 cursor-not-allowed" : "hover:scale-105 transition-transform"}
              px-6 py-2.5 text-white font-semibold shadow-md flex items-center gap-3 rounded-lg disabled:hover:scale-100`}
          >
            {syncing ? (
              <>
                <Icons.Loader2 className="w-5 h-5 animate-spin" />
                <span>Sincronizando...</span>
              </>
            ) : (
              <>
                <Icons.RefreshCw className="w-5 h-5" />
                <span>Sincronizar Agora</span>
              </>
            )}
          </button>

          <button
            onClick={handleSyncFullClick}
            disabled={!online || syncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-amber-500 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Forçar sincronização completa (full pull de todas as tabelas)"
          >
            <Icons.RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Forçar sync completa</span>
          </button>

          {totalPendencias > 0 && (
            <button
              onClick={handleCriarEventosPendencias}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Cria eventos na fila para registros pendentes que ainda não têm evento (resolve pendências que não sincronizam)"
            >
              <Icons.Plus className="w-4 h-4" />
              <span className="hidden sm:inline">
                Criar eventos para pendências
              </span>
            </button>
          )}

          {filaStats != null && filaStats.comErro > 0 && (
            <button
              onClick={handleReenviarEventosComErro}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Zera tentativas dos eventos com erro para que sejam reenviados na próxima sincronização"
            >
              <Icons.RotateCcw className="w-4 h-4 shrink-0" />
              <span>Zerar tentativas e reenviar</span>
            </button>
          )}

          {podeExportarDados && (
            <button
              onClick={handleExportarBackup}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:scale-105 transition-transform"
            >
              <Icons.Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            onClick={handleImportarBackupClick}
            disabled={importing || syncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:scale-105 transition-transform"
          >
            {importing ? (
              <>
                <Icons.Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Importando...</span>
              </>
            ) : (
              <>
                <Icons.Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Importar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Indicador de Progresso de Sincronização */}
      {syncProgress && (
        <div
          className={`${getPrimaryCardClass(primaryColor)} p-6 mb-6 border-l-4 border-blue-500`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Icons.RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white">
                  {syncProgress.message}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Etapa {syncProgress.current} de {syncProgress.total}
                </p>
              </div>
            </div>
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {Math.round((syncProgress.current / syncProgress.total) * 100)}%
            </span>
          </div>
          {/* Barra de Progresso */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${(syncProgress.current / syncProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Dialog de Confirmação */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog({ open: false, message: "", onConfirm: () => {} })
        }
      />

      {/* Pendências por Tabela */}
      {totalPendencias > 0 && (
        <div
          className={`${getPrimaryCardClass(primaryColor)} rounded-xl p-4 mb-5 shadow-sm border-2`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Icons.AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Pendências por Tabela
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todasTabelas?.map((tabela) => {
              const Icon = tabela.icone;
              return (
                <div
                  key={tabela.nome}
                  className="bg-white dark:bg-slate-800 rounded-lg border-2 border-yellow-200 dark:border-yellow-800 hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors"
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                      <Icon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {tabela.nome}
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                        {tabela.quantidade}{" "}
                        {tabela.quantidade === 1 ? "pendente" : "pendentes"}
                      </p>
                    </div>
                  </div>
                  {tabela.detalhes && tabela.detalhes.length > 0 && (
                    <div className="px-3 pb-3 border-t border-yellow-200 dark:border-yellow-800">
                      <div className="mt-2 space-y-2">
                        {tabela.detalhes.map((detalhe, idx) => (
                          <div
                            key={idx}
                            className="text-xs bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800"
                          >
                            <p className="font-medium text-gray-700 dark:text-gray-300">
                              {tabela.nome === "Pesagens" &&
                              detalhe.dataPesagem &&
                              detalhe.peso !== undefined ? (
                                <>
                                  Data: {detalhe.dataPesagem} | Peso:{" "}
                                  {detalhe.peso} kg
                                </>
                              ) : tabela.nome === "Vacinações" &&
                                detalhe.vacina ? (
                                <>
                                  Vacina: {detalhe.vacina}
                                  {detalhe.dataAplicacao
                                    ? ` | ${detalhe.dataAplicacao}`
                                    : ""}
                                </>
                              ) : (tabela.nome === "Fazendas" ||
                                  tabela.nome === "Raças" ||
                                  tabela.nome === "Categorias") &&
                                detalhe.nome ? (
                                <>{detalhe.nome}</>
                              ) : tabela.nome === "Desmamas" &&
                                (detalhe.dataDesmama ||
                                  detalhe.pesoDesmama !== undefined) ? (
                                <>
                                  Data: {detalhe.dataDesmama || "-"} | Peso:{" "}
                                  {detalhe.pesoDesmama ?? "-"} kg
                                </>
                              ) : tabela.nome === "Matrizes" &&
                                detalhe.identificador ? (
                                <>{detalhe.identificador}</>
                              ) : tabela.nome === "Usuários" &&
                                (detalhe.nome || detalhe.email) ? (
                                <>
                                  {detalhe.nome}{" "}
                                  {detalhe.email ? `(${detalhe.email})` : ""}
                                </>
                              ) : tabela.nome === "Auditoria" &&
                                detalhe.entity ? (
                                <>
                                  {detalhe.entity} / {detalhe.entityId} /{" "}
                                  {detalhe.action}
                                </>
                              ) : tabela.nome === "Notificações" &&
                                detalhe.tipo ? (
                                <>
                                  {detalhe.tipo}
                                  {detalhe.marcadaEm
                                    ? ` | ${detalhe.marcadaEm}`
                                    : ""}
                                </>
                              ) : tabela.nome === "Exclusões" &&
                                detalhe.uuid ? (
                                <>UUID: {detalhe.uuid}...</>
                              ) : tabela.nome === "Permissões" &&
                                (detalhe.role || detalhe.permission) ? (
                                <>
                                  {detalhe.role} / {detalhe.permission}
                                </>
                              ) : tabela.nome === "Animais" &&
                                (detalhe.brinco || detalhe.nome) ? (
                                <>
                                  Brinco: {detalhe.brinco}{" "}
                                  {detalhe.nome ? `- ${detalhe.nome}` : ""}
                                </>
                              ) : tabela.nome === "Genealogias" &&
                                detalhe.animalId ? (
                                <>
                                  Animal: {detalhe.animalId}... |{" "}
                                  {detalhe.geracoes} gerações
                                </>
                              ) : (tabela.nome === "Tipos de Animal" ||
                                  tabela.nome === "Status de Animal" ||
                                  tabela.nome === "Origens") &&
                                detalhe.nome ? (
                                <>{detalhe.nome}</>
                              ) : tabela.nome === "Tags" && detalhe.name ? (
                                <>{detalhe.name}</>
                              ) : tabela.nome === "Atribuições de Tags" &&
                                detalhe.entityType ? (
                                <>
                                  {detalhe.entityType} / {detalhe.entityId}...
                                </>
                              ) : (
                                <>ID: {detalhe.id?.substring(0, 8)}...</>
                              )}
                            </p>
                            {detalhe.animalId &&
                              (tabela.nome === "Pesagens" ||
                                tabela.nome === "Vacinações") && (
                                <p className="text-gray-500 dark:text-gray-400 mt-1">
                                  Animal: {detalhe.animalId.substring(0, 8)}...
                                </p>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fila de Eventos de Sincronização */}
      {filaStats !== undefined && (
        <div
          className={`${getPrimaryCardClass(primaryColor)} rounded-xl p-4 mb-5 shadow-sm border-2`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icons.RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Fila de Eventos de Sincronização
              </h2>
            </div>
            {filaStats && filaStats.total > 0 && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {filaStats.pendentes}
                  </span>{" "}
                  pendentes
                </span>
                {filaStats.comErro > 0 && (
                  <span className="text-red-600 dark:text-red-400 font-semibold">
                    {filaStats.comErro} com erro
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Estatísticas */}
          {filaStats ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Total
                  </p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {filaStats.total}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Pendentes
                  </p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {filaStats.pendentes}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Sincronizados
                  </p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {filaStats.sincronizados}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Com Erro
                  </p>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">
                    {filaStats.comErro}
                  </p>
                  {filaStats.comErro > 0 && (
                    <button
                      type="button"
                      onClick={handleReenviarEventosComErro}
                      disabled={syncing}
                      className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
                    >
                      Zerar tentativas
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <Icons.Loader2 className="w-6 h-6 text-gray-400 dark:text-gray-500 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Carregando estatísticas da fila...
              </p>
            </div>
          )}

          {/* Eventos Pendentes Recentes */}
          {filaStats && filaStats.total === 0 ? (
            <div className="text-center py-6">
              <Icons.CheckCircle className="w-12 h-12 text-green-300 dark:text-green-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Nenhum evento na fila de sincronização.
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                Os eventos serão criados automaticamente quando houver
                alterações pendentes.
              </p>
            </div>
          ) : (
            eventosPendentes &&
            eventosPendentes.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Eventos Pendentes Recentes
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {eventosPendentes.map((evento) => (
                    <div
                      key={evento.id}
                      className={`p-3 rounded-lg border-2 ${
                        evento.tentativas >= 5
                          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                          : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                evento.tipo === "INSERT"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                  : evento.tipo === "UPDATE"
                                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                              }`}
                            >
                              {evento.tipo}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                              {evento.entidade}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            ID: {evento.entityId.substring(0, 8)}...
                          </p>
                          {evento.erro && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                              {evento.erro}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {evento.tentativas}{" "}
                            {evento.tentativas === 1
                              ? "tentativa"
                              : "tentativas"}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {formatarData(new Date(evento.createdAt))}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Logs de Sincronização */}
      <div
        className={`${getPrimaryCardClass(primaryColor)} rounded-xl p-4 shadow-sm border-2`}
      >
        <div className="flex items-center gap-2 mb-3">
          <Icons.History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Histórico de Sincronizações Manuais
          </h2>
          {syncLogs.length > 0 && (
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
              {syncLogs.length}{" "}
              {syncLogs.length === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 -mt-2">
          Registro apenas de sincronizações iniciadas manualmente pelo botão
          "Sincronizar Agora"
        </p>
        {syncLogs.length === 0 ? (
          <div className="text-center py-8">
            <Icons.History className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Nenhuma sincronização manual registrada ainda.
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              O histórico será atualizado após cada sincronização manual
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {syncLogs.map((log, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 transition-all ${
                  log.sucesso
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700"
                    : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      log.sucesso
                        ? "bg-green-100 dark:bg-green-900/30"
                        : "bg-red-100 dark:bg-red-900/30"
                    }`}
                  >
                    {log.sucesso ? (
                      <Icons.CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Icons.XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-sm font-semibold ${
                          log.sucesso
                            ? "text-green-700 dark:text-green-300"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {log.sucesso
                          ? "✓ Sincronização Concluída"
                          : "✗ Erro na Sincronização"}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-800 px-2 py-1 rounded">
                        {formatarData(new Date(log.timestamp))}
                      </span>
                    </div>
                    {log.detalhes && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                        {log.detalhes}
                      </p>
                    )}
                    {log.erro && (
                      <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-700 dark:text-red-300">
                        <strong>Erro:</strong> {log.erro}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
