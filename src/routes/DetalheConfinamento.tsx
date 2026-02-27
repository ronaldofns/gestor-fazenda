import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexieDB";
import { usePagination } from "../hooks/usePagination";
import {
  ConfinamentoAnimal,
  ConfinamentoAlimentacao,
  Animal,
  OcorrenciaAnimal,
} from "../db/models";
import { Icons } from "../utils/iconMapping";
import { showToast } from "../utils/toast";
import ConfinamentoModal from "../components/ConfinamentoModal";
import ConfinamentoAnimalModal from "../components/ConfinamentoAnimalModal";
import ConfinamentoAlimentacaoModal from "../components/ConfinamentoAlimentacaoModal";
import ConfinamentoPesagemModal from "../components/ConfinamentoPesagemModal";
import OcorrenciaAnimalModal from "../components/OcorrenciaAnimalModal";
import PdfViewer from "../components/PdfViewer";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAppSettings } from "../hooks/useAppSettings";
import { usePermissions } from "../hooks/usePermissions";
import { ColorPaletteKey } from "../hooks/useThemeColors";
import {
  getPrimaryButtonClass,
  getTitleTextClass,
  getThemeClasses,
} from "../utils/themeHelpers";
import { formatDateBR } from "../utils/date";
import { calcularGMD, calcularGMDParcial } from "../utils/confinamentoRules";
import { estadoConfinamentoDerivado } from "../utils/confinamentoEstado";
import { createSyncEvent } from "../utils/syncEvents";
import {
  exportarConfinamentoPDF,
  exportarConfinamentoExcel,
  exportarConfinamentoDetalhePDF,
  type DadosConfinamentoExportacao,
  type DadosConfinamentoDetalhePDF,
} from "../utils/exportarConfinamento";

type TabType =
  | "animais"
  | "pesagens"
  | "alimentacao"
  | "indicadores"
  | "ocorrencias"
  | "historico";

const ARROBA_KG = 15;
const PAGE_SIZE = 10;

export default function DetalheConfinamento() {
  const { confinamentoId } = useParams<{ confinamentoId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { appSettings } = useAppSettings();
  const { hasPermission } = usePermissions();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;
  const podeGerenciarConfinamentos = hasPermission("gerenciar_confinamentos");

  const [activeTab, setActiveTab] = useState<TabType>("animais");

  // Abrir aba Indicadores quando ?aba=indicadores (ex.: vindo do "Ver relatório" na lista)
  const abaParam = searchParams.get("aba");

  useEffect(() => {
    if (abaParam === "indicadores") {
      setActiveTab("indicadores");
      setSearchParams({}, { replace: true });
    }
  }, [abaParam]);

  const [modalConfinamentoOpen, setModalConfinamentoOpen] = useState(false);
  const [modalAnimalOpen, setModalAnimalOpen] = useState(false);
  const [vinculoEditando, setVinculoEditando] =
    useState<ConfinamentoAnimal | null>(null);
  const [vinculoAEncerrar, setVinculoAEncerrar] =
    useState<ConfinamentoAnimal | null>(null);
  const [modalAlimentacaoOpen, setModalAlimentacaoOpen] = useState(false);
  const [alimentacaoEditando, setAlimentacaoEditando] =
    useState<ConfinamentoAlimentacao | null>(null);
  const [alimentacaoAExcluir, setAlimentacaoAExcluir] =
    useState<ConfinamentoAlimentacao | null>(null);
  const [modalPesagemOpen, setModalPesagemOpen] = useState(false);
  const [modalPdfDetalheOpen, setModalPdfDetalheOpen] = useState(false);
  const [pdfDetalheBlob, setPdfDetalheBlob] = useState<Blob | null>(null);
  const [pdfDetalheOrdenarPor, setPdfDetalheOrdenarPor] = useState<
    | "brinco_az"
    | "brinco_za"
    | "ultima_pesagem_peso_maior"
    | "ultima_pesagem_peso_menor"
  >("brinco_az");

  const [buscaAnimaisPesagens, setBuscaAnimaisPesagens] = useState("");
  const [modalOcorrenciaOpen, setModalOcorrenciaOpen] = useState(false);
  const [ocorrenciaEditando, setOcorrenciaEditando] =
    useState<OcorrenciaAnimal | null>(null);
  const [ocorrenciaVinculoParaNovo, setOcorrenciaVinculoParaNovo] =
    useState<ConfinamentoAnimal | null>(null);
  const [ocorrenciaPickerOpen, setOcorrenciaPickerOpen] = useState(false);

  // Buscar confinamento
  const confinamento = useLiveQuery(
    () => (confinamentoId ? db.confinamentos.get(confinamentoId) : undefined),
    [confinamentoId],
  );

  // Buscar fazenda
  const fazenda = useLiveQuery(
    () =>
      confinamento?.fazendaId
        ? db.fazendas.get(confinamento.fazendaId)
        : undefined,
    [confinamento?.fazendaId],
  );

  // Buscar vinculos animal-confinamento
  const vinculoAnimalConfinamento =
    useLiveQuery(
      () =>
        confinamentoId
          ? db.confinamentoAnimais
              .where("confinamentoId")
              .equals(confinamentoId)
              .and((v) => v.deletedAt == null)
              .toArray()
          : [],
      [confinamentoId],
    ) || [];

  const animalIdsKey = useMemo(
    () =>
      vinculoAnimalConfinamento
        .map((v) => v.animalId)
        .filter(Boolean)
        .sort()
        .join("|"),
    [vinculoAnimalConfinamento],
  );

  // Buscar animais
  const animaisMap =
    useLiveQuery(async () => {
      const map = new Map<string, Animal>();

      if (!animalIdsKey) return map;

      const animais = await db.animais.bulkGet(animalIdsKey.split("|"));

      animais.forEach((a) => {
        if (a) map.set(a.id, a);
      });

      return map;
    }, [animalIdsKey]) || new Map();

  // Buscar pesagens do conjunto de animais do confinamento (usar tabela geral `pesagens`)
  const vinculoIdsKey = useMemo(
    () =>
      vinculoAnimalConfinamento
        .map((v) => v.id)
        .sort()
        .join("|"),
    [vinculoAnimalConfinamento],
  );

  const pesagensRaw =
    useLiveQuery(async () => {
      if (!confinamentoId || vinculoAnimalConfinamento.length === 0) return [];

      const animalIds = vinculoAnimalConfinamento.map((v) => v.animalId);

      const pesagens = await db.pesagens
        .where("animalId")
        .anyOf(animalIds)
        .and((p) => p.deletedAt == null)
        .toArray();

      return pesagens.sort((a, b) => {
        const animalA = animaisMap.get(a.animalId);
        const animalB = animaisMap.get(b.animalId);

        const brincoA = animalA?.brinco ?? "";
        const brincoB = animalB?.brinco ?? "";

        // 1️⃣ Ordena por brinco
        if (brincoA < brincoB) return -1;
        if (brincoA > brincoB) return 1;

        // 2️⃣ Se brinco igual, ordena por data (mais recente primeiro)
        return (
          new Date(b.dataPesagem).getTime() - new Date(a.dataPesagem).getTime()
        );
      });
    }, [confinamentoId, vinculoIdsKey, animaisMap]) || [];

  // Buscar registros de alimentação do confinamento
  const alimentacaoRaw =
    useLiveQuery<ConfinamentoAlimentacao[]>(
      () =>
        confinamentoId
          ? db.confinamentoAlimentacao
              .where("confinamentoId")
              .equals(confinamentoId)
              .and((a) => a.deletedAt == null)
              .toArray()
          : Promise.resolve<ConfinamentoAlimentacao[]>([]),
      [confinamentoId],
    ) ?? [];

  const alimentacaoOrdenada = useMemo(
    () =>
      [...alimentacaoRaw].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
      ),
    [alimentacaoRaw],
  );

  // Buscar histórico (auditoria) do confinamento e dos vinculos
  const vinculosKey = useMemo(
    () =>
      vinculoAnimalConfinamento
        .map((v) => v.id)
        .sort()
        .join("|"),
    [vinculoAnimalConfinamento],
  );

  const historicoRaw =
    useLiveQuery(async () => {
      if (!confinamentoId) return [];

      const vinculoIds = vinculoAnimalConfinamento.map((v) => v.id);

      const auditsConfinamento = await db.audits
        .where("[entity+entityId]")
        .equals(["confinamento", confinamentoId])
        .toArray();

      const auditsAnimais =
        vinculoIds.length > 0
          ? await db.audits
              .where("entityId") // Certifique-se que entityId é um índice no seu Dexie
              .anyOf(vinculoIds)
              .filter((a) => a.entity === "confinamentoAnimal")
              .toArray()
          : [];

      return [...auditsConfinamento, ...auditsAnimais].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    }, [confinamentoId, vinculosKey]) || [];

  const { vinculosAtivos, vinculosEncerrados, statusConfinamentoDerivado } =
    useMemo(() => {
      const ativos = vinculoAnimalConfinamento.filter(
        (v) => v.dataSaida == null,
      );
      const encerrados = vinculoAnimalConfinamento.filter(
        (v) => v.dataSaida != null,
      );
      const statusDerivado = confinamento
        ? estadoConfinamentoDerivado(confinamento, vinculoAnimalConfinamento)
        : undefined;
      return {
        vinculosAtivos: ativos,
        vinculosEncerrados: encerrados,
        statusConfinamentoDerivado: statusDerivado,
      };
    }, [vinculoAnimalConfinamento, confinamento]);

  const ativosPagination = usePagination(
    vinculosAtivos,
    PAGE_SIZE,
    activeTab === "animais",
  );

  const encerradosPagination = usePagination(
    vinculosEncerrados,
    PAGE_SIZE,
    activeTab === "animais",
  );

  const termoBusca = buscaAnimaisPesagens.trim().toLowerCase();

  const animalIdsFiltrados = useMemo(() => {
    if (!termoBusca) return null;

    return new Set(
      vinculosAtivos
        .map((v) => {
          const animal = animaisMap.get(v.animalId);
          if (!animal) return null;

          const brinco = animal.brinco?.toLowerCase() ?? "";
          const nome = animal.nome?.toLowerCase() ?? "";

          if (brinco.includes(termoBusca) || nome.includes(termoBusca)) {
            return v.animalId;
          }
          return null;
        })
        .filter(Boolean) as string[],
    );
  }, [termoBusca, vinculosAtivos, animaisMap]);

  const pesagensFiltradas = useMemo(() => {
    if (!animalIdsFiltrados) return pesagensRaw;

    return pesagensRaw.filter((p) => animalIdsFiltrados.has(p.animalId));
  }, [pesagensRaw, animalIdsFiltrados]);

  const historicoPesagensPagination = usePagination(
    pesagensFiltradas,
    PAGE_SIZE,
  );

  type PaginationProps = {
    page: number;
    setPage: (p: number) => void;
    total: number;
    pageSize: number;
  };

  function Pagination({ page, setPage, total, pageSize }: PaginationProps) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between mt-3 gap-3 text-sm">
        <span className="text-gray-500">
          Página {page} de {totalPages}
        </span>

        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Anterior
          </button>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 rounded border disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>
    );
  }

  // Calcular indicadores do confinamento (incl. economia)
  const indicadores = useMemo(() => {
    // 1. Definição do estado inicial (Base)
    const base = {
      totalAnimais: 0,
      animaisAtivos: 0,
      pesoMedioEntrada: 0,
      pesoMedioSaida: 0,
      gmdMedio: 0,
      diasMedio: 0,
      mortalidade: 0,
      custoTotal: 0,
      custoPorDia: null,
      custoPorAnimalDia: null,
      custoPorKgGanho: null,
      kgGanhoTotal: 0,
      totalAnimalDias: 0,
      diasConfinamento: 0,
      margemEstimada: null,
    };

    // 2. Early Return: Se o confinamento ou os vínculos não existirem, para aqui.
    // Isso resolve o erro "'confinamento' é possivelmente 'indefinido'"
    if (!confinamento || !vinculoAnimalConfinamento) {
      return base;
    }

    const pesagensDoConfinamento = (pesagensRaw ?? []).filter(
      (p) =>
        p.dataPesagem &&
        new Date(p.dataPesagem) >= new Date(confinamento.dataInicio),
    );

    const custoTotal = (alimentacaoRaw ?? []).reduce(
      (s, a) => s + (a.custoTotal ?? 0),
      0,
    );

    // --- Cálculos de Médias de Peso ---
    const entradas = vinculoAnimalConfinamento
      .map((v) => v.pesoEntrada)
      .filter((p): p is number => p !== null && p > 0);

    const saidas = vinculoAnimalConfinamento
      .map((v) => v.pesoSaida)
      .filter((p): p is number => p !== null && p > 0);

    const pesoMedioEntrada =
      entradas.length > 0
        ? entradas.reduce((a, b) => a + b, 0) / entradas.length
        : 0;

    // A verificação 'saidas.length > 0' garante que o reduce não rode em array vazio
    const pesoMedioSaida =
      saidas.length > 0 ? saidas.reduce((a, b) => a + b, 0) / saidas.length : 0;

    // --- Lógica de GMD e Permanência ---
    const ultimaPesagemNoConfinamento = new Map();
    pesagensDoConfinamento.forEach((p) => {
      const atual = ultimaPesagemNoConfinamento.get(p.animalId);
      if (!atual || new Date(p.dataPesagem) > new Date(atual.data)) {
        ultimaPesagemNoConfinamento.set(p.animalId, {
          peso: p.peso,
          data: p.dataPesagem,
        });
      }
    });

    let totalAnimalDias = 0;
    let kgGanhoTotal = 0;
    const gmdCalculados = [];
    let totalAnimalDiasEncerrados = 0;
    let qtdEncerradosComDias = 0;

    for (const v of vinculoAnimalConfinamento) {
      let pesoFim = v.pesoSaida;
      let dataFim = v.dataSaida;

      if (!pesoFim) {
        const pesagemRecente = ultimaPesagemNoConfinamento.get(v.animalId);
        const animal = animaisMap?.get(v.animalId);
        pesoFim = pesagemRecente?.peso ?? animal?.pesoAtual;
        dataFim = pesagemRecente?.data ?? new Date().toISOString();
      }

      if (pesoFim != null && v.pesoEntrada != null) {
        const r = calcularGMD(v.pesoEntrada, pesoFim, v.dataEntrada, dataFim);

        if (r.gmd != null && r.dias >= 0) {
          gmdCalculados.push(r.gmd);
          totalAnimalDias += r.dias;
          const ganho = pesoFim - v.pesoEntrada;
          kgGanhoTotal += ganho > 0 ? ganho : 0;
        }
        // Duração média (encerrados): só conta quem tem dataSaida
        if (v.dataSaida && v.pesoSaida != null && r.dias >= 0) {
          totalAnimalDiasEncerrados += r.dias;
          qtdEncerradosComDias += 1;
        }
      }
    }

    // --- Finalização dos Indicadores ---
    const inicioConf = new Date(confinamento.dataInicio);
    const fimConf = confinamento.dataFimReal
      ? new Date(confinamento.dataFimReal)
      : new Date();
    const diasDecorridos = Math.max(
      1,
      Math.floor(
        (fimConf.getTime() - inicioConf.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    const gmdMedio =
      gmdCalculados.length > 0
        ? gmdCalculados.reduce((a, b) => a + b, 0) / gmdCalculados.length
        : 0;

    const margemEstimada =
      confinamento.precoVendaKg && kgGanhoTotal > 0
        ? kgGanhoTotal * confinamento.precoVendaKg - custoTotal
        : null;

    const totalAnimais = vinculoAnimalConfinamento.length;
    // Duração média apenas dos encerrados (quem tem dataSaida); sem encerrados = 0 e exibe "-"
    const diasMedio =
      qtdEncerradosComDias > 0
        ? totalAnimalDiasEncerrados / qtdEncerradosComDias
        : 0;

    return {
      ...base,
      totalAnimais,
      animaisAtivos: (vinculosAtivos ?? []).length,
      pesoMedioEntrada,
      pesoMedioSaida,
      gmdMedio,
      diasMedio,
      custoTotal,
      custoPorDia: custoTotal / diasDecorridos,
      custoPorAnimalDia:
        totalAnimalDias > 0 ? custoTotal / totalAnimalDias : null,
      custoPorKgGanho: kgGanhoTotal > 0 ? custoTotal / kgGanhoTotal : null,
      kgGanhoTotal,
      totalAnimalDias,
      diasConfinamento: diasDecorridos,
      margemEstimada,
    };
  }, [
    vinculoAnimalConfinamento,
    vinculosAtivos,
    animaisMap,
    pesagensRaw,
    alimentacaoRaw,
    confinamento,
  ]);

  // Ocorrências do confinamento (por vinculo) — hooks devem vir antes de qualquer return condicional

  const ocorrenciasRaw =
    useLiveQuery(async () => {
      if (vinculoAnimalConfinamento.length === 0) return [];

      const ids = vinculoAnimalConfinamento.map((v) => v.id);

      const todas = await db.ocorrenciaAnimais
        .where("confinamentoAnimalId")
        .anyOf(ids)
        .and((o) => o.deletedAt == null)
        .toArray();

      return todas.sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
      );
    }, [vinculoIdsKey]) || [];

  if (!confinamentoId || !confinamento) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500 dark:text-slate-400">
          Confinamento não encontrado
        </p>
        <button
          onClick={() => navigate("/confinamentos")}
          className="mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          Voltar para lista
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "animais" as TabType, label: "Animais", icon: Icons.Cow },
    { id: "pesagens" as TabType, label: "Pesagens", icon: Icons.Scale },
    {
      id: "alimentacao" as TabType,
      label: "Alimentação",
      icon: Icons.Warehouse,
    },
    {
      id: "indicadores" as TabType,
      label: "Indicadores",
      icon: Icons.BarChart,
    },
    {
      id: "ocorrencias" as TabType,
      label: "Ocorrências",
      icon: Icons.AlertTriangle,
    },
    { id: "historico" as TabType, label: "Histórico", icon: Icons.History },
  ];

  const handleAdicionarAnimal = () => {
    setVinculoEditando(null);
    setModalAnimalOpen(true);
  };

  const handleEditarVinculo = (vinculo: ConfinamentoAnimal) => {
    setVinculoEditando(vinculo);
    setModalAnimalOpen(true);
  };

  const handleEncerrarVinculo = (vinculo: ConfinamentoAnimal) => {
    setVinculoAEncerrar(vinculo);
  };

  const handleAdicionarAlimentacao = () => {
    setAlimentacaoEditando(null);
    setModalAlimentacaoOpen(true);
  };

  const handleEditarAlimentacao = (item: ConfinamentoAlimentacao) => {
    setAlimentacaoEditando(item);
    setModalAlimentacaoOpen(true);
  };

  const handleExcluirAlimentacao = (item: ConfinamentoAlimentacao) => {
    setAlimentacaoAExcluir(item);
  };

  const confirmarExcluirAlimentacao = async () => {
    const item = alimentacaoAExcluir;
    setAlimentacaoAExcluir(null);
    if (!item) return;
    try {
      const now = new Date().toISOString();
      await db.confinamentoAlimentacao.update(item.id, {
        deletedAt: now,
        updatedAt: now,
        synced: false,
      });
      const atual = await db.confinamentoAlimentacao.get(item.id);
      if (atual)
        await createSyncEvent(
          "UPDATE",
          "confinamentoAlimentacao",
          item.id,
          atual,
        );
      showToast({
        type: "success",
        message: "Registro de alimentação removido.",
      });
    } catch (error: any) {
      showToast({ type: "error", message: error.message || "Erro ao excluir" });
    }
  };

  const confirmarEncerrarVinculo = async () => {
    const vinculo = vinculoAEncerrar;
    setVinculoAEncerrar(null);
    if (!vinculo) return;

    const hoje = new Date().toISOString().split("T")[0];
    const animal = animaisMap.get(vinculo.animalId);
    const ultimoPeso = animal?.pesoAtual || vinculo.pesoEntrada;

    try {
      await db.confinamentoAnimais.update(vinculo.id, {
        dataSaida: hoje,
        pesoSaida: ultimoPeso,
        updatedAt: new Date().toISOString(),
        synced: false,
      });

      const vinculoAtualizado = await db.confinamentoAnimais.get(vinculo.id);
      if (vinculoAtualizado) {
        await createSyncEvent(
          "UPDATE",
          "confinamentoAnimal",
          vinculo.id,
          vinculoAtualizado,
        );
      }

      showToast({
        type: "success",
        message: "Animal encerrado do confinamento",
      });
    } catch (error: any) {
      console.error("Erro ao encerrar vinculo:", error);
      showToast({
        type: "error",
        message: error.message || "Erro ao encerrar vinculo",
      });
    }
  };

  const montarDadosExportacao =
    async (): Promise<DadosConfinamentoExportacao | null> => {
      if (!confinamento) return null;
      const statusDerivado = estadoConfinamentoDerivado(
        confinamento,
        vinculoAnimalConfinamento,
      );
      const fazenda = await db.fazendas.get(confinamento.fazendaId);
      const custoTotal = alimentacaoRaw.reduce(
        (s, a) => s + (a.custoTotal ?? 0),
        0,
      );
      const kgGanho = vinculoAnimalConfinamento
        .filter((v) => v.dataSaida && v.pesoSaida != null)
        .reduce((s, v) => s + ((v.pesoSaida ?? 0) - (v.pesoEntrada ?? 0)), 0);
      const arrobas = kgGanho / ARROBA_KG;
      const custoPorArroba = arrobas > 0 ? custoTotal / arrobas : null;
      return {
        resumo: {
          totalConfinamentos: 1,
          ativos: statusDerivado === "ativo" ? 1 : 0,
          totalAnimais: indicadores.totalAnimais,
          gmdMedioGeral: indicadores.gmdMedio,
          custoTotalGeral: custoTotal,
          mortalidade: indicadores.mortalidade,
          arrobasProducao: arrobas,
          custoPorArroba,
        },
        porConfinamento: [
          {
            nome: confinamento.nome,
            fazenda: fazenda?.nome ?? "N/A",
            status: statusDerivado,
            totalAnimais: indicadores.totalAnimais,
            pesoMedioEntrada: indicadores.pesoMedioEntrada,
            gmdMedio: indicadores.gmdMedio,
            custoTotal,
            arrobas,
            custoPorArroba,
            mortes: indicadores.mortalidade,
            diasMedio: indicadores.diasMedio,
          },
        ],
      };
    };

  const montarDadosDetalhePDF =
    async (): Promise<DadosConfinamentoDetalhePDF | null> => {
      if (!confinamento) return null;
      const fazenda = await db.fazendas.get(confinamento.fazendaId);
      const dataInicio = confinamento.dataInicio;
      const pesagensNoPeriodo = (pesagensRaw ?? []).filter(
        (p) => p.dataPesagem && new Date(p.dataPesagem) >= new Date(dataInicio),
      );

      const animais: DadosConfinamentoDetalhePDF["animais"] = [];

      for (const v of vinculoAnimalConfinamento) {
        const animal = animaisMap.get(v.animalId);
        const pesagensAnimal = pesagensNoPeriodo
          .filter((p) => p.animalId === v.animalId)
          .sort(
            (a, b) =>
              new Date(a.dataPesagem).getTime() -
              new Date(b.dataPesagem).getTime(),
          )
          .map((p) => ({ data: p.dataPesagem, peso: p.peso }));

        let pesoFim = v.pesoSaida ?? null;
        let dataFim: string | null = v.dataSaida ?? null;
        if (!pesoFim && pesagensAnimal.length > 0) {
          const ultima = pesagensAnimal[pesagensAnimal.length - 1];
          pesoFim = ultima.peso;
          dataFim = ultima.data;
        }
        if (!pesoFim && animal?.pesoAtual != null) {
          pesoFim = animal.pesoAtual;
          dataFim = new Date().toISOString().split("T")[0];
        }

        const { gmd, dias } = calcularGMD(
          v.pesoEntrada ?? 0,
          pesoFim ?? undefined,
          v.dataEntrada,
          dataFim ?? undefined,
        );

        // Peso/data saída só para quem realmente saiu (tem dataSaida no vínculo)
        const saiu = v.dataSaida != null;
        animais.push({
          brinco: animal?.brinco ?? "—",
          dataEntrada: v.dataEntrada,
          pesoEntrada: v.pesoEntrada ?? 0,
          pesagens: pesagensAnimal,
          dataSaida: saiu ? v.dataSaida : null,
          pesoSaida: saiu ? (v.pesoSaida ?? pesoFim) : null,
          dias,
          gmd: gmd ?? null,
        });
      }

      return {
        nomeConfinamento: confinamento.nome,
        fazenda: fazenda?.nome ?? "N/A",
        dataInicio,
        dataFim: confinamento.dataFimReal ?? null,
        animais,
      };
    };

  return (
    <div className="p-2 sm:p-3 md:p-4 text-gray-900 dark:text-slate-100 max-w-full overflow-x-hidden min-w-[280px]">
      {/* Header — empilha no mobile; largura minima evita texto “em coluna” em viewports estreitos */}
      <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0 flex-1 w-full">
          <button
            onClick={() => navigate("/confinamentos")}
            className="mb-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
          >
            <Icons.ArrowLeft className="w-4 h-4 flex-shrink-0" />
            Voltar
          </button>
          <h1
            className={`text-xl sm:text-2xl font-bold min-w-0 truncate ${getTitleTextClass(primaryColor)}`}
          >
            {confinamento.nome}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 break-words hyphens-auto">
            {fazenda?.nome} • Inicio: {formatDateBR(confinamento.dataInicio)}
            {confinamento.dataFimReal &&
              ` • Fim: ${formatDateBR(confinamento.dataFimReal)}`}
          </p>
        </div>
        {podeGerenciarConfinamentos && (
          <div className="flex flex-shrink-0 justify-end">
            <button
              onClick={() => setModalConfinamentoOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 sm:px-4 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              title="Editar confinamento"
            >
              <Icons.Edit className="w-4 h-4" />
              <span className="hidden sm:inline">Editar</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs — todas visiveis no mobile (wrap em 2 linhas); sem scroll horizontal */}
      <div className="bg-white dark:bg-slate-900 shadow-sm rounded-xl overflow-hidden mb-4 border border-gray-200 dark:border-slate-700">
        <div
          className={`flex flex-wrap gap-1.5 p-2 ${getThemeClasses(primaryColor, "bg-light")} border-b border-gray-200 dark:border-slate-700`}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? `${getThemeClasses(primaryColor, "bg")} text-white shadow-md`
                  : "text-gray-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-700/60 hover:text-gray-900 dark:hover:text-slate-200"
              }`}
            >
              <tab.icon className="w-4 h-4 flex-shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content — min-w-0 para permitir scroll horizontal das tabelas no mobile */}
        <div className="p-4 sm:p-6 min-w-0 overflow-hidden">
          {/* Aba Animais */}
          {activeTab === "animais" && (
            <div className="min-w-0">
              <div className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <h2 className="text-lg font-semibold min-w-0">
                  Animais no Confinamento
                </h2>
                {podeGerenciarConfinamentos &&
                  statusConfinamentoDerivado === "ativo" && (
                    <button
                      onClick={handleAdicionarAnimal}
                      className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${getPrimaryButtonClass(primaryColor)} hover:opacity-90`}
                    >
                      <Icons.Plus className="w-4 h-4" />
                      Adicionar Animal
                    </button>
                  )}
              </div>

              {vinculoAnimalConfinamento.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                  Nenhum animal adicionado ao confinamento ainda.
                </p>
              ) : (
                <div className="space-y-4">
                  {vinculosAtivos.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Animais Ativos ({vinculosAtivos.length})
                      </h3>
                      {/* Mobile: cards */}
                      <div className="md:hidden space-y-3">
                        {ativosPagination.paginated.map((vinculo) => {
                          // render normal))}

                          const animal = animaisMap.get(vinculo.animalId);
                          const gmdParcial = animal?.pesoAtual
                            ? calcularGMDParcial(
                                vinculo.pesoEntrada,
                                animal.pesoAtual,
                                vinculo.dataEntrada,
                              )
                            : null;
                          return (
                            <div
                              key={vinculo.id}
                              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
                            >
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <span className="font-semibold text-gray-900 dark:text-slate-100">
                                  Brinco {animal?.brinco || "N/A"}
                                </span>
                                {podeGerenciarConfinamentos && (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleEncerrarVinculo(vinculo)
                                      }
                                      className="text-orange-600 dark:text-orange-400"
                                      title="Encerrar"
                                    >
                                      <Icons.XCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleEditarVinculo(vinculo)
                                      }
                                      className="text-blue-600 dark:text-blue-400"
                                      title="Editar"
                                    >
                                      <Icons.Edit className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    Nome
                                  </span>
                                  <span>{animal?.nome || "-"}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    Entrada
                                  </span>
                                  <span>
                                    {formatDateBR(vinculo.dataEntrada)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    Peso Entrada
                                  </span>
                                  <span>
                                    {vinculo.pesoEntrada.toFixed(2)} kg
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    Peso Atual
                                  </span>
                                  <span>
                                    {animal?.pesoAtual
                                      ? `${animal.pesoAtual.toFixed(2)} kg`
                                      : "-"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    GMD Parcial
                                  </span>
                                  <span>
                                    {gmdParcial?.gmd != null
                                      ? `${gmdParcial.gmd.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg/dia`
                                      : "-"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Desktop: tabela */}
                      <div className="hidden md:block w-full min-w-0 overflow-auto max-h-[55vh] sm:max-h-none -mx-1 px-1 border border-gray-200 dark:border-slate-700 rounded-lg">
                        <table className="min-w-[560px] w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm table-fixed sm:table-auto">
                          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800">
                            <tr>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Brinco
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Nome
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Entrada
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Peso Entrada
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Peso Atual
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                GMD Parcial
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Ações
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                            {ativosPagination.paginated.map((vinculo) => {
                              const animal = animaisMap.get(vinculo.animalId);
                              const gmdParcial = animal?.pesoAtual
                                ? calcularGMDParcial(
                                    vinculo.pesoEntrada,
                                    animal.pesoAtual,
                                    vinculo.dataEntrada,
                                  )
                                : null;
                              return (
                                <tr key={vinculo.id}>
                                  <td className="px-3 sm:px-4 py-2">
                                    {animal?.brinco || "N/A"}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2">
                                    {animal?.nome || "-"}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2">
                                    {formatDateBR(vinculo.dataEntrada)}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2">
                                    {vinculo.pesoEntrada.toFixed(2)} kg
                                  </td>
                                  <td className="px-3 sm:px-4 py-2">
                                    {animal?.pesoAtual
                                      ? `${animal.pesoAtual.toFixed(2)} kg`
                                      : "-"}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2">
                                    {gmdParcial?.gmd != null
                                      ? `${gmdParcial.gmd.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg/dia`
                                      : "-"}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2">
                                    <div className="flex gap-2">
                                      {podeGerenciarConfinamentos && (
                                        <>
                                          <button
                                            onClick={() =>
                                              handleEncerrarVinculo(vinculo)
                                            }
                                            className="text-orange-600 hover:text-orange-800 dark:text-orange-400"
                                            title="Encerrar"
                                          >
                                            <Icons.XCircle className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() =>
                                              handleEditarVinculo(vinculo)
                                            }
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                            title="Editar"
                                          >
                                            <Icons.Edit className="w-4 h-4" />
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
                      <Pagination
                        page={ativosPagination.page}
                        setPage={ativosPagination.setPage}
                        total={ativosPagination.total}
                        pageSize={PAGE_SIZE}
                      />
                    </div>
                  )}

                  {vinculosEncerrados.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Animais Encerrados ({vinculosEncerrados.length})
                      </h3>
                      {/* Mobile: cards */}
                      <div className="md:hidden space-y-3">
                        {encerradosPagination.paginated.map((vinculo) => {
                          const animal = animaisMap.get(vinculo.animalId);
                          const gmd =
                            vinculo.pesoSaida && vinculo.dataSaida
                              ? calcularGMD(
                                  vinculo.pesoEntrada,
                                  vinculo.pesoSaida,
                                  vinculo.dataEntrada,
                                  vinculo.dataSaida,
                                )
                              : null;
                          return (
                            <div
                              key={vinculo.id}
                              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
                            >
                              <div className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
                                Brinco {animal?.brinco || "N/A"}
                              </div>
                              <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    Nome
                                  </span>
                                  <span>{animal?.nome || "-"}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    Entrada
                                  </span>
                                  <span>
                                    {formatDateBR(vinculo.dataEntrada)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    Saida
                                  </span>
                                  <span>
                                    {vinculo.dataSaida
                                      ? formatDateBR(vinculo.dataSaida)
                                      : "-"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    Peso Entrada
                                  </span>
                                  <span>
                                    {vinculo.pesoEntrada.toFixed(2)} kg
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    Peso Saida
                                  </span>
                                  <span>
                                    {vinculo.pesoSaida
                                      ? `${vinculo.pesoSaida.toFixed(2)} kg`
                                      : "-"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    GMD
                                  </span>
                                  <span>
                                    {gmd?.gmd != null
                                      ? `${gmd.gmd.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg/dia (${gmd.dias} dias)`
                                      : "-"}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-slate-400">
                                    Motivo
                                  </span>
                                  <span>
                                    {vinculo.motivoSaida ? (
                                      <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-xs">
                                        {vinculo.motivoSaida}
                                      </span>
                                    ) : (
                                      "-"
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <Pagination
                          page={encerradosPagination.page}
                          setPage={encerradosPagination.setPage}
                          total={encerradosPagination.total}
                          pageSize={PAGE_SIZE}
                        />
                      </div>
                      {/* Desktop: tabela */}
                      <div className="hidden md:block w-full min-w-0 overflow-auto max-h-[55vh] sm:max-h-none -mx-1 px-1 border border-gray-200 dark:border-slate-700 rounded-lg">
                        <table className="min-w-[720px] w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm table-auto">
                          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800">
                            <tr>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Brinco
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Nome
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Entrada
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Saida
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Peso Entrada
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Peso Saida
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                GMD
                              </th>
                              <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                                Motivo
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                            {encerradosPagination.paginated.map((vinculo) => {
                              const animal = animaisMap.get(vinculo.animalId);
                              const gmd =
                                vinculo.pesoSaida && vinculo.dataSaida
                                  ? calcularGMD(
                                      vinculo.pesoEntrada,
                                      vinculo.pesoSaida,
                                      vinculo.dataEntrada,
                                      vinculo.dataSaida,
                                    )
                                  : null;
                              return (
                                <tr key={vinculo.id}>
                                  <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                                    {animal?.brinco || "N/A"}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2">
                                    {animal?.nome || "-"}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                                    {formatDateBR(vinculo.dataEntrada)}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                                    {vinculo.dataSaida
                                      ? formatDateBR(vinculo.dataSaida)
                                      : "-"}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                                    {vinculo.pesoEntrada.toFixed(2)} kg
                                  </td>
                                  <td className="px-3 sm:px-4 py-2">
                                    {vinculo.pesoSaida
                                      ? `${vinculo.pesoSaida.toFixed(2)} kg`
                                      : "-"}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2">
                                    {gmd?.gmd != null
                                      ? `${gmd.gmd.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg/dia (${gmd.dias} dias)`
                                      : "-"}
                                  </td>
                                  <td className="px-3 sm:px-4 py-2">
                                    {vinculo.motivoSaida ? (
                                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-slate-800">
                                        {vinculo.motivoSaida}
                                      </span>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <Pagination
                        page={encerradosPagination.page}
                        setPage={encerradosPagination.setPage}
                        total={encerradosPagination.total}
                        pageSize={PAGE_SIZE}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Aba Pesagens */}
          {activeTab === "pesagens" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  Pesagens do Confinamento
                </h2>
                {podeGerenciarConfinamentos &&
                  statusConfinamentoDerivado === "ativo" &&
                  vinculosAtivos.length > 0 && (
                    <button
                      onClick={() => setModalPesagemOpen(true)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm ${getPrimaryButtonClass(primaryColor)} hover:opacity-90`}
                    >
                      <Icons.Plus className="w-4 h-4" />
                      Registrar pesagem
                    </button>
                  )}
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Animais no confinamento
                </h3>
                <input
                  type="text"
                  placeholder="Buscar por brinco ou nome (apenas animais deste confinamento)"
                  value={buscaAnimaisPesagens}
                  onChange={(e) => setBuscaAnimaisPesagens(e.target.value)}
                  className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder:text-gray-500"
                />
              </div>

              <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Histórico de pesagens
              </h3>
              {pesagensRaw.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-6 border border-gray-200 dark:border-slate-700 rounded-lg">
                  Nenhuma pesagem registrada ainda. Use &quot;Registrar
                  pesagem&quot; para adicionar.
                </p>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {historicoPesagensPagination.paginated.map((pesagem) => {
                      const animal = animaisMap.get(pesagem.animalId);

                      return (
                        <div
                          key={pesagem.id}
                          className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
                        >
                          <div className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
                            {formatDateBR(pesagem.dataPesagem)} — Brinco{" "}
                            {animal?.brinco ?? "N/A"}
                          </div>

                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-slate-400">
                                Peso (kg)
                              </span>
                              <span>{pesagem.peso.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-slate-400">
                                Observações
                              </span>
                              <span>{pesagem.observacao || "-"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden md:block w-full min-w-0 overflow-auto max-h-[55vh] sm:max-h-none border border-gray-200 dark:border-slate-700 rounded-lg">
                    <table className="min-w-[420px] w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                      <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Data
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Animal
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Peso (kg)
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Observações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                        {historicoPesagensPagination.paginated.map(
                          (pesagem) => {
                            const animal = animaisMap.get(pesagem.animalId);

                            return (
                              <tr key={pesagem.id}>
                                <td className="px-3 sm:px-4 py-2">
                                  {formatDateBR(pesagem.dataPesagem)}
                                </td>
                                <td className="px-3 sm:px-4 py-2">
                                  {animal?.brinco ?? "N/A"}
                                </td>
                                <td className="px-3 sm:px-4 py-2">
                                  {pesagem.peso.toFixed(2)}
                                </td>
                                <td className="px-3 sm:px-4 py-2">
                                  {pesagem.observacao || "-"}
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={historicoPesagensPagination.page}
                    setPage={historicoPesagensPagination.setPage}
                    total={historicoPesagensPagination.total}
                    pageSize={PAGE_SIZE}
                  />
                </>
              )}
            </div>
          )}

          {/* Aba Alimentação */}
          {activeTab === "alimentacao" && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Alimentação</h2>
                {podeGerenciarConfinamentos &&
                  statusConfinamentoDerivado === "ativo" && (
                    <button
                      onClick={handleAdicionarAlimentacao}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm ${getPrimaryButtonClass(primaryColor)} hover:opacity-90`}
                    >
                      <Icons.Plus className="w-4 h-4" />
                      Adicionar registro
                    </button>
                  )}
              </div>
              {alimentacaoOrdenada.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                  Nenhum registro de alimentação ainda. Adicione para controlar
                  dieta e custos.
                </p>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {alimentacaoOrdenada.map((reg) => (
                      <div
                        key={reg.id}
                        className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="font-semibold text-gray-900 dark:text-slate-100">
                            {formatDateBR(reg.data)}
                          </span>
                          {podeGerenciarConfinamentos && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditarAlimentacao(reg)}
                                className="text-blue-600 dark:text-blue-400"
                                title="Editar"
                              >
                                <Icons.Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExcluirAlimentacao(reg)}
                                className="text-red-600 dark:text-red-400"
                                title="Excluir"
                              >
                                <Icons.Trash className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">
                              Tipo de dieta
                            </span>
                            <span>{reg.tipoDieta || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">
                              Custo total
                            </span>
                            <span>
                              {reg.custoTotal != null
                                ? `R$ ${reg.custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                : "-"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">
                              Observações
                            </span>
                            <span className="break-words text-right">
                              {reg.observacoes || "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block w-full min-w-0 overflow-auto max-h-[55vh] sm:max-h-none border border-gray-200 dark:border-slate-700 rounded-lg">
                    <table className="min-w-[480px] w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                      <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Data
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Tipo de dieta
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Custo total
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Observações
                          </th>
                          {podeGerenciarConfinamentos && (
                            <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                              Ações
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                        {alimentacaoOrdenada.map((reg) => (
                          <tr key={reg.id}>
                            <td className="px-3 sm:px-4 py-2">
                              {formatDateBR(reg.data)}
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              {reg.tipoDieta || "-"}
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              {reg.custoTotal != null
                                ? `R$ ${reg.custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                : "-"}
                            </td>
                            <td
                              className="px-3 sm:px-4 py-2 max-w-xs truncate"
                              title={reg.observacoes || ""}
                            >
                              {reg.observacoes || "-"}
                            </td>
                            {podeGerenciarConfinamentos && (
                              <td className="px-3 sm:px-4 py-2">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditarAlimentacao(reg)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                    title="Editar"
                                  >
                                    <Icons.Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleExcluirAlimentacao(reg)
                                    }
                                    className="text-red-600 hover:text-red-800 dark:text-red-400"
                                    title="Excluir"
                                  >
                                    <Icons.Trash className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Aba Indicadores */}
          {activeTab === "indicadores" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold">
                  Indicadores do Confinamento
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPdfDetalheBlob(null);
                      setModalPdfDetalheOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    <Icons.FileText className="w-4 h-4" />
                    PDF com pesagens
                  </button>
                  {/*
                  <button
                    type="button"
                    onClick={async () => {
                      const dados = await montarDadosExportacao();
                      if (dados) exportarConfinamentoPDF(dados);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/50"
                  >
                    <Icons.FileText className="w-4 h-4" />
                    Exportar PDF
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const dados = await montarDadosExportacao();
                      if (dados) exportarConfinamentoExcel(dados);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-sm font-medium hover:bg-green-100 dark:hover:bg-green-900/50"
                  >
                    <Icons.FileSpreadsheet className="w-4 h-4" />
                    Exportar Excel
                  </button>
                  */}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-orange-50/70 dark:bg-orange-950/30 p-4 rounded-xl border-l-4 border-orange-500 flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-orange-600 dark:text-orange-400">
                    <Icons.Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-orange-700/80 dark:text-orange-300/80 font-medium">
                      Dias Confinado
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {indicadores.diasConfinamento}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50/70 dark:bg-blue-950/30 p-4 rounded-xl border-l-4 border-blue-500 flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Icons.Cow className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-blue-700/80 dark:text-blue-300/80 font-medium">
                      Total de Animais
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {indicadores.totalAnimais}
                    </p>
                  </div>
                </div>

                <div className="bg-green-50/70 dark:bg-green-950/30 p-4 rounded-xl border-l-4 border-green-500 flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 dark:text-green-400">
                    <Icons.CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-green-700/80 dark:text-green-300/80 font-medium">
                      Animais Ativos
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {indicadores.animaisAtivos}
                    </p>
                  </div>
                </div>
                <div className="bg-amber-50/70 dark:bg-amber-950/30 p-4 rounded-xl border-l-4 border-amber-500 flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Icons.Scale className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-amber-700/80 dark:text-amber-300/80 font-medium">
                      Peso Médio Entrada
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {indicadores.pesoMedioEntrada.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      kg
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-4 rounded-xl border-l-4 border-emerald-500 flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Icons.BarChart className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 font-medium">
                      GMD Médio
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {indicadores.gmdMedio > 0
                        ? `${indicadores.gmdMedio.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg/dia`
                        : "-"}
                    </p>
                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                      Ganho médio diário
                    </p>
                  </div>
                </div>
                <div className="bg-indigo-50/70 dark:bg-indigo-950/30 p-4 rounded-xl border-l-4 border-indigo-500 flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Icons.Clock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-indigo-700/80 dark:text-indigo-300/80 font-medium">
                      Duração média (encerrados)
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {indicadores.diasMedio > 0
                        ? `${Math.round(indicadores.diasMedio)} dias`
                        : "-"}
                    </p>
                    <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">
                      Tempo médio no confinamento
                    </p>
                  </div>
                </div>
                <div className="bg-red-50/70 dark:bg-red-950/30 p-4 rounded-xl border-l-4 border-red-500 flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400">
                    <Icons.AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-red-700/80 dark:text-red-300/80 font-medium">
                      Mortalidade
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {indicadores.mortalidade}
                    </p>
                    <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
                      Saidas por morte
                    </p>
                  </div>
                </div>
                {/* Economia */}
                <div className="bg-slate-50/70 dark:bg-slate-800/70 p-4 rounded-xl border-l-4 border-slate-500 flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                    <Icons.DollarSign className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      Custo total (alimentação)
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {indicadores.custoTotal > 0
                        ? `R$ ${indicadores.custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "-"}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50/70 dark:bg-slate-800/70 p-4 rounded-xl border-l-4 border-slate-500 flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                    <Icons.DollarSign className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      Custo/dia
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {indicadores.custoPorDia != null
                        ? `R$ ${indicadores.custoPorDia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "-"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                      Custo total ÷ dias
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50/70 dark:bg-slate-800/70 p-4 rounded-xl border-l-4 border-slate-500 flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                    <Icons.DollarSign className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      Custo/animal/dia
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {indicadores.custoPorAnimalDia != null
                        ? `R$ ${indicadores.custoPorAnimalDia.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "-"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                      Por animal-dia
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50/70 dark:bg-slate-800/70 p-4 rounded-xl border-l-4 border-slate-500 flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                    <Icons.DollarSign className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                      Custo/kg ganho
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {indicadores.custoPorKgGanho != null
                        ? `R$ ${indicadores.custoPorKgGanho.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "-"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                      Por kg de ganho
                    </p>
                  </div>
                </div>
                {confinamento?.precoVendaKg != null &&
                  confinamento.precoVendaKg > 0 && (
                    <div
                      className={`p-4 rounded-xl border-l-4 flex gap-3 ${(indicadores.margemEstimada ?? 0) >= 0 ? "bg-green-50/70 dark:bg-green-950/30 border-green-500" : "bg-red-50/70 dark:bg-red-950/30 border-red-500"}`}
                    >
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${(indicadores.margemEstimada ?? 0) >= 0 ? "bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400" : "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400"}`}
                      >
                        <Icons.DollarSign className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium ${(indicadores.margemEstimada ?? 0) >= 0 ? "text-green-700/80 dark:text-green-300/80" : "text-red-700/80 dark:text-red-300/80"}`}
                        >
                          Margem estimada
                        </p>
                        <p
                          className={`text-2xl font-bold ${(indicadores.margemEstimada ?? 0) >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
                        >
                          {indicadores.margemEstimada != null
                            ? `R$ ${indicadores.margemEstimada.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "-"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                          (kg ganho × R${" "}
                          {confinamento.precoVendaKg.toLocaleString("pt-BR")}
                          /kg) − custo
                        </p>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Aba Ocorrências (sanidade) */}
          {activeTab === "ocorrencias" && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold">
                  Ocorrências (sanidade)
                </h2>
                {podeGerenciarConfinamentos &&
                  vinculoAnimalConfinamento.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setOcorrenciaPickerOpen(true)}
                        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-white ${getPrimaryButtonClass(primaryColor)}`}
                      >
                        <Icons.Plus className="w-4 h-4" />
                        Nova ocorrência
                      </button>
                      {ocorrenciaPickerOpen && (
                        <div
                          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                          onClick={() => setOcorrenciaPickerOpen(false)}
                        >
                          <div
                            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-4 space-y-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
                              Selecione o animal
                            </p>
                            <div className="max-h-60 overflow-y-auto space-y-1">
                              {vinculoAnimalConfinamento.map((v) => {
                                const animal = animaisMap.get(v.animalId);
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => {
                                      setOcorrenciaVinculoParaNovo(v);
                                      setOcorrenciaPickerOpen(false);
                                      setModalOcorrenciaOpen(true);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-slate-100"
                                  >
                                    {animal?.brinco ?? "N/A"} —{" "}
                                    {animal?.nome || "(sem nome)"}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() => setOcorrenciaPickerOpen(false)}
                              className="w-full py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
              </div>
              {ocorrenciasRaw.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                  Nenhuma ocorrência registrada neste confinamento.
                </p>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {ocorrenciasRaw.map((oc) => {
                      const vinculo = vinculoAnimalConfinamento.find(
                        (v) => v.id === oc.confinamentoAnimalId,
                      );
                      const animal = vinculo
                        ? animaisMap.get(vinculo.animalId)
                        : animaisMap.get(oc.animalId);
                      const tipoLabel = {
                        doenca: "Doença",
                        tratamento: "Tratamento",
                        morte: "Morte",
                        outro: "Outro",
                      }[oc.tipo];
                      return (
                        <div
                          key={oc.id}
                          className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
                        >
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <span className="font-semibold text-gray-900 dark:text-slate-100">
                              {formatDateBR(oc.data)} —{" "}
                              {animal?.brinco ?? "N/A"}
                            </span>
                            {podeGerenciarConfinamentos && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOcorrenciaEditando(oc);
                                  setModalOcorrenciaOpen(true);
                                }}
                                className="text-blue-600 dark:text-blue-400"
                                title="Editar"
                              >
                                <Icons.Edit className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500 dark:text-slate-400">
                                Tipo
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-medium ${oc.tipo === "morte" ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300" : oc.tipo === "doenca" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300" : oc.tipo === "tratamento" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300" : "bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300"}`}
                              >
                                {tipoLabel}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-slate-400">
                                Animal
                              </span>
                              <span>
                                {animal?.nome ? `${animal.nome}` : "-"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-slate-400">
                                Custo
                              </span>
                              <span>
                                {oc.custo != null
                                  ? `R$ ${oc.custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                  : "-"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-slate-400">
                                Observações
                              </span>
                              <span className="break-words text-right">
                                {oc.observacoes || "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden md:block w-full min-w-0 overflow-auto max-h-[55vh] sm:max-h-none border border-gray-200 dark:border-slate-700 rounded-lg">
                    <table className="min-w-[520px] w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                      <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Data
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Animal
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Tipo
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Custo
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Observações
                          </th>
                          {podeGerenciarConfinamentos && (
                            <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                              Ações
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                        {ocorrenciasRaw.map((oc) => {
                          const vinculo = vinculoAnimalConfinamento.find(
                            (v) => v.id === oc.confinamentoAnimalId,
                          );
                          const animal = vinculo
                            ? animaisMap.get(vinculo.animalId)
                            : animaisMap.get(oc.animalId);
                          const tipoLabel = {
                            doenca: "Doença",
                            tratamento: "Tratamento",
                            morte: "Morte",
                            outro: "Outro",
                          }[oc.tipo];
                          return (
                            <tr key={oc.id}>
                              <td className="px-3 sm:px-4 py-2 text-gray-700 dark:text-slate-300">
                                {formatDateBR(oc.data)}
                              </td>
                              <td className="px-3 sm:px-4 py-2">
                                {animal?.brinco ?? "N/A"}{" "}
                                {animal?.nome ? `— ${animal.nome}` : ""}
                              </td>
                              <td className="px-3 sm:px-4 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    oc.tipo === "morte"
                                      ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                      : oc.tipo === "doenca"
                                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                                        : oc.tipo === "tratamento"
                                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                                          : "bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300"
                                  }`}
                                >
                                  {tipoLabel}
                                </span>
                              </td>
                              <td className="px-3 sm:px-4 py-2">
                                {oc.custo != null
                                  ? `R$ ${oc.custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                  : "-"}
                              </td>
                              <td className="px-3 sm:px-4 py-2 text-gray-600 dark:text-slate-400 max-w-xs truncate">
                                {oc.observacoes || "-"}
                              </td>
                              {podeGerenciarConfinamentos && (
                                <td className="px-3 sm:px-4 py-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOcorrenciaEditando(oc);
                                      setModalOcorrenciaOpen(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                    title="Editar"
                                  >
                                    <Icons.Edit className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Aba Histórico */}
          {activeTab === "historico" && (
            <div>
              <h2 className="text-lg font-semibold mb-4">
                Histórico de alterações
              </h2>
              {historicoRaw.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                  Nenhum registro de alteração ainda para este confinamento.
                </p>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {historicoRaw.map((audit) => (
                      <div
                        key={audit.id}
                        className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
                      >
                        <div className="font-semibold text-gray-900 dark:text-slate-100 mb-2">
                          {formatDateBR(audit.timestamp.split("T")[0])}{" "}
                          {audit.timestamp.split("T")[1]?.slice(0, 5)}
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">
                              Usuário
                            </span>
                            <span>{audit.userNome || "-"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">
                              Contexto
                            </span>
                            <span>
                              {audit.entity === "confinamento"
                                ? "Confinamento"
                                : audit.entity === "confinamentoAnimal"
                                  ? "Animal no confinamento"
                                  : audit.entity === "ocorrenciaAnimal"
                                    ? "Ocorrência"
                                    : audit.entity}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-slate-400">
                              Ação
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-700">
                              {audit.action === "create"
                                ? "Criação"
                                : audit.action === "update"
                                  ? "Edição"
                                  : audit.action === "delete"
                                    ? "Exclusão"
                                    : audit.action}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block w-full min-w-0 overflow-auto max-h-[55vh] sm:max-h-none border border-gray-200 dark:border-slate-700 rounded-lg">
                    <table className="min-w-[480px] w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                      <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Data/Hora
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Usuário
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Contexto
                          </th>
                          <th className="px-3 sm:px-4 py-2 text-left whitespace-nowrap">
                            Ação
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                        {historicoRaw.map((audit) => (
                          <tr key={audit.id}>
                            <td className="px-3 sm:px-4 py-2 text-gray-600 dark:text-slate-400">
                              {formatDateBR(audit.timestamp.split("T")[0])}{" "}
                              {audit.timestamp.split("T")[1]?.slice(0, 5)}
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              {audit.userNome || "-"}
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              {audit.entity === "confinamento"
                                ? "Confinamento"
                                : audit.entity === "confinamentoAnimal"
                                  ? "Animal no confinamento"
                                  : audit.entity === "ocorrenciaAnimal"
                                    ? "Ocorrência"
                                    : audit.entity}
                            </td>
                            <td className="px-3 sm:px-4 py-2">
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-700">
                                {audit.action === "create"
                                  ? "Criação"
                                  : audit.action === "update"
                                    ? "Edição"
                                    : audit.action === "delete"
                                      ? "Exclusão"
                                      : audit.action}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      <ConfinamentoModal
        open={modalConfinamentoOpen}
        mode="edit"
        initialData={confinamento}
        onClose={() => setModalConfinamentoOpen(false)}
        onSaved={() => {
          setModalConfinamentoOpen(false);
        }}
      />

      <ConfinamentoAnimalModal
        open={modalAnimalOpen}
        mode={vinculoEditando ? "edit" : "create"}
        confinamentoId={confinamentoId}
        initialData={vinculoEditando}
        onClose={() => {
          setModalAnimalOpen(false);
          setVinculoEditando(null);
        }}
        onSaved={() => {
          setModalAnimalOpen(false);
          setVinculoEditando(null);
        }}
      />

      <ConfinamentoAlimentacaoModal
        open={modalAlimentacaoOpen}
        mode={alimentacaoEditando ? "edit" : "create"}
        confinamentoId={confinamentoId!}
        initialData={alimentacaoEditando}
        onClose={() => {
          setModalAlimentacaoOpen(false);
          setAlimentacaoEditando(null);
        }}
        onSaved={() => {
          setModalAlimentacaoOpen(false);
          setAlimentacaoEditando(null);
        }}
      />

      <ConfinamentoPesagemModal
        open={modalPesagemOpen}
        confinamentoId={confinamentoId!}
        vinculosAtivos={vinculosAtivos}
        animaisMap={animaisMap}
        dataInicioConfinamento={confinamento?.dataInicio}
        onClose={() => setModalPesagemOpen(false)}
        onSaved={() => setModalPesagemOpen(false)}
      />

      {/* Modal: Ordenação do PDF com pesagens → Visualizar na tela ou baixar */}
      {modalPdfDetalheOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div
            className={`bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-600 flex flex-col ${
              pdfDetalheBlob
                ? "w-full max-w-[96vw] h-[95vh]"
                : "max-w-md w-full p-5"
            }`}
          >
            {pdfDetalheBlob ? (
              <PdfViewer
                file={pdfDetalheBlob}
                title={`Confinamento: ${confinamento?.nome ?? ""} — PDF com pesagens`}
                downloadFileName={`confinamento-detalhe-${(confinamento?.nome ?? "relatorio").replace(/\s+/g, "-").slice(0, 30)}-${new Date().toISOString().slice(0, 10)}.pdf`}
                onClose={() => {
                  setPdfDetalheBlob(null);
                  setModalPdfDetalheOpen(false);
                }}
                showDownload={true}
                className="flex-1 min-h-0"
              />
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3">
                  Ordenar relatório PDF
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                  Escolha a ordem dos animais no relatório e visualize o PDF na
                  tela.
                </p>
                <div className="space-y-2 mb-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pdfOrdenar"
                      checked={pdfDetalheOrdenarPor === "brinco_az"}
                      onChange={() => setPdfDetalheOrdenarPor("brinco_az")}
                      className="rounded"
                    />
                    <span className="text-sm">Brinco (A → Z)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pdfOrdenar"
                      checked={pdfDetalheOrdenarPor === "brinco_za"}
                      onChange={() => setPdfDetalheOrdenarPor("brinco_za")}
                      className="rounded"
                    />
                    <span className="text-sm">Brinco (Z → A)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pdfOrdenar"
                      checked={
                        pdfDetalheOrdenarPor === "ultima_pesagem_peso_maior"
                      }
                      onChange={() =>
                        setPdfDetalheOrdenarPor("ultima_pesagem_peso_maior")
                      }
                      className="rounded"
                    />
                    <span className="text-sm">
                      Última pesagem — maior peso primeiro
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pdfOrdenar"
                      checked={
                        pdfDetalheOrdenarPor === "ultima_pesagem_peso_menor"
                      }
                      onChange={() =>
                        setPdfDetalheOrdenarPor("ultima_pesagem_peso_menor")
                      }
                      className="rounded"
                    />
                    <span className="text-sm">
                      Última pesagem — menor peso primeiro
                    </span>
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalPdfDetalheOpen(false)}
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const dados = await montarDadosDetalhePDF();
                      if (!dados) {
                        setModalPdfDetalheOpen(false);
                        return;
                      }
                      let animais = [...dados.animais];
                      if (pdfDetalheOrdenarPor === "brinco_az") {
                        animais.sort((a, b) => {
                          const na = Number(a.brinco);
                          const nb = Number(b.brinco);
                          if (Number.isFinite(na) && Number.isFinite(nb))
                            return na - nb;
                          return (a.brinco || "").localeCompare(
                            b.brinco || "",
                            "pt-BR",
                          );
                        });
                      } else if (pdfDetalheOrdenarPor === "brinco_za") {
                        animais.sort((a, b) => {
                          const na = Number(a.brinco);
                          const nb = Number(b.brinco);
                          if (Number.isFinite(na) && Number.isFinite(nb))
                            return nb - na;
                          return (b.brinco || "").localeCompare(
                            a.brinco || "",
                            "pt-BR",
                          );
                        });
                      } else if (
                        pdfDetalheOrdenarPor === "ultima_pesagem_peso_maior"
                      ) {
                        animais.sort((a, b) => {
                          const pa = a.pesagens.length
                            ? a.pesagens[a.pesagens.length - 1].peso
                            : 0;
                          const pb = b.pesagens.length
                            ? b.pesagens[b.pesagens.length - 1].peso
                            : 0;
                          return pb - pa;
                        });
                      } else {
                        animais.sort((a, b) => {
                          const pa = a.pesagens.length
                            ? a.pesagens[a.pesagens.length - 1].peso
                            : 0;
                          const pb = b.pesagens.length
                            ? b.pesagens[b.pesagens.length - 1].peso
                            : 0;
                          return pa - pb;
                        });
                      }
                      const payload: DadosConfinamentoDetalhePDF = {
                        ...dados,
                        animais,
                        indicadores: indicadores
                          ? {
                              totalAnimais: indicadores.totalAnimais,
                              animaisAtivos: indicadores.animaisAtivos,
                              pesoMedioEntrada: indicadores.pesoMedioEntrada,
                              pesoMedioSaida: indicadores.pesoMedioSaida,
                              gmdMedio: indicadores.gmdMedio,
                              diasMedio: indicadores.diasMedio,
                              diasConfinamento: indicadores.diasConfinamento,
                              custoTotal: indicadores.custoTotal,
                              custoPorDia: indicadores.custoPorDia,
                              custoPorAnimalDia: indicadores.custoPorAnimalDia,
                              custoPorKgGanho: indicadores.custoPorKgGanho,
                              margemEstimada: indicadores.margemEstimada,
                            }
                          : undefined,
                      };
                      const blob = exportarConfinamentoDetalhePDF(
                        payload,
                        true as const,
                      );
                      if (blob) setPdfDetalheBlob(blob);
                    }}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${getPrimaryButtonClass(primaryColor)}`}
                  >
                    Visualizar na tela
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!vinculoAEncerrar}
        title="Encerrar animal no confinamento"
        message={
          vinculoAEncerrar
            ? `Deseja realmente encerrar o animal ${animaisMap.get(vinculoAEncerrar.animalId)?.brinco ?? "este"} no confinamento? O vinculo será marcado como encerrado com a data de hoje.`
            : ""
        }
        variant="warning"
        confirmText="Encerrar"
        cancelText="Cancelar"
        onConfirm={confirmarEncerrarVinculo}
        onCancel={() => setVinculoAEncerrar(null)}
      />

      <ConfirmDialog
        open={!!alimentacaoAExcluir}
        title="Excluir registro de alimentação"
        message={
          alimentacaoAExcluir
            ? `Deseja realmente excluir o registro de ${formatDateBR(alimentacaoAExcluir.data)}?`
            : ""
        }
        variant="danger"
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={confirmarExcluirAlimentacao}
        onCancel={() => setAlimentacaoAExcluir(null)}
      />

      <OcorrenciaAnimalModal
        open={modalOcorrenciaOpen}
        mode={ocorrenciaEditando ? "edit" : "create"}
        animalId={
          ocorrenciaEditando?.animalId ??
          ocorrenciaVinculoParaNovo?.animalId ??
          ""
        }
        confinamentoAnimalId={
          ocorrenciaEditando?.confinamentoAnimalId ??
          ocorrenciaVinculoParaNovo?.id
        }
        initialData={ocorrenciaEditando ?? undefined}
        onClose={() => {
          setModalOcorrenciaOpen(false);
          setOcorrenciaEditando(null);
          setOcorrenciaVinculoParaNovo(null);
        }}
        onSaved={() => {
          setModalOcorrenciaOpen(false);
          setOcorrenciaEditando(null);
          setOcorrenciaVinculoParaNovo(null);
        }}
      />
    </div>
  );
}
