import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexieDB";
import { Confinamento, Fazenda } from "../db/models";
import { Icons } from "../utils/iconMapping";
import { showToast } from "../utils/toast";
import ConfinamentoModal from "../components/ConfinamentoModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAppSettings } from "../hooks/useAppSettings";
import { usePermissions } from "../hooks/usePermissions";
import { useFazendaContext } from "../hooks/useFazendaContext";
import { ColorPaletteKey } from "../hooks/useThemeColors";
import {
  getPrimaryButtonClass,
  getTitleTextClass,
} from "../utils/themeHelpers";
import { formatDateBR } from "../utils/date";
import {
  encerrarConfinamento,
  calcularGMD,
  calcularGMDParcial,
} from "../utils/confinamentoRules";
import { estadoConfinamentoPorTotais } from "../utils/confinamentoEstado";
import { createSyncEvent } from "../utils/syncEvents";
import { registrarAudit } from "../utils/audit";
import { useAuth } from "../hooks/useAuth";

export default function ListaConfinamentos() {
  const { appSettings } = useAppSettings();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const { fazendaSelecionada } = useFazendaContext();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;
  const navigate = useNavigate();

  const podeGerenciarConfinamentos = hasPermission("gerenciar_fazendas"); // Usar mesma permissão por enquanto

  // Buscar confinamentos
  const confinamentosRaw =
    useLiveQuery(() => db.confinamentos.toArray(), []) || [];
  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];

  const fazendasMap = useMemo(() => {
    const map = new Map<string, Fazenda>();
    fazendasRaw.forEach((f) => map.set(f.id, f));
    return map;
  }, [fazendasRaw]);

  // Filtrar por fazenda selecionada se houver
  const confinamentos = useMemo(() => {
    let filtrados = confinamentosRaw.filter((c) => !c.deletedAt);

    if (fazendaSelecionada) {
      filtrados = filtrados.filter(
        (c) => c.fazendaId === fazendaSelecionada.id,
      );
    }

    // Ordenar por data de início (mais recente primeiro)
    return filtrados.sort((a, b) => {
      const dataA = new Date(a.dataInicio).getTime();
      const dataB = new Date(b.dataInicio).getTime();
      return dataB - dataA;
    });
  }, [confinamentosRaw, fazendaSelecionada]);

  // Buscar contagem de animais por confinamento
  const animaisPorConfinamento =
    useLiveQuery(async () => {
      const map = new Map<string, { total: number; ativos: number }>();
      for (const conf of confinamentos) {
        const vínculos = await db.confinamentoAnimais
          .where("confinamentoId")
          .equals(conf.id)
          .and((v) => v.deletedAt == null)
          .toArray();
        const ativos = vínculos.filter((v) => v.dataSaida == null).length;
        map.set(conf.id, { total: vínculos.length, ativos });
      }
      return map;
    }, [confinamentos]) || new Map();

  // Indicadores por confinamento: peso médio entrada e GMD médio
  const indicadoresPorConfinamento =
    useLiveQuery(async () => {
      const map = new Map<
        string,
        { pesoMedioEntrada: number; gmdMedio: number }
      >();
      const pesagensRaw = await db.pesagens.toArray();
      const animaisRaw = await db.animais.toArray();
      const animaisMap = new Map(animaisRaw.map((a) => [a.id, a]));
      for (const conf of confinamentos) {
        const vínculos = await db.confinamentoAnimais
          .where("confinamentoId")
          .equals(conf.id)
          .and((v) => v.deletedAt == null)
          .toArray();
        if (vínculos.length === 0) {
          map.set(conf.id, { pesoMedioEntrada: 0, gmdMedio: 0 });
          continue;
        }
        const pesoMedioEntrada =
          vínculos.reduce((s, v) => s + (v.pesoEntrada || 0), 0) /
          vínculos.length;
        const gmdPorVinculo: number[] = [];
        for (const v of vínculos) {
          if (v.dataSaida && v.pesoSaida != null) {
            const r = calcularGMD(
              v.pesoEntrada,
              v.pesoSaida,
              v.dataEntrada,
              v.dataSaida,
            );
            if (r.gmd != null) gmdPorVinculo.push(r.gmd);
          } else {
            // Buscar última pesagem do animal (tabela `pesagens`), não da tabela de confinamento
            const pesagensV = pesagensRaw.filter(
              (p) => p.animalId === v.animalId && !p.deletedAt,
            );
            const ultima =
              pesagensV.length > 0
                ? pesagensV.sort(
                    (a, b) =>
                      new Date(b.dataPesagem).getTime() -
                      new Date(a.dataPesagem).getTime(),
                  )[0]
                : null;
            const pesoAtual =
              ultima?.peso ?? animaisMap.get(v.animalId)?.pesoAtual;
            if (pesoAtual != null) {
              const r = calcularGMDParcial(
                v.pesoEntrada,
                pesoAtual,
                v.dataEntrada,
              );
              if (r.gmd != null) gmdPorVinculo.push(r.gmd);
            }
          }
        }
        const gmdMedio =
          gmdPorVinculo.length > 0
            ? gmdPorVinculo.reduce((a, b) => a + b, 0) / gmdPorVinculo.length
            : 0;
        map.set(conf.id, { pesoMedioEntrada, gmdMedio });
      }
      return map;
    }, [confinamentos]) || new Map();

  // Estados do modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [confinamentoEditando, setConfinamentoEditando] =
    useState<Confinamento | null>(null);

  // Estado do modal de confirmação
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: "danger" | "warning" | "info";
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    variant: "danger",
    onConfirm: () => {},
  });

  const handleNovoConfinamento = () => {
    setConfinamentoEditando(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const handleEditarConfinamento = (confinamento: Confinamento) => {
    setConfinamentoEditando(confinamento);
    setModalMode("edit");
    setModalOpen(true);
  };

  const handleFecharModal = () => {
    setModalOpen(false);
    setConfinamentoEditando(null);
  };

  const handleVerDetalhes = (confinamentoId: string) => {
    navigate(`/confinamentos/${confinamentoId}`);
  };

  const handleEncerrarConfinamento = (confinamento: Confinamento) => {
    setConfirmDialog({
      open: true,
      title: "Encerrar Confinamento",
      message: `Deseja realmente encerrar o confinamento "${confinamento.nome}"? Todos os animais ativos serão encerrados automaticamente. Esta ação não pode ser desfeita.`,
      variant: "warning",
      confirmText: "Encerrar",
      cancelText: "Cancelar",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        try {
          const hoje = new Date().toISOString().split("T")[0];
          const resultado = await encerrarConfinamento(confinamento.id, hoje);

          if (resultado.sucesso) {
            showToast({
              type: "success",
              message: `Confinamento encerrado. ${resultado.animaisEncerrados} animal(is) encerrado(s).`,
            });
          } else {
            showToast({
              type: "error",
              message: resultado.erro || "Erro ao encerrar confinamento",
            });
          }
        } catch (error: any) {
          console.error("Erro ao encerrar confinamento:", error);
          showToast({
            type: "error",
            message: error.message || "Erro ao encerrar confinamento",
          });
        }
      },
    });
  };

  const handleDelete = async (
    confinamentoId: string,
    confinamentoNome: string,
  ) => {
    setConfirmDialog({
      open: true,
      title: "Excluir Confinamento",
      message: `Deseja realmente excluir o confinamento "${confinamentoNome}"? Esta ação não pode ser desfeita.`,
      variant: "danger",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        try {
          // Verificar se há animais vinculados
          const vínculos = await db.confinamentoAnimais
            .where("confinamentoId")
            .equals(confinamentoId)
            .and((v) => v.deletedAt == null)
            .toArray();

          if (vínculos.length > 0) {
            showToast({
              type: "warning",
              message: `Existem ${vínculos.length} animal(is) vinculado(s) a este confinamento. Encerre o confinamento primeiro.`,
            });
            return;
          }

          const confinamento = await db.confinamentos.get(confinamentoId);
          if (!confinamento) return;

          // Soft delete
          const now = new Date().toISOString();
          await db.confinamentos.update(confinamentoId, {
            deletedAt: now,
            updatedAt: now,
            synced: false,
          });

          // Registrar auditoria
          if (user) {
            await registrarAudit({
              entity: "confinamento",
              entityId: confinamentoId,
              action: "delete",
              userId: user.id,
              userNome: user.nome,
              before: JSON.stringify(confinamento),
            });
          }

          // Criar evento de sincronização
          await createSyncEvent("DELETE", "confinamento", confinamentoId, null);

          showToast({
            type: "success",
            message: "Confinamento excluído com sucesso!",
          });
        } catch (error: any) {
          console.error("Erro ao excluir confinamento:", error);
          showToast({
            type: "error",
            message: error.message || "Erro ao excluir confinamento",
          });
        }
      },
    });
  };

  const getStatusBadge = (status: string) => {
    const classes = {
      ativo:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      finalizado:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      cancelado:
        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${classes[status as keyof typeof classes] || classes.ativo}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-2 sm:p-3 md:p-4 text-gray-900 dark:text-slate-100 max-w-full overflow-x-hidden">
      <div className="mb-4 flex justify-between items-center gap-2">
        <h1 className={getTitleTextClass(primaryColor)}>Confinamentos</h1>
        {podeGerenciarConfinamentos && (
          <button
            onClick={handleNovoConfinamento}
            className={`${getPrimaryButtonClass(primaryColor)} text-white font-medium rounded-md px-2 md:px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors flex items-center justify-center gap-1 md:gap-2 min-w-[40px] md:min-w-0`}
            title="Novo Confinamento"
            aria-label="Novo Confinamento"
          >
            <Icons.Plus className="w-4 h-4 flex-shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">
              Novo Confinamento
            </span>
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg overflow-hidden">
        {confinamentos.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
            Nenhum confinamento cadastrado ainda.
            {podeGerenciarConfinamentos && (
              <button
                type="button"
                onClick={handleNovoConfinamento}
                className="ml-2 text-green-600 hover:text-green-800 dark:hover:text-green-400 underline"
              >
                Cadastrar primeiro confinamento
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Tabela Desktop */}
            <div className="hidden md:block overflow-x-auto -mx-2 sm:mx-0 max-w-full">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                <thead className="bg-gray-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Fazenda
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Data Início
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Animais
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Peso méd. entrada
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      GMD
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                  {confinamentos.map((confinamento) => {
                    const fazenda = fazendasMap.get(confinamento.fazendaId);
                    const animais = animaisPorConfinamento.get(confinamento.id);
                    const ind = indicadoresPorConfinamento.get(confinamento.id);
                    const total = animais?.total ?? 0;
                    const ativos = animais?.ativos ?? 0;
                    const statusDerivado = estadoConfinamentoPorTotais(
                      confinamento,
                      total,
                      ativos,
                    );
                    return (
                      <tr
                        key={confinamento.id}
                        className="hover:bg-gray-50 dark:hover:bg-slate-800"
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {confinamento.nome}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-300">
                          {fazenda?.nome || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-300">
                          {formatDateBR(confinamento.dataInicio)}
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(statusDerivado)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-300">
                          {animais
                            ? `${animais.ativos}/${animais.total}`
                            : "0/0"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-300">
                          {ind && ind.pesoMedioEntrada > 0
                            ? `${ind.pesoMedioEntrada.toFixed(1)} kg`
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-300">
                          {ind && ind.gmdMedio > 0
                            ? `${ind.gmdMedio.toFixed(3)} kg/dia`
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleVerDetalhes(confinamento.id)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Ver detalhes"
                            >
                              <Icons.Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                navigate(
                                  `/confinamentos/${confinamento.id}?aba=indicadores`,
                                )
                              }
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                              title="Ver relatório"
                            >
                              <Icons.FileText className="w-4 h-4" />
                            </button>
                            {podeGerenciarConfinamentos && (
                              <>
                                {statusDerivado === "ativo" && (
                                  <button
                                    onClick={() =>
                                      handleEncerrarConfinamento(confinamento)
                                    }
                                    className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                                    title="Encerrar confinamento"
                                  >
                                    <Icons.XCircle className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleEditarConfinamento(confinamento)
                                  }
                                  className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                  title="Editar"
                                >
                                  <Icons.Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDelete(
                                      confinamento.id,
                                      confinamento.nome,
                                    )
                                  }
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                  title="Excluir"
                                >
                                  <Icons.Trash className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards Mobile */}
            <div className="md:hidden space-y-3 px-1">
              {confinamentos.map((confinamento) => {
                const fazenda = fazendasMap.get(confinamento.fazendaId);
                const animais = animaisPorConfinamento.get(confinamento.id);
                const ind = indicadoresPorConfinamento.get(confinamento.id);
                const totalM = animais?.total ?? 0;
                const ativosM = animais?.ativos ?? 0;
                const statusDerivadoM = estadoConfinamentoPorTotais(
                  confinamento,
                  totalM,
                  ativosM,
                );
                return (
                  <div
                    key={confinamento.id}
                    className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden min-w-0"
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                            {confinamento.nome}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                            {fazenda?.nome || "N/A"}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {getStatusBadge(statusDerivadoM)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-slate-400">
                        <span>
                          Início: {formatDateBR(confinamento.dataInicio)}
                        </span>
                        <span>
                          Animais:{" "}
                          {animais
                            ? `${animais.ativos}/${animais.total}`
                            : "0/0"}
                        </span>
                        {ind && ind.pesoMedioEntrada > 0 && (
                          <span className="col-span-2 sm:col-span-1">
                            Peso méd. entrada: {ind.pesoMedioEntrada.toFixed(1)}{" "}
                            kg
                          </span>
                        )}
                        {ind && ind.gmdMedio > 0 && (
                          <span className="col-span-2 sm:col-span-1">
                            GMD: {ind.gmdMedio.toFixed(3)} kg/dia
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                        <button
                          onClick={() => handleVerDetalhes(confinamento.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                          <Icons.Eye className="w-4 h-4 flex-shrink-0" />
                          Ver
                        </button>
                        <button
                          onClick={() =>
                            navigate(
                              `/confinamentos/${confinamento.id}?aba=indicadores`,
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                        >
                          <Icons.FileText className="w-4 h-4 flex-shrink-0" />
                          Relatório
                        </button>
                        {podeGerenciarConfinamentos && (
                          <>
                            {statusDerivadoM === "ativo" && (
                              <button
                                onClick={() =>
                                  handleEncerrarConfinamento(confinamento)
                                }
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/50"
                              >
                                <Icons.XCircle className="w-4 h-4 flex-shrink-0" />
                                Encerrar
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleEditarConfinamento(confinamento)
                              }
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-medium hover:bg-gray-200 dark:hover:bg-slate-600"
                            >
                              <Icons.Edit className="w-4 h-4 flex-shrink-0" />
                              Editar
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(confinamento.id, confinamento.nome)
                              }
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/50"
                            >
                              <Icons.Trash className="w-4 h-4 flex-shrink-0" />
                              Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modais */}
      <ConfinamentoModal
        open={modalOpen}
        mode={modalMode}
        initialData={confinamentoEditando}
        onClose={handleFecharModal}
        onSaved={() => {
          handleFecharModal();
        }}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
