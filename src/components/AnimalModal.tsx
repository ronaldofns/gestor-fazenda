import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useForm, Controller, FieldErrors } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexieDB";
import {
  Animal,
  TipoAnimal,
  StatusAnimal,
  Origem,
  Fazenda,
  Raca,
  Pesagem,
  Vacina,
  Desmama,
} from "../db/models";
import { uuid } from "../utils/uuid";
import { showToast } from "../utils/toast";
import { Icons } from "../utils/iconMapping";
import { useAppSettings } from "../hooks/useAppSettings";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import { ColorPaletteKey } from "../hooks/useThemeColors";
import { getPrimaryButtonClass, getThemeClasses, getPrimaryActionButtonLightClass } from "../utils/themeHelpers";
import { registrarAudit } from "../utils/audit";
import { recalculateTagUsage } from "../utils/fixTagUsageCount";
import {
  encerrarVinculoPorStatusAnimal,
  calcularGMDParcial,
} from "../utils/confinamentoRules";
import { validarBrincoUnico } from "../utils/unicidadeValidation";
import Modal from "./Modal";
import Combobox, { ComboboxOption } from "./Combobox";
import AnimalSearchCombobox from "./AnimalSearchCombobox";
import MatrizSearchCombobox from "./MatrizSearchCombobox";
import TipoAnimalModal from "./TipoAnimalModal";
import StatusAnimalModal from "./StatusAnimalModal";
import ModalRaca from "./ModalRaca";
import TagSelector from "./TagSelector";
import Input from "./Input";
import Textarea from "./Textarea";
import PesagemModal from "./PesagemModal";
import VacinaModal from "./VacinaModal";
import DesmamaModal from "./DesmamaModal";
import {
  normalizarDataInput,
  converterDataParaFormatoInput,
  converterDataParaFormatoBanco,
} from "../utils/dateInput";
import { msg } from "../utils/validationMessages";
import { calcularGMD, calcularGMDAcumulado } from "../utils/calcularGMD";
import { formatDateBR } from "../utils/date";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

/** Converte string de data (YYYY-MM-DD ou DD/MM/YYYY) para Date, usado na aba Pesagens. */
function parseDatePesagem(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/").map(Number);
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  const parsed = new Date(dateStr);
  return !isNaN(parsed.getTime()) ? parsed : null;
}

// Helper para validar números opcionais (aceita número, string vazia ou undefined)
const numeroOpcional = z.preprocess((val) => {
  // Se for vazio, null ou undefined, retorna undefined
  if (val === "" || val === null || val === undefined) {
    return undefined;
  }
  // Se já for número, retorna como está (ou undefined se NaN)
  if (typeof val === "number") {
    return isNaN(val) ? undefined : val;
  }
  // Se for string, tenta converter
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return undefined;
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? undefined : parsed;
  }
  // Qualquer outro tipo, retorna undefined
  return undefined;
}, z.number().optional());

// Função para criar schema com validação de brinco único por fazenda
const createSchemaAnimal = (
  mode: "create" | "edit",
  animalIdExcluir?: string,
) => {
  return z
    .object({
      brinco: z.string().min(1, msg.obrigatorio),
      nome: z.string().optional(),
      tipoId: z.string().min(1, msg.selecione),
      tipoMatrizId: z.string().optional(), // Será salvo na Genealogia
      racaId: z.string().optional(),
      sexo: z.enum(["M", "F"], { required_error: msg.selecione }),
      statusId: z.string().min(1, msg.selecione),
      dataNascimento: z
        .string()
        .min(1, msg.dataObrigatoria)
        .regex(/^\d{2}\/\d{2}\/\d{4}$/, msg.formatoData),
      dataCadastro: z.string().optional(),
      dataEntrada: z.string().optional(),
      dataSaida: z.string().optional(),
      origemId: z.string().min(1, msg.selecione),
      fazendaId: z.string().min(1, msg.selecione),
      fazendaOrigemId: z.string().optional(),
      proprietarioAnterior: z.string().optional(),
      matrizId: z.string().optional(),
      reprodutorId: z.string().optional(),
      valorCompra: numeroOpcional,
      valorVenda: numeroOpcional,
      pelagem: z.string().optional(),
      pesoAtual: numeroOpcional,
      lote: z.string().optional(),
      obs: z.string().optional(),
    })
    .refine(
      async (data) => {
        // Validar brinco único por fazenda
        if (!data.brinco || !data.fazendaId) {
          return true; // Deixa outras validações tratarem campos obrigatórios
        }

        const brincoTrimmed = data.brinco.trim();
        if (!brincoTrimmed) {
          return true; // Deixa validação de obrigatório tratar
        }

        // Buscar animais com mesmo brinco na mesma fazenda
        const animaisExistentes = await db.animais
          .where("[fazendaId+brinco]")
          .equals([data.fazendaId, brincoTrimmed])
          .and((animal) => !animal.deletedAt)
          .toArray();

        // Se estiver editando, excluir o próprio animal da verificação
        const animaisConflito = animalIdExcluir
          ? animaisExistentes.filter((a) => a.id !== animalIdExcluir)
          : animaisExistentes;

        return animaisConflito.length === 0;
      },
      {
        message: "Já existe um animal com este brinco nesta fazenda",
        path: ["brinco"],
      },
    );
};

// Schema padrão (será sobrescrito no componente)
const schemaAnimal = z.object({
  brinco: z.string().min(1, msg.obrigatorio),
  nome: z.string().optional(),
  tipoId: z.string().min(1, msg.selecione),
  tipoMatrizId: z.string().optional(),
  racaId: z.string().optional(),
  sexo: z.enum(["M", "F"], { required_error: msg.selecione }),
  statusId: z.string().min(1, msg.selecione),
  dataNascimento: z
    .string()
    .min(1, msg.dataObrigatoria)
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, msg.formatoData),
  dataCadastro: z.string().optional(),
  dataEntrada: z.string().optional(),
  dataSaida: z.string().optional(),
  origemId: z.string().min(1, msg.selecione),
  fazendaId: z.string().min(1, msg.selecione),
  fazendaOrigemId: z.string().optional(),
  proprietarioAnterior: z.string().optional(),
  matrizId: z.string().optional(),
  reprodutorId: z.string().optional(),
  valorCompra: numeroOpcional,
  valorVenda: numeroOpcional,
  pelagem: z.string().optional(),
  pesoAtual: numeroOpcional,
  lote: z.string().optional(),
  obs: z.string().optional(),
});

type FormDataAnimal = z.infer<typeof schemaAnimal>;

interface AnimalModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialData?: Animal | null;
  onClose: () => void;
  onSaved?: () => void;
}

type TabType =
  | "identificacao"
  | "classificacao"
  | "datas"
  | "origem"
  | "genealogia"
  | "financeiro"
  | "desmama"
  | "pesagens"
  | "vacinacoes"
  | "tags";

// Mapeamento de campos para abas (para validação)
const campoParaAba: Record<string, TabType> = {
  brinco: "identificacao",
  nome: "identificacao",
  lote: "identificacao",
  tipoId: "classificacao",
  statusId: "classificacao",
  sexo: "classificacao",
  racaId: "classificacao",
  pelagem: "classificacao",
  dataNascimento: "datas",
  dataCadastro: "datas",
  dataEntrada: "datas",
  dataSaida: "datas",
  origemId: "origem",
  fazendaId: "origem",
  fazendaOrigemId: "origem",
  proprietarioAnterior: "origem",
  matrizId: "genealogia",
  tipoMatrizId: "genealogia",
  reprodutorId: "genealogia",
  valorCompra: "financeiro",
  valorVenda: "financeiro",
  pesoAtual: "financeiro",
  obs: "tags",
};

export default function AnimalModal({
  open,
  mode,
  initialData,
  onClose,
  onSaved,
}: AnimalModalProps) {
  const { appSettings } = useAppSettings();
  const { user } = useAuth();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;
  const [saving, setSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("identificacao");

  // Estado interno para controlar o modo quando o animal é criado
  const [internalMode, setInternalMode] = useState<"create" | "edit">(mode);
  const [internalInitialData, setInternalInitialData] = useState<
    Animal | null | undefined
  >(initialData);

  // Sincronizar com props quando mudarem (mas não sobrescrever se já estiver em modo edit após criar)
  useEffect(() => {
    // Se o modal foi fechado e reaberto, resetar os estados internos
    if (!open) {
      setInternalMode(mode);
      setInternalInitialData(initialData);
      return;
    }

    // Se mudou de create para edit via props, atualizar
    if (mode === "edit" && initialData && internalMode === "create") {
      setInternalMode(mode);
      setInternalInitialData(initialData);
    } else if (
      mode !== internalMode &&
      !(internalMode === "edit" && mode === "create")
    ) {
      // Só atualizar se não estiver em modo edit interno (após criar)
      setInternalMode(mode);
      setInternalInitialData(initialData);
    }
  }, [mode, initialData, open]);

  // Modais de cadastro rápido
  const [tipoModalOpen, setTipoModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  // Modais de pesagem, vacinação e desmama
  const [pesagemModalOpen, setPesagemModalOpen] = useState(false);
  const [vacinaModalOpen, setVacinaModalOpen] = useState(false);
  const [desmamaModalOpen, setDesmamaModalOpen] = useState(false);
  const [pesagemEditando, setPesagemEditando] = useState<Pesagem | null>(null);
  const [vacinaEditando, setVacinaEditando] = useState<Vacina | null>(null);
  const [desmamaEditando, setDesmamaEditando] = useState<Desmama | null>(null);

  // Estado para brinco temporário
  const [brincoTemporario, setBrincoTemporario] = useState(false);
  const [brincoTemporarioGerado, setBrincoTemporarioGerado] = useState<
    string | null
  >(null);

  // Refs para focar campos
  const campoRefs = useRef<Record<string, HTMLElement | null>>({});

  // Ref para evitar múltiplas reaplicações de valores
  const valoresReaplicadosRef = useRef<string | null>(null);

  // 🚀 OTIMIZAÇÃO CRÍTICA: Carregar dados apenas uma vez quando modal abre
  // Usar useState + useEffect ao invés de useLiveQuery para evitar queries reativas constantes
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [racas, setRacas] = useState<Raca[]>([]);
  const [tipos, setTipos] = useState<TipoAnimal[]>([]);
  const [status, setStatus] = useState<StatusAnimal[]>([]);
  const [origens, setOrigens] = useState<Origem[]>([]);
  const [modalRacaOpen, setModalRacaOpen] = useState(false);

  const { hasPermission } = usePermissions();
  const podeGerenciarRacas = hasPermission("gerenciar_racas");
  const podeGerenciarTipos = hasPermission("gerenciar_tipos_animais");
  const podeGerenciarStatus = hasPermission("gerenciar_status_animais");

  // Criar schema dinâmico com validação de brinco único por fazenda
  const schemaAnimalDinamico = useMemo(() => {
    return createSchemaAnimal(internalMode, internalInitialData?.id);
  }, [internalMode, internalInitialData?.id]);

  const refetchRacas = useCallback(() => {
    db.racas.toArray().then(setRacas);
  }, []);

  // Carregar dados apenas quando modal abrir
  useEffect(() => {
    if (!open) {
      // Limpar dados quando fechar para liberar memória
      setFazendas([]);
      setRacas([]);
      setTipos([]);
      setStatus([]);
      setOrigens([]);
      return;
    }

    // Carregar dados uma única vez
    Promise.all([
      db.fazendas.toArray(),
      db.racas.toArray(),
      db.tiposAnimal.filter((t) => t.ativo && !t.deletedAt).toArray(),
      db.statusAnimal.filter((s) => s.ativo && !s.deletedAt).toArray(),
      db.origens.filter((o) => o.ativo && !o.deletedAt).toArray(),
    ])
      .then(([faz, rac, tip, sta, orig]) => {
        setFazendas(faz);
        setRacas(rac);
        setTipos(tip);
        setStatus(sta);
        setOrigens(orig);
      })
      .catch((err) => {
        console.error("Erro ao carregar dados do modal:", err);
      });
  }, [open]);

  // 🚀 OTIMIZAÇÃO: Não carregar todos os animais aqui!
  // AnimalSearchCombobox faz busca assíncrona apenas quando necessário

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    setValue,
    watch,
    getValues,
  } = useForm<FormDataAnimal>({
    resolver: zodResolver(schemaAnimalDinamico),
    defaultValues: {
      brinco: "",
      nome: "",
      tipoId: "",
      tipoMatrizId: "",
      racaId: "",
      sexo: "M",
      statusId: "",
      dataNascimento: "",
      dataCadastro: "",
      dataEntrada: "",
      dataSaida: "",
      origemId: "",
      fazendaId: "",
      fazendaOrigemId: "",
      proprietarioAnterior: "",
      matrizId: "",
      reprodutorId: "",
      valorCompra: undefined,
      valorVenda: undefined,
      pelagem: "",
      pesoAtual: undefined,
      lote: "",
      obs: "",
    },
  });

  // Buscar pesagens e vacinações do animal (apenas em modo edição)
  const animalId =
    internalMode === "edit" && internalInitialData
      ? internalInitialData.id
      : null;

  // Genérico em useLiveQuery evita incompatibilidade PromiseExtended (Dexie) vs Promise
  const pesagens =
    useLiveQuery<Pesagem[]>(
      () =>
        !open || !animalId
          ? Promise.resolve([])
          : Promise.resolve(db.pesagens.filter((p) => p.animalId === animalId).toArray()),
      [animalId, open],
    ) ?? [];

  const vacinacoes =
    useLiveQuery<Vacina[]>(
      () =>
        !open || !animalId
          ? Promise.resolve([])
          : Promise.resolve(db.vacinacoes.filter((v) => v.animalId === animalId).toArray()),
      [animalId, open],
    ) ?? [];

  const desmamas =
    useLiveQuery<Desmama[]>(
      () =>
        !open || !animalId
          ? Promise.resolve([])
          : Promise.resolve(db.desmamas.filter((d) => d.animalId === animalId).toArray()),
      [animalId, open],
    ) ?? [];

  // Confinamento ativo do animal (no máximo um)
  const confinamentoAtivo = useLiveQuery(async () => {
    if (!open || !animalId) return null;
    const vinculos = await db.confinamentoAnimais
      .where("animalId")
      .equals(animalId)
      .and((v) => v.dataSaida == null && v.deletedAt == null)
      .toArray();
    const vinculo = vinculos[0] ?? null;
    if (!vinculo) return null;
    const confinamento = await db.confinamentos.get(vinculo.confinamentoId);
    if (!confinamento || confinamento.deletedAt) return null;
    const pesagensConf = await db.pesagens
      .where("animalId")
      .equals(animalId)
      .and((p) => p.deletedAt == null)
      .toArray();
    const ultimaPesagem =
      pesagensConf.length > 0
        ? pesagensConf.sort(
            (a, b) =>
              new Date(b.dataPesagem).getTime() -
              new Date(a.dataPesagem).getTime(),
          )[0]
        : null;
    const animal = await db.animais.get(animalId);
    const pesoAtual = ultimaPesagem?.peso ?? animal?.pesoAtual;
    const gmdParcial =
      pesoAtual != null
        ? calcularGMDParcial(
            vinculo.pesoEntrada,
            pesoAtual,
            vinculo.dataEntrada,
          )
        : { gmd: null, dias: 0 };
    return {
      confinamento,
      vinculo,
      gmdParcial,
      pesoAtual: pesoAtual ?? null,
    };
  }, [animalId, open]);

  // Função para identificar qual aba tem erro e focar no campo
  const focarAbaComErro = (errors: FieldErrors<FormDataAnimal>) => {
    const camposComErro = Object.keys(errors);
    if (camposComErro.length === 0) return;

    // Encontrar a primeira aba com erro
    for (const campo of camposComErro) {
      const aba = campoParaAba[campo];
      if (aba) {
        setActiveTab(aba);
        // Focar no campo após um pequeno delay para garantir que a aba foi renderizada
        setTimeout(() => {
          const elemento =
            campoRefs.current[campo] ||
            document.querySelector(`[name="${campo}"]`);
          if (elemento) {
            elemento.scrollIntoView({ behavior: "smooth", block: "center" });
            if (elemento instanceof HTMLElement && "focus" in elemento) {
              (elemento as HTMLElement).focus();
            }
          }
        }, 100);
        break;
      }
    }
  };

  // Watch para TODOS os campos para garantir atualização completa
  // Campos de texto simples
  const brincoWatch = watch("brinco");
  const nomeWatch = watch("nome");
  const loteWatch = watch("lote");
  const obsWatch = watch("obs");
  const pelagemWatch = watch("pelagem");
  const proprietarioAnteriorWatch = watch("proprietarioAnterior");

  // Campos de seleção (Combobox)
  const tipoIdWatch = watch("tipoId");
  const statusIdWatch = watch("statusId");
  const sexoWatch = watch("sexo");
  const racaIdWatch = watch("racaId");
  const origemIdWatch = watch("origemId");
  const fazendaIdWatch = watch("fazendaId");
  const fazendaOrigemIdWatch = watch("fazendaOrigemId");
  const matrizIdWatch = watch("matrizId");
  const tipoMatrizIdWatch = watch("tipoMatrizId");
  const reprodutorIdWatch = watch("reprodutorId");

  // Campos de data
  const dataNascimentoWatch = watch("dataNascimento");
  const dataCadastroWatch = watch("dataCadastro");
  const dataEntradaWatch = watch("dataEntrada");
  const dataSaidaWatch = watch("dataSaida");

  // Campos numéricos
  const valorCompraWatch = watch("valorCompra");
  const valorVendaWatch = watch("valorVenda");
  const pesoAtualWatch = watch("pesoAtual");

  // 🚀 OTIMIZAÇÃO: Options para comboboxes (processar apenas quando necessário)
  const tipoOptions: ComboboxOption[] = useMemo(() => {
    if (!open || tipos.length === 0) return [];
    // Limitar processamento - tipos geralmente são poucos (< 20)
    return tipos
      .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
      .map((t) => ({ label: t.nome, value: t.id }));
  }, [tipos, open]);

  const statusOptions: ComboboxOption[] = useMemo(() => {
    if (!open || status.length === 0) return [];
    return status
      .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
      .map((s) => ({ label: s.nome, value: s.id }));
  }, [status, open]);

  const origemOptions: ComboboxOption[] = useMemo(() => {
    if (!open || origens.length === 0) return [];
    return origens
      .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
      .map((o) => ({ label: o.nome, value: o.id }));
  }, [origens, open]);

  const fazendaOptions: ComboboxOption[] = useMemo(() => {
    if (!open || fazendas.length === 0) return [];
    return fazendas
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
      .map((f) => ({ label: f.nome, value: f.id }));
  }, [fazendas, open]);

  const racaOptions: ComboboxOption[] = useMemo(() => {
    if (!open) return [{ label: "Nenhuma", value: "" }];
    return [
      { label: "Nenhuma", value: "" },
      ...racas
        .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
        .map((r) => ({ label: r.nome, value: r.id })),
    ];
  }, [racas, open]);

  // 🚀 OTIMIZAÇÃO: Limitar animais para genealogia (apenas 100 mais recentes)
  // 🚀 REMOVIDO: animalOptions não é mais necessário
  // AnimalSearchCombobox faz busca assíncrona, não precisa carregar todos os animais

  // Reaplicar valores quando as opções estiverem disponíveis (para garantir que os Combobox encontrem os valores)
  useEffect(() => {
    // Resetar flag quando modal fecha ou muda de animal
    if (!open || !initialData?.id) {
      valoresReaplicadosRef.current = null;
      return;
    }

    // Verificar se já reaplicamos para este animal
    if (valoresReaplicadosRef.current === initialData.id) {
      return; // Já reaplicamos, não fazer novamente
    }

    if (
      mode === "edit" &&
      initialData &&
      tipos.length > 0 &&
      status.length > 0 &&
      origens.length > 0 &&
      fazendas.length > 0
    ) {
      // Aguardar um pouco para garantir que as opções foram carregadas e renderizadas
      const timeoutId = setTimeout(() => {
        const currentValues = getValues();

        // Preparar valores do formulário novamente
        const valoresFormulario = {
          brinco: initialData.brinco || "",
          nome: initialData.nome || "",
          tipoId: initialData.tipoId,
          tipoMatrizId: "",
          racaId: initialData.racaId || "",
          sexo: initialData.sexo,
          statusId: initialData.statusId,
          dataNascimento: converterDataParaFormatoInput(
            initialData.dataNascimento,
          ),
          dataCadastro: initialData.dataCadastro
            ? converterDataParaFormatoInput(initialData.dataCadastro)
            : "",
          dataEntrada: initialData.dataEntrada
            ? converterDataParaFormatoInput(initialData.dataEntrada)
            : "",
          dataSaida: initialData.dataSaida
            ? converterDataParaFormatoInput(initialData.dataSaida)
            : "",
          origemId: initialData.origemId,
          fazendaId: initialData.fazendaId,
          fazendaOrigemId: initialData.fazendaOrigemId || "",
          proprietarioAnterior: initialData.proprietarioAnterior || "",
          matrizId: initialData.matrizId || "",
          reprodutorId: initialData.reprodutorId || "",
          valorCompra: initialData.valorCompra,
          valorVenda: initialData.valorVenda,
          pelagem: initialData.pelagem || "",
          pesoAtual: initialData.pesoAtual,
          lote: initialData.lote || "",
          obs: initialData.obs || "",
        };

        // Reaplicar TODOS os valores para garantir que os Combobox encontrem os valores nas opções
        Object.entries(valoresFormulario).forEach(([key, value]) => {
          const fieldKey = key as keyof FormDataAnimal;
          const currentValue = currentValues[fieldKey];

          // Campos numéricos opcionais - aplicar mesmo se undefined
          if (
            key === "valorCompra" ||
            key === "valorVenda" ||
            key === "pesoAtual"
          ) {
            if (currentValue !== value) {
              setValue(fieldKey, value as any, {
                shouldValidate: false,
                shouldDirty: false,
              });
            }
          }
          // Campos de string - aplicar mesmo se vazio
          else if (typeof value === "string") {
            if (currentValue !== value) {
              setValue(fieldKey, value as any, {
                shouldValidate: false,
                shouldDirty: false,
              });
            }
          }
          // Outros campos
          else if (
            value !== undefined &&
            value !== null &&
            currentValue !== value
          ) {
            setValue(fieldKey, value as any, {
              shouldValidate: false,
              shouldDirty: false,
            });
          }
        });

        // Garantir que campos específicos sejam aplicados explicitamente
        if (currentValues.brinco !== valoresFormulario.brinco) {
          setValue("brinco", valoresFormulario.brinco, {
            shouldValidate: false,
            shouldDirty: false,
          });
        }
        if (currentValues.nome !== valoresFormulario.nome) {
          setValue("nome", valoresFormulario.nome, {
            shouldValidate: false,
            shouldDirty: false,
          });
        }
        if (currentValues.lote !== valoresFormulario.lote) {
          setValue("lote", valoresFormulario.lote, {
            shouldValidate: false,
            shouldDirty: false,
          });
        }
        if (currentValues.obs !== valoresFormulario.obs) {
          setValue("obs", valoresFormulario.obs, {
            shouldValidate: false,
            shouldDirty: false,
          });
        }
        if (currentValues.valorCompra !== valoresFormulario.valorCompra) {
          setValue("valorCompra", valoresFormulario.valorCompra, {
            shouldValidate: false,
            shouldDirty: false,
          });
        }
        if (currentValues.valorVenda !== valoresFormulario.valorVenda) {
          setValue("valorVenda", valoresFormulario.valorVenda, {
            shouldValidate: false,
            shouldDirty: false,
          });
        }
        if (currentValues.pesoAtual !== valoresFormulario.pesoAtual) {
          setValue("pesoAtual", valoresFormulario.pesoAtual, {
            shouldValidate: false,
            shouldDirty: false,
          });
        }

        // Reaplicar também tipoMatrizId e reprodutorId da genealogia (apenas uma vez)
        if (initialData?.id) {
          db.genealogias
            .where("animalId")
            .equals(initialData.id)
            .first()
            .then((genealogia) => {
              if (genealogia) {
                // tipoMatrizId vem da genealogia
                if (
                  genealogia.tipoMatrizId &&
                  getValues("tipoMatrizId") !== genealogia.tipoMatrizId
                ) {
                  setValue("tipoMatrizId", genealogia.tipoMatrizId, {
                    shouldValidate: false,
                    shouldDirty: false,
                  });
                }
                // reprodutorId pode vir da genealogia ou do initialData
                const reprodutorIdFinal =
                  genealogia.reprodutorId || initialData.reprodutorId || "";
                if (
                  reprodutorIdFinal &&
                  getValues("reprodutorId") !== reprodutorIdFinal
                ) {
                  setValue("reprodutorId", reprodutorIdFinal, {
                    shouldValidate: false,
                    shouldDirty: false,
                  });
                }
              } else {
                // Se não há genealogia, usar valores do initialData
                if (
                  initialData.reprodutorId &&
                  getValues("reprodutorId") !== initialData.reprodutorId
                ) {
                  setValue("reprodutorId", initialData.reprodutorId, {
                    shouldValidate: false,
                    shouldDirty: false,
                  });
                }
              }
            })
            .catch(() => {
              // Em caso de erro, usar valores do initialData
              if (
                initialData.reprodutorId &&
                getValues("reprodutorId") !== initialData.reprodutorId
              ) {
                setValue("reprodutorId", initialData.reprodutorId, {
                  shouldValidate: false,
                  shouldDirty: false,
                });
              }
            });
        }

        // Marcar que já reaplicamos para este animal
        valoresReaplicadosRef.current = initialData.id;
        console.log("✅ Valores reaplicados quando opções disponíveis");
      }, 500); // Aumentar delay para garantir que os Combobox foram renderizados

      return () => clearTimeout(timeoutId);
    }
  }, [
    open,
    mode,
    initialData?.id,
    tipos.length,
    status.length,
    origens.length,
    fazendas.length,
    racas.length,
    setValue,
    getValues,
  ]);

  useEffect(() => {
    if (open) {
      // Resetar para a primeira aba quando abrir o modal (só se não estiver em modo de edição interno)
      if (internalMode === "create") {
        setActiveTab("identificacao");
      }

      // Sempre limpar primeiro quando abrir o modal
      if (mode === "create" && internalMode === "create") {
        // Data atual no formato DD/MM/YYYY
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, "0");
        const mes = String(hoje.getMonth() + 1).padStart(2, "0");
        const ano = hoje.getFullYear();
        const dataAtual = `${dia}/${mes}/${ano}`;

        // Gerar brinco temporário se necessário
        const gerarBrincoTemporario = () => {
          const agora = new Date();
          const ano = agora.getFullYear();
          const mes = String(agora.getMonth() + 1).padStart(2, "0");
          const dia = String(agora.getDate()).padStart(2, "0");
          const hora = String(agora.getHours()).padStart(2, "0");
          const minuto = String(agora.getMinutes()).padStart(2, "0");
          const segundo = String(agora.getSeconds()).padStart(2, "0");
          return `TEMP-${ano}${mes}${dia}-${hora}${minuto}${segundo}`;
        };

        // Marcar checkbox como padrão e gerar brinco temporário
        setBrincoTemporario(true);
        const brincoInicial = gerarBrincoTemporario();
        setBrincoTemporarioGerado(brincoInicial);

        // Resetar com valores explícitos vazios para garantir limpeza completa
        reset({
          brinco: brincoInicial,
          nome: "",
          tipoId: "",
          tipoMatrizId: "",
          racaId: "",
          sexo: "M" as "M" | "F",
          statusId: "",
          dataNascimento: "",
          dataCadastro: dataAtual,
          dataEntrada: "",
          dataSaida: "",
          origemId: "",
          fazendaId: "",
          fazendaOrigemId: "",
          proprietarioAnterior: "",
          matrizId: "",
          reprodutorId: "",
          valorCompra: undefined,
          valorVenda: undefined,
          pelagem: "",
          pesoAtual: undefined,
          lote: "",
          obs: "",
        });
        setSelectedTagIds([]);
      } else if (mode === "edit" && initialData) {
        // Validar apenas campos críticos - não bloquear se alguns campos opcionais estiverem faltando
        if (!initialData.brinco || !initialData.id) {
          console.error("❌ Campos críticos faltando no initialData:", {
            brinco: initialData.brinco,
            id: initialData.id,
          });
          showToast({
            type: "error",
            title: "Erro ao carregar animal",
            message: "Dados incompletos. Brinco ou ID do animal está faltando.",
          });
          return;
        }

        // Verificar se o brinco atual é temporário
        const brincoAtual = initialData.brinco || "";
        const isBrincoTemporario =
          brincoAtual.startsWith("TEMP-") || brincoAtual.startsWith("PEND-");
        // Se o brinco tiver valor e não for temporário, desmarcar o checkbox
        if (
          brincoAtual &&
          brincoAtual.trim().length > 0 &&
          !isBrincoTemporario
        ) {
          setBrincoTemporario(false);
          setBrincoTemporarioGerado(null);
        } else if (isBrincoTemporario) {
          setBrincoTemporario(true);
          setBrincoTemporarioGerado(brincoAtual);
        } else {
          // Se não houver brinco, marcar como temporário
          setBrincoTemporario(true);
          setBrincoTemporarioGerado(null);
        }

        // Log de aviso se campos importantes estiverem faltando, mas não bloquear
        if (
          !initialData.tipoId ||
          !initialData.sexo ||
          !initialData.statusId ||
          !initialData.dataNascimento ||
          !initialData.origemId ||
          !initialData.fazendaId
        ) {
          console.warn(
            "⚠️ Alguns campos importantes faltando no initialData (preenchendo com valores padrão se necessário):",
            {
              tipoId: initialData.tipoId,
              sexo: initialData.sexo,
              statusId: initialData.statusId,
              dataNascimento: initialData.dataNascimento,
              origemId: initialData.origemId,
              fazendaId: initialData.fazendaId,
            },
          );
        }

        const valoresFormulario = {
          brinco: initialData.brinco || "",
          nome: initialData.nome || "",
          tipoId: initialData.tipoId || "",
          tipoMatrizId: "", // Será preenchido depois pela genealogia
          racaId: initialData.racaId || "",
          sexo: initialData.sexo || "M",
          statusId: initialData.statusId || "",
          dataNascimento: initialData.dataNascimento
            ? converterDataParaFormatoInput(initialData.dataNascimento)
            : "",
          dataCadastro: initialData.dataCadastro
            ? converterDataParaFormatoInput(initialData.dataCadastro)
            : "",
          dataEntrada: initialData.dataEntrada
            ? converterDataParaFormatoInput(initialData.dataEntrada)
            : "",
          dataSaida: initialData.dataSaida
            ? converterDataParaFormatoInput(initialData.dataSaida)
            : "",
          origemId: initialData.origemId || "",
          fazendaId: initialData.fazendaId || "",
          fazendaOrigemId: initialData.fazendaOrigemId || "",
          proprietarioAnterior: initialData.proprietarioAnterior || "",
          matrizId: initialData.matrizId || "",
          reprodutorId: initialData.reprodutorId || "",
          valorCompra: initialData.valorCompra,
          valorVenda: initialData.valorVenda,
          pelagem: initialData.pelagem || "",
          pesoAtual: initialData.pesoAtual,
          lote: initialData.lote || "",
          obs: initialData.obs || "",
        };

        console.log(
          "📝 Preenchendo formulário com dados:",
          JSON.stringify(valoresFormulario, null, 2),
        );
        console.log(
          "📝 initialData completo:",
          JSON.stringify(initialData, null, 2),
        );

        // Preencher formulário com dados existentes
        // Usar reset com os valores para garantir que todos os campos sejam preenchidos
        reset(valoresFormulario, {
          keepDefaultValues: false,
          keepValues: false,
        });

        // Aguardar um pequeno delay para garantir que o reset foi aplicado antes de setar valores adicionais
        const timeoutId = setTimeout(() => {
          // Reaplicar TODOS os valores usando setValue para garantir que sejam aplicados corretamente
          // Isso é necessário porque reset() pode não propagar valores para campos controlados corretamente
          Object.entries(valoresFormulario).forEach(([key, value]) => {
            const fieldKey = key as keyof FormDataAnimal;

            // Campos numéricos opcionais podem ser undefined - aplicar sempre
            if (
              key === "valorCompra" ||
              key === "valorVenda" ||
              key === "pesoAtual"
            ) {
              setValue(fieldKey, value as any, {
                shouldValidate: false,
                shouldDirty: false,
                shouldTouch: false,
              });
            }
            // Campos de string - aplicar sempre, mesmo se vazio
            else if (typeof value === "string") {
              setValue(fieldKey, value as any, {
                shouldValidate: false,
                shouldDirty: false,
                shouldTouch: false,
              });
            }
            // Outros campos - aplicar se não for undefined/null
            else if (value !== undefined && value !== null) {
              setValue(fieldKey, value as any, {
                shouldValidate: false,
                shouldDirty: false,
                shouldTouch: false,
              });
            }
          });

          // Garantir que campos específicos sejam aplicados explicitamente (forçar re-render)
          setTimeout(() => {
            setValue("brinco", valoresFormulario.brinco, {
              shouldValidate: false,
              shouldDirty: false,
              shouldTouch: false,
            });
            setValue("nome", valoresFormulario.nome, {
              shouldValidate: false,
              shouldDirty: false,
              shouldTouch: false,
            });
            setValue("lote", valoresFormulario.lote, {
              shouldValidate: false,
              shouldDirty: false,
              shouldTouch: false,
            });
            setValue("obs", valoresFormulario.obs, {
              shouldValidate: false,
              shouldDirty: false,
              shouldTouch: false,
            });
            setValue("valorCompra", valoresFormulario.valorCompra, {
              shouldValidate: false,
              shouldDirty: false,
              shouldTouch: false,
            });
            setValue("valorVenda", valoresFormulario.valorVenda, {
              shouldValidate: false,
              shouldDirty: false,
              shouldTouch: false,
            });
            setValue("pesoAtual", valoresFormulario.pesoAtual, {
              shouldValidate: false,
              shouldDirty: false,
              shouldTouch: false,
            });
          }, 50);

          console.log("✅ Valores reaplicados após reset:", valoresFormulario);

          // Carregar genealogia para obter tipoMatrizId e reprodutorId (separadamente)
          db.genealogias
            .where("animalId")
            .equals(initialData.id)
            .first()
            .then((genealogia) => {
              if (genealogia) {
                // tipoMatrizId vem da genealogia
                if (genealogia.tipoMatrizId) {
                  setValue("tipoMatrizId", genealogia.tipoMatrizId, {
                    shouldValidate: false,
                    shouldDirty: false,
                  });
                }
                // reprodutorId pode vir da genealogia ou do initialData
                const reprodutorIdFinal =
                  genealogia.reprodutorId || initialData.reprodutorId || "";
                if (reprodutorIdFinal) {
                  setValue("reprodutorId", reprodutorIdFinal, {
                    shouldValidate: false,
                    shouldDirty: false,
                  });
                }
              } else {
                // Se não há genealogia, usar valores do initialData
                if (initialData.reprodutorId) {
                  setValue("reprodutorId", initialData.reprodutorId, {
                    shouldValidate: false,
                    shouldDirty: false,
                  });
                }
              }
            })
            .catch(() => {
              // Em caso de erro, usar valores do initialData
              if (initialData.reprodutorId) {
                setValue("reprodutorId", initialData.reprodutorId, {
                  shouldValidate: false,
                  shouldDirty: false,
                });
              }
            });

          // Carregar tags
          db.tagAssignments
            .where("[entityId+entityType]")
            .equals([initialData.id, "animal"])
            .and((a) => !a.deletedAt)
            .toArray()
            .then((assignments) => {
              const tagIds = assignments.map((a) => a.tagId);
              setSelectedTagIds(tagIds);
              console.log("✅ Tags carregadas:", tagIds);
            })
            .catch(() => {
              // Ignorar erro silenciosamente
            });
        }, 200);

        // Cleanup do timeout se o componente desmontar ou modal fechar
        return () => {
          clearTimeout(timeoutId);
        };
      }
    } else {
      // Quando o modal fecha, limpar o formulário completamente
      reset({
        brinco: "",
        nome: "",
        tipoId: "",
        tipoMatrizId: "",
        racaId: "",
        sexo: "M" as "M" | "F",
        statusId: "",
        dataNascimento: "",
        dataCadastro: "",
        dataEntrada: "",
        dataSaida: "",
        origemId: "",
        fazendaId: "",
        fazendaOrigemId: "",
        proprietarioAnterior: "",
        matrizId: "",
        reprodutorId: "",
        valorCompra: undefined,
        valorVenda: undefined,
        pelagem: "",
        pesoAtual: undefined,
        lote: "",
        obs: "",
      });
      setSelectedTagIds([]);
      // Resetar flags de brinco temporário ao fechar
      if (!open) {
        setBrincoTemporario(false);
        setBrincoTemporarioGerado(null);
      }
    }
  }, [open, mode, initialData?.id, setValue, reset]); // Removido getValues das dependências para evitar loops

  // REMOVIDO: useEffect que causava loop infinito
  // A lógica de sincronização do checkbox agora está apenas no onChange e onBlur do campo brinco

  const onSubmit = async (data: FormDataAnimal) => {
    if (saving) {
      console.warn("Salvamento já em andamento, ignorando submit duplicado");
      return;
    }
    setSaving(true);
    try {
      console.log("🔄 Salvando animal:", {
        mode,
        internalMode,
        animalId: initialData?.id,
        internalAnimalId: internalInitialData?.id,
        data,
      });
      const now = new Date().toISOString();

      // Se já está em modo de edição internamente, não criar novo animal
      if (mode === "create" && internalMode === "edit" && internalInitialData) {
        console.warn(
          "⚠️ Tentativa de criar animal quando já está em modo de edição, redirecionando para atualização",
        );
        // Forçar atualização ao invés de criação
        const animalAtualizado: Partial<Animal> = {
          brinco: data.brinco.trim(),
          nome: data.nome?.trim() || undefined,
          tipoId: data.tipoId,
          racaId: data.racaId?.trim() || undefined,
          sexo: data.sexo,
          statusId: data.statusId,
          dataNascimento: converterDataParaFormatoBanco(data.dataNascimento),
          dataCadastro: data.dataCadastro?.trim()
            ? converterDataParaFormatoBanco(data.dataCadastro)
            : undefined,
          dataEntrada: data.dataEntrada?.trim()
            ? converterDataParaFormatoBanco(data.dataEntrada)
            : undefined,
          dataSaida: data.dataSaida?.trim()
            ? converterDataParaFormatoBanco(data.dataSaida)
            : undefined,
          origemId: data.origemId,
          fazendaId: data.fazendaId,
          fazendaOrigemId: data.fazendaOrigemId?.trim() || undefined,
          proprietarioAnterior: data.proprietarioAnterior?.trim() || undefined,
          matrizId: data.matrizId?.trim() || undefined,
          reprodutorId: data.reprodutorId?.trim() || undefined,
          valorCompra: data.valorCompra,
          valorVenda: data.valorVenda,
          pelagem: data.pelagem?.trim() || undefined,
          pesoAtual: data.pesoAtual,
          lote: data.lote?.trim() || undefined,
          obs: data.obs?.trim() || undefined,
          updatedAt: now,
          synced: false,
        };
        await db.animais.update(internalInitialData.id, animalAtualizado);
        const animalAtualizadoCompleto = await db.animais.get(
          internalInitialData.id,
        );
        if (animalAtualizadoCompleto) {
          setInternalInitialData(animalAtualizadoCompleto);
        }
        // Encerrar vínculo de confinamento se status for vendido/morto/abate
        const status = await db.statusAnimal.get(data.statusId);
        const nomeStatus = (status?.nome || "").toLowerCase();
        if (/vendido|venda/.test(nomeStatus)) {
          await encerrarVinculoPorStatusAnimal(internalInitialData.id, "venda");
        } else if (/morto|morte/.test(nomeStatus)) {
          await encerrarVinculoPorStatusAnimal(internalInitialData.id, "morte");
        } else if (/abate/.test(nomeStatus)) {
          await encerrarVinculoPorStatusAnimal(internalInitialData.id, "abate");
        }
        showToast({
          type: "success",
          title: "Animal atualizado",
          message: data.brinco,
        });
        onSaved?.();
        setSaving(false);
        return;
      }

      if (mode === "create") {
        // Verificar se já existe um animal com este brinco nesta fazenda ANTES de criar
        let brincoFinal = data.brinco.trim();
        if (!brincoFinal) {
          const agora = new Date();
          const ano = agora.getFullYear();
          const mes = String(agora.getMonth() + 1).padStart(2, "0");
          const dia = String(agora.getDate()).padStart(2, "0");
          const hora = String(agora.getHours()).padStart(2, "0");
          const minuto = String(agora.getMinutes()).padStart(2, "0");
          const segundo = String(agora.getSeconds()).padStart(2, "0");
          brincoFinal = `TEMP-${ano}${mes}${dia}-${hora}${minuto}${segundo}`;
        } else {
          const unico = await validarBrincoUnico(data.fazendaId, brincoFinal);
          if (!unico.valido) {
            showToast({
              type: "error",
              title: "Brinco duplicado",
              message: unico.erro,
            });
            setSaving(false);
            return;
          }
        }

        const novoAnimal: Animal = {
          id: uuid(),
          brinco: brincoFinal,
          nome: data.nome?.trim(),
          tipoId: data.tipoId,
          racaId: data.racaId || undefined,
          sexo: data.sexo,
          statusId: data.statusId,
          // Converter datas de DD/MM/YYYY para YYYY-MM-DD
          dataNascimento: converterDataParaFormatoBanco(data.dataNascimento),
          dataCadastro: data.dataCadastro
            ? converterDataParaFormatoBanco(data.dataCadastro)
            : new Date().toISOString().split("T")[0],
          dataEntrada: data.dataEntrada
            ? converterDataParaFormatoBanco(data.dataEntrada)
            : undefined,
          dataSaida: data.dataSaida
            ? converterDataParaFormatoBanco(data.dataSaida)
            : undefined,
          origemId: data.origemId,
          fazendaId: data.fazendaId,
          fazendaOrigemId: data.fazendaOrigemId || undefined,
          proprietarioAnterior: data.proprietarioAnterior?.trim(),
          matrizId: data.matrizId || undefined,
          reprodutorId: data.reprodutorId || undefined,
          valorCompra: data.valorCompra,
          valorVenda: data.valorVenda,
          pelagem: data.pelagem?.trim(),
          pesoAtual: data.pesoAtual,
          lote: data.lote?.trim(),
          obs: data.obs?.trim(),
          createdAt: now,
          updatedAt: now,
          synced: false,
        };

        console.log("✅ Criando novo animal:", {
          id: novoAnimal.id,
          brinco: novoAnimal.brinco,
          fazendaId: novoAnimal.fazendaId,
        });
        await db.animais.add(novoAnimal);

        // Criar/atualizar genealogia com tipoMatrizId
        if (data.tipoMatrizId || data.matrizId || data.reprodutorId) {
          const genealogiaExistente = await db.genealogias
            .where("animalId")
            .equals(novoAnimal.id)
            .first();

          if (genealogiaExistente) {
            await db.genealogias.update(genealogiaExistente.id, {
              tipoMatrizId: data.tipoMatrizId || undefined,
              matrizId: data.matrizId || undefined,
              reprodutorId: data.reprodutorId || undefined,
              updatedAt: now,
              synced: false,
            });
          } else {
            await db.genealogias.add({
              id: uuid(),
              animalId: novoAnimal.id,
              tipoMatrizId: data.tipoMatrizId || undefined,
              matrizId: data.matrizId || undefined,
              reprodutorId: data.reprodutorId || undefined,
              geracoes: 1,
              createdAt: now,
              updatedAt: now,
              synced: false,
            });
          }
        }

        // Salvar tags
        if (selectedTagIds.length > 0 && user) {
          for (const tagId of selectedTagIds) {
            await db.tagAssignments.add({
              id: uuid(),
              entityId: novoAnimal.id,
              entityType: "animal",
              tagId,
              assignedBy: user.id,
              createdAt: now,
              updatedAt: now,
              synced: false,
            });
          }

          // Recalcular usageCount
          for (const tagId of selectedTagIds) {
            await recalculateTagUsage(tagId);
          }
        }

        // Auditoria
        await registrarAudit({
          entity: "animal",
          entityId: novoAnimal.id,
          action: "create",
          before: null,
          after: novoAnimal,
          user: user ? { id: user.id, nome: user.nome } : null,
          description: `Animal ${novoAnimal.brinco} criado`,
        });

        showToast({
          type: "success",
          title: "Animal cadastrado",
          message: `Brinco: ${novoAnimal.brinco}`,
        });

        // Buscar o animal recém-criado e mudar para modo de edição
        const animalCriado = await db.animais.get(novoAnimal.id);
        if (animalCriado) {
          // Buscar tags do animal criado
          const tagsDoAnimal = await db.tagAssignments
            .where("[entityId+entityType]")
            .equals([animalCriado.id, "animal"])
            .and((a) => !a.deletedAt)
            .toArray();
          const tagIdsDoAnimal = tagsDoAnimal.map((a) => a.tagId);

          // Buscar genealogia se existir
          const genealogia = await db.genealogias
            .where("animalId")
            .equals(animalCriado.id)
            .first();

          setInternalMode("edit");
          setInternalInitialData(animalCriado);
          setSelectedTagIds(tagIdsDoAnimal);

          // Atualizar formulário com os dados do animal criado
          reset({
            brinco: animalCriado.brinco || "",
            nome: animalCriado.nome || "",
            tipoId: animalCriado.tipoId || "",
            tipoMatrizId: genealogia?.tipoMatrizId || "",
            racaId: animalCriado.racaId || "",
            sexo: animalCriado.sexo || "M",
            statusId: animalCriado.statusId || "",
            dataNascimento: animalCriado.dataNascimento
              ? converterDataParaFormatoInput(animalCriado.dataNascimento)
              : "",
            dataCadastro: animalCriado.dataCadastro
              ? converterDataParaFormatoInput(animalCriado.dataCadastro)
              : "",
            dataEntrada: animalCriado.dataEntrada
              ? converterDataParaFormatoInput(animalCriado.dataEntrada)
              : "",
            dataSaida: animalCriado.dataSaida
              ? converterDataParaFormatoInput(animalCriado.dataSaida)
              : "",
            origemId: animalCriado.origemId || "",
            fazendaId: animalCriado.fazendaId || "",
            fazendaOrigemId: animalCriado.fazendaOrigemId || "",
            proprietarioAnterior: animalCriado.proprietarioAnterior || "",
            matrizId: genealogia?.matrizId || animalCriado.matrizId || "",
            reprodutorId:
              genealogia?.reprodutorId || animalCriado.reprodutorId || "",
            valorCompra: animalCriado.valorCompra,
            valorVenda: animalCriado.valorVenda,
            pelagem: animalCriado.pelagem || "",
            pesoAtual: animalCriado.pesoAtual,
            lote: animalCriado.lote || "",
            obs: animalCriado.obs || "",
          });

          setActiveTab("pesagens"); // Mudar para aba de pesagens para facilitar
          // Não fechar o modal, apenas chamar onSaved para atualizar a lista
          onSaved?.();
          return; // Não fechar o modal
        }
      } else if (internalMode === "edit" && internalInitialData) {
        const unico = await validarBrincoUnico(
          data.fazendaId,
          data.brinco.trim(),
          internalInitialData.id,
        );
        if (!unico.valido) {
          showToast({
            type: "error",
            title: "Brinco duplicado",
            message: unico.erro,
          });
          setSaving(false);
          return;
        }
        const animalAtualizado: Partial<Animal> = {
          brinco: data.brinco.trim(),
          nome: data.nome?.trim() || undefined,
          tipoId: data.tipoId,
          racaId: data.racaId?.trim() || undefined,
          sexo: data.sexo,
          statusId: data.statusId,
          // Converter datas de DD/MM/YYYY para YYYY-MM-DD
          dataNascimento: converterDataParaFormatoBanco(data.dataNascimento),
          dataCadastro: data.dataCadastro?.trim()
            ? converterDataParaFormatoBanco(data.dataCadastro)
            : undefined,
          dataEntrada: data.dataEntrada?.trim()
            ? converterDataParaFormatoBanco(data.dataEntrada)
            : undefined,
          dataSaida: data.dataSaida?.trim()
            ? converterDataParaFormatoBanco(data.dataSaida)
            : undefined,
          origemId: data.origemId,
          fazendaId: data.fazendaId,
          fazendaOrigemId: data.fazendaOrigemId?.trim() || undefined,
          proprietarioAnterior: data.proprietarioAnterior?.trim() || undefined,
          matrizId: data.matrizId?.trim() || undefined,
          reprodutorId: data.reprodutorId?.trim() || undefined,
          valorCompra: data.valorCompra,
          valorVenda: data.valorVenda,
          pelagem: data.pelagem?.trim() || undefined,
          pesoAtual: data.pesoAtual,
          lote: data.lote?.trim() || undefined,
          obs: data.obs?.trim() || undefined,
          updatedAt: now,
          synced: false,
        };

        const updated = await db.animais.update(
          initialData.id,
          animalAtualizado,
        );
        if (updated === 0) {
          throw new Error(
            "Animal não encontrado ou não foi possível atualizar",
          );
        }
        console.log("✅ Animal atualizado no banco local:", initialData.id);

        // Encerrar vínculo de confinamento se status for vendido/morto/abate
        const status = await db.statusAnimal.get(data.statusId);
        const nomeStatus = (status?.nome || "").toLowerCase();
        if (/vendido|venda/.test(nomeStatus)) {
          await encerrarVinculoPorStatusAnimal(initialData.id, "venda");
        } else if (/morto|morte/.test(nomeStatus)) {
          await encerrarVinculoPorStatusAnimal(initialData.id, "morte");
        } else if (/abate/.test(nomeStatus)) {
          await encerrarVinculoPorStatusAnimal(initialData.id, "abate");
        }

        // Criar/atualizar genealogia com tipoMatrizId
        const genealogiaExistente = await db.genealogias
          .where("animalId")
          .equals(initialData.id)
          .first();

        if (genealogiaExistente) {
          await db.genealogias.update(genealogiaExistente.id, {
            tipoMatrizId: data.tipoMatrizId || undefined,
            matrizId: data.matrizId || undefined,
            reprodutorId: data.reprodutorId || undefined,
            updatedAt: now,
            synced: false,
          });
        } else if (data.tipoMatrizId || data.matrizId || data.reprodutorId) {
          await db.genealogias.add({
            id: uuid(),
            animalId: initialData.id,
            tipoMatrizId: data.tipoMatrizId || undefined,
            matrizId: data.matrizId || undefined,
            reprodutorId: data.reprodutorId || undefined,
            geracoes: 1,
            createdAt: now,
            updatedAt: now,
            synced: false,
          });
        }

        // Atualizar tags
        if (user) {
          // Buscar tags anteriores
          const tagsAnteriores = await db.tagAssignments
            .where("[entityId+entityType]")
            .equals([internalInitialData.id, "animal"])
            .and((a) => !a.deletedAt)
            .toArray();

          const tagIdsAnteriores = tagsAnteriores.map((a) => a.tagId);

          // Tags removidas
          const tagsRemovidas = tagIdsAnteriores.filter(
            (id) => !selectedTagIds.includes(id),
          );
          for (const tagId of tagsRemovidas) {
            const assignment = tagsAnteriores.find((a) => a.tagId === tagId);
            if (assignment) {
              await db.tagAssignments.update(assignment.id, {
                deletedAt: now,
                synced: false,
              });
            }
          }

          // Tags adicionadas
          const tagsAdicionadas = selectedTagIds.filter(
            (id) => !tagIdsAnteriores.includes(id),
          );
          for (const tagId of tagsAdicionadas) {
            await db.tagAssignments.add({
              id: uuid(),
              entityId: internalInitialData.id,
              entityType: "animal",
              tagId,
              assignedBy: user.id,
              createdAt: now,
              updatedAt: now,
              synced: false,
            });
          }

          // Recalcular usageCount de todas as tags afetadas
          const todasTagsAfetadas = [
            ...new Set([...tagsRemovidas, ...tagsAdicionadas]),
          ];
          for (const tagId of todasTagsAfetadas) {
            await recalculateTagUsage(tagId);
          }
        }

        // Auditoria
        await registrarAudit({
          entity: "animal",
          entityId: initialData.id,
          action: "update",
          before: initialData,
          after: { ...initialData, ...animalAtualizado },
          user: user ? { id: user.id, nome: user.nome } : null,
          description: `Animal ${data.brinco} atualizado`,
        });

        showToast({
          type: "success",
          title: "Animal atualizado",
          message: data.brinco,
        });

        // Chamar callback se fornecido
        onSaved?.();
      }

      // Limpar formulário completamente antes de fechar
      reset({
        brinco: "",
        nome: "",
        tipoId: "",
        tipoMatrizId: "",
        racaId: "",
        sexo: "M" as "M" | "F",
        statusId: "",
        dataNascimento: "",
        dataCadastro: "",
        dataEntrada: "",
        dataSaida: "",
        origemId: "",
        fazendaId: "",
        fazendaOrigemId: "",
        proprietarioAnterior: "",
        matrizId: "",
        reprodutorId: "",
        valorCompra: undefined,
        valorVenda: undefined,
        pelagem: "",
        pesoAtual: undefined,
        lote: "",
        obs: "",
      });
      setSelectedTagIds([]);
      onClose();
    } catch (error: any) {
      console.error("❌ Erro ao salvar animal:", error);
      console.error("Detalhes do erro:", {
        message: error?.message,
        stack: error?.stack,
        mode,
        animalId: initialData?.id,
      });
      showToast({
        type: "error",
        title: "Erro ao salvar",
        message: error?.message || "Tente novamente",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose}>
        <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-lg shadow-xl w-full h-full sm:w-[80vw] sm:h-[80vh] flex flex-col overflow-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-slate-600">
          <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-3 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 flex items-center justify-between z-10">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 truncate pr-2">
              {internalMode === "create"
                ? "Cadastrar Novo Animal"
                : "Editar Animal"}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>

          {/* Confinamento ativo (quando o animal está em um confinamento) */}
          {confinamentoAtivo && internalMode === "edit" && (
            <div className="flex-shrink-0 mx-3 sm:mx-6 mt-2 mb-1 p-3 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium mb-2">
                <Icons.Warehouse className="w-5 h-5" />
                Confinado em: {confinamentoAtivo.confinamento.nome}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-gray-700 dark:text-slate-300">
                <span>
                  Data entrada:{" "}
                  {confinamentoAtivo.vinculo.dataEntrada
                    ?.split("-")
                    .reverse()
                    .join("/") ?? "-"}
                </span>
                <span>
                  Peso entrada:{" "}
                  {confinamentoAtivo.vinculo.pesoEntrada?.toFixed(1) ?? "-"} kg
                </span>
                <span>
                  Peso atual:{" "}
                  {confinamentoAtivo.pesoAtual != null
                    ? `${confinamentoAtivo.pesoAtual.toFixed(1)} kg`
                    : "-"}
                </span>
                <span>
                  GMD atual:{" "}
                  {confinamentoAtivo.gmdParcial.gmd != null
                    ? `${confinamentoAtivo.gmdParcial.gmd.toFixed(3)} kg/dia (${confinamentoAtivo.gmdParcial.dias} dias)`
                    : "-"}
                </span>
              </div>
            </div>
          )}

          {/* Abas */}
          <div className="flex-shrink-0 border-b border-gray-200 dark:border-slate-700 px-2 sm:px-6">
            <nav
              className="flex -mb-px flex-wrap gap-1 overflow-x-auto"
              aria-label="Tabs"
            >
              {[
                {
                  id: "identificacao" as TabType,
                  label: "Identificação",
                  icon: Icons.Tag,
                },
                {
                  id: "classificacao" as TabType,
                  label: "Classificação",
                  icon: Icons.List,
                },
                {
                  id: "datas" as TabType,
                  label: "Datas",
                  icon: Icons.Calendar,
                },
                {
                  id: "origem" as TabType,
                  label: "Origem",
                  icon: Icons.MapPin,
                },
                {
                  id: "genealogia" as TabType,
                  label: "Genealogia",
                  icon: Icons.GitBranch,
                },
                {
                  id: "financeiro" as TabType,
                  label: "Financeiro",
                  icon: Icons.DollarSign,
                },
                {
                  id: "pesagens" as TabType,
                  label: `Pesagens${pesagens.length > 0 ? ` (${pesagens.length})` : ""}`,
                  icon: Icons.Scale,
                },
                {
                  id: "vacinacoes" as TabType,
                  label: `Vacinações${vacinacoes.length > 0 ? ` (${vacinacoes.length})` : ""}`,
                  icon: Icons.Injection,
                },
                ...(internalMode === "edit" && animalId
                  ? [
                      {
                        id: "desmama" as TabType,
                        label: `Desmama${desmamas.length > 0 ? ` (${desmamas.length})` : ""}`,
                        icon: Icons.Baby,
                      },
                    ]
                  : []),
                { id: "tags" as TabType, label: "Tags/Obs", icon: Icons.Tag },
              ].map((tab) => {
                const Icon = tab.icon;
                const temErro = Object.keys(errors).some(
                  (campo) => campoParaAba[campo] === tab.id,
                );
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-1 md:gap-2 py-3 md:py-4 px-2 md:px-4 border-b-2 font-medium text-xs md:text-sm transition-colors whitespace-nowrap
                      ${
                        activeTab === tab.id
                          ? `${getThemeClasses(primaryColor, "border")} ${getThemeClasses(primaryColor, "text")}`
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                      }
                      ${temErro ? "text-red-600 dark:text-red-400" : ""}
                    `}
                    title={tab.label}
                  >
                    <Icon className="w-4 h-4 md:w-4 md:h-4 flex-shrink-0" />
                    <span className="hidden md:inline">{tab.label}</span>
                    {temErro && (
                      <Icons.AlertCircle className="w-3 h-3 md:w-4 md:h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <form
            id="animal-form"
            onSubmit={handleSubmit(onSubmit, (errors) => {
              console.error("❌ Erros de validação do formulário:", errors);
              focarAbaComErro(errors);
              const primeiroErro = Object.values(errors)[0];
              if (primeiroErro) {
                showToast({
                  type: "error",
                  title: "Erro de validação",
                  message:
                    primeiroErro.message || "Verifique os campos do formulário",
                });
              }
            })}
            className="flex-1 overflow-y-auto px-3 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-6 space-y-4"
            noValidate
          >
            {/* ABA: Identificação */}
            {activeTab === "identificacao" && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icons.Tag className="w-4 h-4" />
                    Identificação
                  </h3>
                  <div className="space-y-3">
                    {/* Checkbox "Pendente de brincagem" acima dos campos */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={brincoTemporario}
                        onChange={(e) => {
                          setBrincoTemporario(e.target.checked);
                          if (e.target.checked) {
                            // Se marcar e não houver brinco ou o brinco atual não for temporário, gerar novo
                            const brincoAtual = brincoWatch || "";
                            if (
                              !brincoAtual ||
                              (!brincoAtual.startsWith("TEMP-") &&
                                !brincoAtual.startsWith("PEND-"))
                            ) {
                              const agora = new Date();
                              const ano = agora.getFullYear();
                              const mes = String(agora.getMonth() + 1).padStart(
                                2,
                                "0",
                              );
                              const dia = String(agora.getDate()).padStart(
                                2,
                                "0",
                              );
                              const hora = String(agora.getHours()).padStart(
                                2,
                                "0",
                              );
                              const minuto = String(
                                agora.getMinutes(),
                              ).padStart(2, "0");
                              const segundo = String(
                                agora.getSeconds(),
                              ).padStart(2, "0");
                              const brincoTemp = `TEMP-${ano}${mes}${dia}-${hora}${minuto}${segundo}`;
                              setValue("brinco", brincoTemp, {
                                shouldValidate: false,
                              });
                              setBrincoTemporarioGerado(brincoTemp);
                            } else {
                              // Se já for temporário, apenas manter o estado
                              setBrincoTemporarioGerado(brincoAtual);
                            }
                          } else {
                            // Se desmarcar e o brinco atual for temporário, limpar
                            const brincoAtual = brincoWatch || "";
                            if (
                              brincoAtual.startsWith("TEMP-") ||
                              brincoAtual.startsWith("PEND-")
                            ) {
                              setValue("brinco", "", { shouldValidate: false });
                              setBrincoTemporarioGerado(null);
                            } else {
                              // Se não for temporário, apenas desmarcar o checkbox
                              setBrincoTemporarioGerado(null);
                            }
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-slate-300">
                        Pendente de brincagem
                      </span>
                    </label>

                    {/* Campos Brinco e Nome na mesma linha */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <Input
                          {...(() => {
                            const { ref, onChange, onBlur, name, ...rest } =
                              register("brinco");
                            const currentValue = brincoWatch || "";
                            return {
                              ...rest,
                              name,
                              value: currentValue,
                              onChange: (
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) => {
                                onChange(e);
                                const newValue = e.target.value.trim();
                                setValue("brinco", newValue, {
                                  shouldValidate: false,
                                });

                                // Sincronizar estado do checkbox com o valor: não preencher de volta se o usuário apagou
                                if (
                                  newValue &&
                                  newValue.length > 0 &&
                                  !newValue.startsWith("TEMP-") &&
                                  !newValue.startsWith("PEND-")
                                ) {
                                  setBrincoTemporario(false);
                                  setBrincoTemporarioGerado(null);
                                } else if (
                                  newValue.startsWith("TEMP-") ||
                                  newValue.startsWith("PEND-")
                                ) {
                                  setBrincoTemporario(true);
                                  setBrincoTemporarioGerado(newValue);
                                } else {
                                  // Campo vazio: apenas desmarcar e limpar; não gerar temporário (usuário pode ter apagado de propósito)
                                  setBrincoTemporario(false);
                                  setBrincoTemporarioGerado(null);
                                }
                              },
                              onBlur: (e) => {
                                onBlur(e);
                                const value = (e.target.value || "").trim();
                                if (
                                  value &&
                                  value.length > 0 &&
                                  !value.startsWith("TEMP-") &&
                                  !value.startsWith("PEND-")
                                ) {
                                  setBrincoTemporario(false);
                                  setBrincoTemporarioGerado(null);
                                } else if (
                                  value.startsWith("TEMP-") ||
                                  value.startsWith("PEND-")
                                ) {
                                  setBrincoTemporario(true);
                                  setBrincoTemporarioGerado(value);
                                } else {
                                  // Campo vazio ao sair: não preencher de volta (respeita usuário ter apagado)
                                  setBrincoTemporario(false);
                                  setBrincoTemporarioGerado(null);
                                }
                              },
                              ref,
                            };
                          })()}
                          label="Brinco"
                          type="text"
                          required
                          placeholder="Ex: 1234567890 ou deixe vazio para gerar temporário"
                          error={errors.brinco?.message}
                        />
                        {(brincoWatch?.startsWith("TEMP-") ||
                          brincoWatch?.startsWith("PEND-")) && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                            <Icons.AlertCircle className="w-3 h-3" />
                            Brinco temporário - atualize com o brinco real após
                            a brincagem
                          </p>
                        )}
                      </div>

                      <Input
                        {...(() => {
                          const { ref, onChange, onBlur, name, ...rest } =
                            register("nome");
                          return {
                            ...rest,
                            name,
                            value: nomeWatch || "",
                            onChange: (
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              onChange(e);
                              setValue("nome", e.target.value, {
                                shouldValidate: false,
                              });
                            },
                            onBlur,
                            ref,
                          };
                        })()}
                        label="Nome (opcional)"
                        type="text"
                        placeholder="Ex: Mimosa"
                      />
                    </div>

                    <Input
                      {...(() => {
                        const { ref, onChange, onBlur, name, ...rest } =
                          register("lote");
                        return {
                          ...rest,
                          name,
                          value: loteWatch || "",
                          onChange: (
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            onChange(e);
                            setValue("lote", e.target.value, {
                              shouldValidate: false,
                            });
                          },
                          onBlur,
                          ref,
                        };
                      })()}
                      label="Lote"
                      type="text"
                      placeholder="Ex: Lote 1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA: Classificação */}
            {activeTab === "classificacao" && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icons.List className="w-4 h-4" />
                    Classificação
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tipo */}
                    <div>
                      <Controller
                        name="tipoId"
                        control={control}
                        render={({ field }) => {
                          // Usar watch para garantir atualização
                          const currentValue = tipoIdWatch || field.value || "";
                          return (
                            <Combobox
                              label="Tipo"
                              required
                              options={tipoOptions}
                              value={currentValue || ""}
                              onChange={(selected) => {
                                const value =
                                  typeof selected === "string"
                                    ? selected
                                    : (selected as ComboboxOption)?.value || "";
                                field.onChange(value);
                                setValue("tipoId", value, {
                                  shouldValidate: false,
                                });
                              }}
                              placeholder="Selecione o tipo"
                              error={errors.tipoId?.message}
                              onAddNew={
                                podeGerenciarTipos
                                  ? () => setTipoModalOpen(true)
                                  : undefined
                              }
                              addNewLabel="Novo tipo"
                            />
                          );
                        }}
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <Controller
                        name="statusId"
                        control={control}
                        render={({ field }) => {
                          // Usar watch para garantir atualização
                          const currentValue =
                            statusIdWatch || field.value || "";
                          return (
                            <Combobox
                              label="Status"
                              required
                              options={statusOptions}
                              value={currentValue || ""}
                              onChange={(selected) => {
                                const value =
                                  typeof selected === "string"
                                    ? selected
                                    : (selected as ComboboxOption)?.value || "";
                                field.onChange(value);
                                setValue("statusId", value, {
                                  shouldValidate: false,
                                });
                              }}
                              placeholder="Selecione o status"
                              error={errors.statusId?.message}
                              onAddNew={
                                podeGerenciarStatus
                                  ? () => setStatusModalOpen(true)
                                  : undefined
                              }
                              addNewLabel="Novo status"
                            />
                          );
                        }}
                      />
                    </div>

                    {/* Sexo */}
                    <div>
                      <Controller
                        name="sexo"
                        control={control}
                        render={({ field }) => {
                          // Usar watch para garantir atualização
                          const currentValue = sexoWatch || field.value || "M";
                          return (
                            <Combobox
                              label="Sexo"
                              required
                              options={[
                                { label: "Macho", value: "M" },
                                { label: "Fêmea", value: "F" },
                              ]}
                              value={currentValue}
                              onChange={(selected) => {
                                const value =
                                  typeof selected === "string"
                                    ? selected
                                    : (selected as ComboboxOption)?.value || "";
                                field.onChange(value);
                                setValue("sexo", value as "M" | "F", {
                                  shouldValidate: false,
                                });
                              }}
                              placeholder="Selecione o sexo"
                              error={errors.sexo?.message}
                            />
                          );
                        }}
                      />
                    </div>

                    {/* Raça */}
                    <div>
                      <Controller
                        name="racaId"
                        control={control}
                        render={({ field }) => (
                          <Combobox
                            label="Raça"
                            options={racaOptions}
                            value={field.value || ""}
                            onChange={(selected) => {
                              const value =
                                typeof selected === "string"
                                  ? selected
                                  : (selected as ComboboxOption)?.value || "";
                              field.onChange(value);
                            }}
                            placeholder="Selecione a raça"
                            onAddNew={
                              podeGerenciarRacas
                                ? () => setModalRacaOpen(true)
                                : undefined
                            }
                            addNewLabel="Nova raça"
                          />
                        )}
                      />
                    </div>
                    {modalRacaOpen && (
                      <ModalRaca
                        open={modalRacaOpen}
                        onClose={() => setModalRacaOpen(false)}
                        onRacaCadastrada={(racaId) => {
                          setValue("racaId", racaId);
                          refetchRacas();
                          setModalRacaOpen(false);
                        }}
                      />
                    )}

                    {/* Pelagem */}
                    <div className="md:col-span-2">
                      <Input
                        {...(() => {
                          const { ref, onChange, onBlur, name, ...rest } =
                            register("pelagem");
                          return {
                            ...rest,
                            name,
                            value: pelagemWatch || "",
                            onChange: (
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              onChange(e);
                              setValue("pelagem", e.target.value, {
                                shouldValidate: false,
                              });
                            },
                            onBlur,
                            ref,
                          };
                        })()}
                        label="Pelagem/Cor"
                        type="text"
                        placeholder="Ex: Preto, Vermelho, Malhado..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA: Datas */}
            {activeTab === "datas" && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icons.Calendar className="w-4 h-4" />
                    Datas
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Input
                        {...(() => {
                          const {
                            ref,
                            onChange: registerOnChange,
                            onBlur: registerOnBlur,
                            name,
                            ...rest
                          } = register("dataNascimento");
                          return {
                            ...rest,
                            name,
                            value: dataNascimentoWatch || "",
                            onChange: (
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const norm = normalizarDataInput(e.target.value);
                              e.target.value = norm;
                              setValue("dataNascimento", norm, {
                                shouldValidate: false,
                              });
                              registerOnChange(e);
                            },
                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                              const norm = normalizarDataInput(e.target.value);
                              setValue("dataNascimento", norm, {
                                shouldValidate: true,
                              });
                              registerOnBlur(e);
                            },
                            ref,
                          };
                        })()}
                        label="Data de Nascimento"
                        type="text"
                        required
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="DD/MM/YYYY"
                        error={errors.dataNascimento?.message}
                      />
                    </div>

                    <div>
                      <Input
                        {...(() => {
                          const {
                            ref,
                            onChange: registerOnChange,
                            onBlur: registerOnBlur,
                            name,
                            ...rest
                          } = register("dataCadastro");
                          return {
                            ...rest,
                            name,
                            value: dataCadastroWatch || "",
                            onChange: (
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const norm = normalizarDataInput(e.target.value);
                              e.target.value = norm;
                              setValue("dataCadastro", norm, {
                                shouldValidate: false,
                              });
                              registerOnChange(e);
                            },
                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                              const norm = normalizarDataInput(e.target.value);
                              setValue("dataCadastro", norm, {
                                shouldValidate: true,
                              });
                              registerOnBlur(e);
                            },
                            ref,
                          };
                        })()}
                        label="Data de Cadastro"
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="DD/MM/YYYY"
                        error={errors.dataCadastro?.message}
                      />
                    </div>

                    <div>
                      <Input
                        {...(() => {
                          const {
                            ref,
                            onChange: registerOnChange,
                            onBlur: registerOnBlur,
                            name,
                            ...rest
                          } = register("dataEntrada");
                          return {
                            ...rest,
                            name,
                            value: dataEntradaWatch || "",
                            onChange: (
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const norm = normalizarDataInput(e.target.value);
                              e.target.value = norm;
                              setValue("dataEntrada", norm, {
                                shouldValidate: false,
                              });
                              registerOnChange(e);
                            },
                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                              const norm = normalizarDataInput(e.target.value);
                              setValue("dataEntrada", norm, {
                                shouldValidate: true,
                              });
                              registerOnBlur(e);
                            },
                            ref,
                          };
                        })()}
                        label="Data de Entrada na Fazenda"
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="DD/MM/YYYY"
                        error={errors.dataEntrada?.message}
                      />
                    </div>

                    <div>
                      <Input
                        {...(() => {
                          const {
                            ref,
                            onChange: registerOnChange,
                            onBlur: registerOnBlur,
                            name,
                            ...rest
                          } = register("dataSaida");
                          return {
                            ...rest,
                            name,
                            value: dataSaidaWatch || "",
                            onChange: (
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const norm = normalizarDataInput(e.target.value);
                              e.target.value = norm;
                              setValue("dataSaida", norm, {
                                shouldValidate: false,
                              });
                              registerOnChange(e);
                            },
                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                              const norm = normalizarDataInput(e.target.value);
                              setValue("dataSaida", norm, {
                                shouldValidate: true,
                              });
                              registerOnBlur(e);
                            },
                            ref,
                          };
                        })()}
                        label="Data de Saída (Venda/Morte)"
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="DD/MM/YYYY"
                        error={errors.dataSaida?.message}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA: Origem */}
            {activeTab === "origem" && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icons.MapPin className="w-4 h-4" />
                    Origem e Proprietário
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Controller
                        name="origemId"
                        control={control}
                        render={({ field }) => {
                          // Usar watch para garantir atualização
                          const currentValue =
                            origemIdWatch || field.value || "";
                          return (
                            <Combobox
                              label="Origem"
                              required
                              options={origemOptions}
                              value={currentValue || ""}
                              onChange={(selected) => {
                                const value =
                                  typeof selected === "string"
                                    ? selected
                                    : (selected as ComboboxOption)?.value || "";
                                field.onChange(value);
                                setValue("origemId", value, {
                                  shouldValidate: false,
                                });
                              }}
                              placeholder="Selecione a origem"
                              error={errors.origemId?.message}
                            />
                          );
                        }}
                      />
                    </div>

                    <div>
                      <Controller
                        name="fazendaId"
                        control={control}
                        render={({ field }) => {
                          // Usar watch para garantir atualização
                          const currentValue =
                            fazendaIdWatch || field.value || "";
                          return (
                            <Combobox
                              label="Fazenda Atual"
                              required
                              options={fazendaOptions}
                              value={currentValue || ""}
                              onChange={(selected) => {
                                const value =
                                  typeof selected === "string"
                                    ? selected
                                    : (selected as ComboboxOption)?.value || "";
                                field.onChange(value);
                                setValue("fazendaId", value, {
                                  shouldValidate: false,
                                });
                              }}
                              placeholder="Selecione a fazenda"
                              error={errors.fazendaId?.message}
                            />
                          );
                        }}
                      />
                    </div>

                    {/* Mostrar apenas se origem for Transferido ou Comprado */}
                    {origemIdWatch &&
                      origens.find((o) => o.id === origemIdWatch)?.nome !==
                        "Nascido na Fazenda" && (
                        <>
                          <div>
                            <Controller
                              name="fazendaOrigemId"
                              control={control}
                              render={({ field }) => (
                                <Combobox
                                  label="Fazenda de Origem"
                                  options={[
                                    { label: "Nenhuma", value: "" },
                                    ...fazendaOptions,
                                  ]}
                                  value={field.value ?? ""}
                                  onChange={(selected) => {
                                    const value =
                                      typeof selected === "string"
                                        ? selected
                                        : (selected as ComboboxOption)?.value ||
                                          "";
                                    field.onChange(value);
                                  }}
                                  placeholder="Fazenda de origem"
                                />
                              )}
                            />
                          </div>

                          <div>
                            <Input
                              {...(() => {
                                const { ref, onChange, onBlur, name, ...rest } =
                                  register("proprietarioAnterior");
                                return {
                                  ...rest,
                                  name,
                                  value: proprietarioAnteriorWatch || "",
                                  onChange: (
                                    e: React.ChangeEvent<HTMLInputElement>,
                                  ) => {
                                    onChange(e);
                                    setValue(
                                      "proprietarioAnterior",
                                      e.target.value,
                                      { shouldValidate: false },
                                    );
                                  },
                                  onBlur,
                                  ref,
                                };
                              })()}
                              label="Proprietário Anterior"
                              type="text"
                              placeholder="Nome do proprietário"
                            />
                          </div>
                        </>
                      )}
                  </div>
                </div>
              </div>
            )}

            {/* ABA: Genealogia */}
            {activeTab === "genealogia" && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icons.GitBranch className="w-4 h-4" />
                    Genealogia
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Controller
                        name="matrizId"
                        control={control}
                        render={({ field }) => {
                          // Usar watch para garantir atualização
                          const currentValue =
                            matrizIdWatch || field.value || "";
                          return (
                            <MatrizSearchCombobox
                              label="Mãe (Matriz)"
                              value={currentValue || undefined}
                              onChange={(matrizId) => {
                                field.onChange(matrizId || "");
                                setValue("matrizId", matrizId || "", {
                                  shouldValidate: false,
                                });
                                if (matrizId) {
                                  db.animais.get(matrizId).then((animal) => {
                                    if (animal?.tipoId) {
                                      setValue("tipoMatrizId", animal.tipoId, {
                                        shouldValidate: false,
                                      });
                                    }
                                  });
                                } else {
                                  setValue("tipoMatrizId", "", {
                                    shouldValidate: false,
                                  });
                                }
                              }}
                              placeholder="Digite o brinco ou nome da mãe..."
                              fazendaId={fazendaIdWatch}
                            />
                          );
                        }}
                      />
                    </div>

                    <div>
                      <Controller
                        name="tipoMatrizId"
                        control={control}
                        render={({ field }) => {
                          // Usar watch para garantir atualização
                          const currentValue =
                            tipoMatrizIdWatch || field.value || "";
                          return (
                            <Combobox
                              label="Tipo da Matriz"
                              options={tipoOptions}
                              value={currentValue || ""}
                              onChange={(selected) => {
                                const value =
                                  typeof selected === "string"
                                    ? selected
                                    : (selected as ComboboxOption)?.value || "";
                                field.onChange(value);
                                setValue("tipoMatrizId", value, {
                                  shouldValidate: false,
                                });
                              }}
                              placeholder="Selecione o tipo da matriz"
                            />
                          );
                        }}
                      />
                    </div>

                    <div>
                      <Controller
                        name="reprodutorId"
                        control={control}
                        render={({ field }) => {
                          // Usar watch para garantir atualização
                          const currentValue =
                            reprodutorIdWatch || field.value || "";
                          return (
                            <AnimalSearchCombobox
                              label="Pai (Reprodutor)"
                              value={currentValue || undefined}
                              onChange={(animalId) => {
                                field.onChange(animalId || "");
                                setValue("reprodutorId", animalId || "", {
                                  shouldValidate: false,
                                });
                              }}
                              placeholder="Digite o brinco ou nome do pai..."
                              excludeAnimalId={initialData?.id}
                            />
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA: Financeiro */}
            {activeTab === "financeiro" && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icons.DollarSign className="w-4 h-4" />
                    Financeiro
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Input
                        {...(() => {
                          const { ref, onChange, onBlur, name, ...rest } =
                            register("valorCompra");
                          return {
                            ...rest,
                            name,
                            value:
                              valorCompraWatch !== undefined &&
                              valorCompraWatch !== null
                                ? String(valorCompraWatch)
                                : "",
                            onChange: (
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const value = e.target.value;
                              const numValue =
                                value && value.trim() !== ""
                                  ? parseFloat(value)
                                  : undefined;
                              setValue("valorCompra", numValue, {
                                shouldValidate: false,
                              });
                              onChange({
                                ...e,
                                target: { ...e.target, value: value || "" },
                              });
                            },
                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                              const value = e.target.value;
                              const numValue =
                                value && value.trim() !== ""
                                  ? parseFloat(value)
                                  : undefined;
                              setValue("valorCompra", numValue, {
                                shouldValidate: true,
                              });
                              onBlur(e);
                            },
                            ref,
                          };
                        })()}
                        label="Valor de Compra (R$)"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <Input
                        {...(() => {
                          const { ref, onChange, onBlur, name, ...rest } =
                            register("valorVenda");
                          return {
                            ...rest,
                            name,
                            value:
                              valorVendaWatch !== undefined &&
                              valorVendaWatch !== null
                                ? String(valorVendaWatch)
                                : "",
                            onChange: (
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const value = e.target.value;
                              const numValue =
                                value && value.trim() !== ""
                                  ? parseFloat(value)
                                  : undefined;
                              setValue("valorVenda", numValue, {
                                shouldValidate: false,
                              });
                              onChange({
                                ...e,
                                target: { ...e.target, value: value || "" },
                              });
                            },
                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                              const value = e.target.value;
                              const numValue =
                                value && value.trim() !== ""
                                  ? parseFloat(value)
                                  : undefined;
                              setValue("valorVenda", numValue, {
                                shouldValidate: true,
                              });
                              onBlur(e);
                            },
                            ref,
                          };
                        })()}
                        label="Valor de Venda (R$)"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <Input
                        {...(() => {
                          const { ref, onChange, onBlur, name, ...rest } =
                            register("pesoAtual");
                          return {
                            ...rest,
                            name,
                            value:
                              pesoAtualWatch !== undefined &&
                              pesoAtualWatch !== null
                                ? String(pesoAtualWatch)
                                : "",
                            onChange: (
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) => {
                              const value = e.target.value;
                              const numValue =
                                value && value.trim() !== ""
                                  ? parseFloat(value)
                                  : undefined;
                              setValue("pesoAtual", numValue, {
                                shouldValidate: false,
                              });
                              onChange({
                                ...e,
                                target: { ...e.target, value: value || "" },
                              });
                            },
                            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                              const value = e.target.value;
                              const numValue =
                                value && value.trim() !== ""
                                  ? parseFloat(value)
                                  : undefined;
                              setValue("pesoAtual", numValue, {
                                shouldValidate: true,
                              });
                              onBlur(e);
                            },
                            ref,
                          };
                        })()}
                        label="Peso Atual (kg)"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA: Desmama */}
            {activeTab === "desmama" && internalMode === "edit" && animalId && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
                      <Icons.Baby className="w-4 h-4" />
                      Desmama
                    </h3>
                    {desmamas.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDesmamaEditando(null);
                          setDesmamaModalOpen(true);
                        }}
                        className={`px-3 py-1.5 text-sm ${getPrimaryButtonClass(primaryColor)} text-white rounded-md hover:opacity-90 transition-opacity flex items-center gap-2`}
                      >
                        <Icons.Plus className="w-4 h-4" />
                        Adicionar Desmama
                      </button>
                    )}
                  </div>

                  {desmamas.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      Nenhuma desmama cadastrada ainda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {desmamas
                        .sort((a, b) => {
                          const dataA = a.dataDesmama
                            ? a.dataDesmama.includes("/")
                              ? a.dataDesmama.split("/").reverse().join("-")
                              : a.dataDesmama
                            : "";
                          const dataB = b.dataDesmama
                            ? b.dataDesmama.includes("/")
                              ? b.dataDesmama.split("/").reverse().join("-")
                              : b.dataDesmama
                            : "";
                          return (
                            new Date(dataB).getTime() -
                            new Date(dataA).getTime()
                          );
                        })
                        .map((desmama) => {
                          const dataFormatada = desmama.dataDesmama
                            ? desmama.dataDesmama.includes("/")
                              ? desmama.dataDesmama
                              : desmama.dataDesmama
                                  .split("-")
                                  .reverse()
                                  .join("/")
                            : "-";
                          return (
                            <div
                              key={desmama.id}
                              className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-gray-900 dark:text-slate-100">
                                    {dataFormatada}
                                  </span>
                                  {desmama.pesoDesmama && (
                                    <span className="text-gray-600 dark:text-slate-400">
                                      {desmama.pesoDesmama.toFixed(2)} kg
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDesmamaEditando(desmama);
                                    setDesmamaModalOpen(true);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                                  title="Editar desmama"
                                >
                                  <Icons.Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (
                                      confirm(
                                        `Deseja realmente excluir o registro de desmama de ${dataFormatada}?`,
                                      )
                                    ) {
                                      try {
                                        await db.desmamas.delete(desmama.id);

                                        if (user) {
                                          await registrarAudit({
                                            entidade: "desmama",
                                            entidadeId: desmama.id,
                                            operacao: "delete",
                                            usuarioId: user.id,
                                            detalhes: `Desmama excluída`,
                                          });
                                        }

                                        showToast(
                                          "Desmama excluída com sucesso!",
                                          "success",
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Erro ao excluir desmama:",
                                          error,
                                        );
                                        showToast(
                                          "Erro ao excluir desmama",
                                          "error",
                                        );
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title="Excluir desmama"
                                >
                                  <Icons.Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA: Pesagens */}
            {activeTab === "pesagens" && (
              <div className="space-y-4">
                {animalId ? (
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 md:p-5 border border-gray-200/60 dark:border-slate-700/60">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
                        <Icons.Scale className="w-4 h-4" />
                        Pesagens
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setPesagemEditando(null);
                          setPesagemModalOpen(true);
                        }}
                        className={`px-3 py-1.5 text-sm ${getPrimaryButtonClass(primaryColor)} text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm`}
                      >
                        <Icons.Plus className="w-4 h-4" />
                        Adicionar Pesagem
                      </button>
                    </div>

                    {pesagens.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                        Nenhuma pesagem cadastrada ainda.
                      </p>
                    ) : (
                      <>
                        {/* Evolução da pesagem - gráfico */}
                        {pesagens.length >= 2 && (() => {
                          const chartData = [...pesagens]
                            .sort((a, b) => {
                              const tA = parseDatePesagem(a.dataPesagem)?.getTime() ?? 0;
                              const tB = parseDatePesagem(b.dataPesagem)?.getTime() ?? 0;
                              return tA - tB;
                            })
                            .map((p) => ({
                              data: p.dataPesagem,
                              dataLabel: formatDateBR(p.dataPesagem),
                              peso: p.peso,
                            }));
                          const gmdAcumulado = calcularGMDAcumulado(pesagens);
                          return (
                            <div className="mb-5 p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 shadow-sm">
                              <div className="flex items-center gap-2 mb-3">
                                <Icons.TrendingUp className="w-5 h-5 text-gray-600 dark:text-slate-400" />
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                                  Evolução da pesagem
                                </h4>
                                {gmdAcumulado !== null && (
                                  <span className="text-xs font-semibold text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700/80 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-600">
                                    GMD médio: {gmdAcumulado.toFixed(2)} kg/dia
                                  </span>
                                )}
                              </div>
                              <ResponsiveContainer width="100%" height={200} className="min-w-0">
                                <LineChart data={chartData} margin={{ top: 5, right: 8, left: -10, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-gray-200 dark:stroke-slate-600" />
                                  <XAxis
                                    dataKey="dataLabel"
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    className="text-gray-600 dark:text-slate-400"
                                  />
                                  <YAxis
                                    tick={{ fontSize: 10 }}
                                    tickLine={false}
                                    className="text-gray-600 dark:text-slate-400"
                                    domain={["auto", "auto"]}
                                  />
                                  <Tooltip
                                    formatter={(value: number) => [`${value.toFixed(2)} kg`, "Peso"]}
                                    labelFormatter={(label) => `Data: ${label}`}
                                    contentStyle={{
                                      fontSize: 12,
                                      borderRadius: 8,
                                      border: "1px solid var(--border)",
                                    }}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="peso"
                                    name="Peso (kg)"
                                    stroke="var(--color-primary, #3b82f6)"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 5 }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()}

                        {/* Lista de pesagens - cards (ordenadas da mais recente para a mais antiga) */}
                        {(() => {
                          const pesagensOrdenadasDesc = [...pesagens].sort((a, b) => {
                            const tA = parseDatePesagem(a.dataPesagem)?.getTime() ?? 0;
                            const tB = parseDatePesagem(b.dataPesagem)?.getTime() ?? 0;
                            return tB - tA;
                          });
                          return (
                        <div className="space-y-3">
                          {pesagensOrdenadasDesc.map((pesagem, index) => {
                              const isUltima = index === 0;
                              const pesagemAnterior = index < pesagensOrdenadasDesc.length - 1 ? pesagensOrdenadasDesc[index + 1] : null;
                              const pesoAnterior = pesagemAnterior?.peso ?? null;
                              const diferenca = pesoAnterior !== null ? pesagem.peso - pesoAnterior : null;
                              const variacaoPercentual = pesoAnterior && pesoAnterior > 0 && diferenca !== null
                                ? ((diferenca / pesoAnterior) * 100).toFixed(1)
                                : null;
                              const gmd = pesagemAnterior
                                ? calcularGMD(pesagemAnterior.peso, pesagem.peso, pesagemAnterior.dataPesagem, pesagem.dataPesagem)
                                : null;
                              const dias = pesagemAnterior
                                ? (() => {
                                    const d1 = parseDatePesagem(pesagemAnterior.dataPesagem);
                                    const d2 = parseDatePesagem(pesagem.dataPesagem);
                                    if (!d1 || !d2) return null;
                                    const diff = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
                                    return diff > 0 ? diff : null;
                                  })()
                                : null;
                              const dataFormatada = formatDateBR(pesagem.dataPesagem);
                              return (
                                <div
                                  key={pesagem.id}
                                  className={`p-4 rounded-xl border shadow-sm transition-colors ${
                                    isUltima
                                      ? `${getThemeClasses(primaryColor, "border")} ${getThemeClasses(primaryColor, "bg-light")}`
                                      : "border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/80 hover:border-gray-300 dark:hover:border-slate-500"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                                          {dataFormatada}
                                        </span>
                                        {isUltima && (
                                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${getThemeClasses(primaryColor, "bg")} text-white`}>
                                            Mais recente
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                        <span className="font-bold text-gray-800 dark:text-slate-200">
                                          {pesagem.peso.toFixed(2)} kg
                                        </span>
                                        {diferenca !== null && (
                                          <span className={`text-xs flex items-center gap-1 ${
                                            diferenca > 0
                                              ? "text-green-600 dark:text-green-400"
                                              : diferenca < 0
                                                ? "text-red-600 dark:text-red-400"
                                                : "text-gray-500 dark:text-slate-400"
                                          }`}>
                                            {diferenca > 0 ? <Icons.ChevronUp className="w-3 h-3" /> : diferenca < 0 ? <Icons.ChevronDown className="w-3 h-3" /> : null}
                                            {diferenca > 0 ? "+" : ""}{diferenca.toFixed(2)} kg
                                            {variacaoPercentual && (
                                              <span className="text-gray-500 dark:text-slate-400">({variacaoPercentual}%)</span>
                                            )}
                                          </span>
                                        )}
                                        {gmd !== null && dias !== null && (
                                          <span className="text-xs text-gray-600 dark:text-slate-300">
                                            GMD: <span className="font-semibold">{gmd.toFixed(2)} kg/dia</span> ({dias} dia{dias === 1 ? "" : "s"})
                                          </span>
                                        )}
                                      </div>
                                      {pesagem.observacao && (
                                        <p className="text-xs text-gray-600 dark:text-slate-400 mt-1.5 truncate" title={pesagem.observacao}>
                                          {pesagem.observacao}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPesagemEditando(pesagem);
                                          setPesagemModalOpen(true);
                                        }}
                                        className={`p-2 rounded-lg transition-colors ${getPrimaryActionButtonLightClass(primaryColor)}`}
                                        title="Editar pesagem"
                                      >
                                        <Icons.Edit className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (confirm(`Deseja realmente excluir a pesagem de ${dataFormatada} (${pesagem.peso.toFixed(2)} kg)?`)) {
                                            try {
                                              const { uuid } = await import("../utils/uuid");
                                              const deletedId = uuid();
                                              await db.deletedRecords.add({
                                                id: deletedId,
                                                uuid: pesagem.id,
                                                remoteId: pesagem.remoteId || null,
                                                deletedAt: new Date().toISOString(),
                                                synced: false,
                                                entity: "pesagem",
                                              });
                                              if (pesagem.remoteId) {
                                                try {
                                                  const { supabase } = await import("../api/supabaseClient");
                                                  const { error } = await supabase.from("pesagens_online").delete().eq("id", pesagem.remoteId);
                                                  if (!error) await db.deletedRecords.update(deletedId, { synced: true });
                                                } catch (err) {
                                                  console.error("Erro ao excluir pesagem no servidor:", err);
                                                }
                                              } else {
                                                await db.deletedRecords.update(deletedId, { synced: true });
                                              }
                                              await db.pesagens.delete(pesagem.id);
                                              showToast({ type: "success", title: "Pesagem excluída", message: "A pesagem foi excluída com sucesso." });
                                            } catch (error) {
                                              console.error("Erro ao excluir pesagem:", error);
                                              showToast({ type: "error", title: "Erro ao excluir", message: "Não foi possível excluir a pesagem." });
                                            }
                                          }
                                        }}
                                        className="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        title="Excluir pesagem"
                                      >
                                        <Icons.Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-200/60 dark:border-slate-700/60">
                    <div className="text-center py-8">
                      <Icons.Scale className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Salve o animal primeiro para adicionar pesagens.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA: Vacinações */}
            {activeTab === "vacinacoes" && (
              <div className="space-y-4">
                {animalId ? (
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
                        <Icons.Injection className="w-4 h-4" />
                        Vacinações
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setVacinaEditando(null);
                          setVacinaModalOpen(true);
                        }}
                        className={`px-3 py-1.5 text-sm ${getPrimaryButtonClass(primaryColor)} text-white rounded-md hover:opacity-90 transition-opacity flex items-center gap-2`}
                      >
                        <Icons.Plus className="w-4 h-4" />
                        Adicionar Vacinação
                      </button>
                    </div>

                    {vacinacoes.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        Nenhuma vacinação cadastrada ainda.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {vacinacoes
                          .sort((a, b) => {
                            const dataA = a.dataAplicacao.includes("/")
                              ? a.dataAplicacao.split("/").reverse().join("-")
                              : a.dataAplicacao;
                            const dataB = b.dataAplicacao.includes("/")
                              ? b.dataAplicacao.split("/").reverse().join("-")
                              : b.dataAplicacao;
                            return (
                              new Date(dataB).getTime() -
                              new Date(dataA).getTime()
                            );
                          })
                          .map((vacina) => {
                            const dataFormatada = vacina.dataAplicacao.includes(
                              "/",
                            )
                              ? vacina.dataAplicacao
                              : vacina.dataAplicacao
                                  .split("-")
                                  .reverse()
                                  .join("/");
                            return (
                              <div
                                key={vacina.id}
                                className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 transition-colors"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <span className="font-medium text-gray-900 dark:text-slate-100">
                                      {vacina.vacina}
                                    </span>
                                    <span className="text-gray-600 dark:text-slate-400">
                                      {dataFormatada}
                                    </span>
                                    {vacina.dataVencimento && (
                                      <span className="text-sm text-gray-500 dark:text-slate-400">
                                        Venc:{" "}
                                        {vacina.dataVencimento.includes("/")
                                          ? vacina.dataVencimento
                                          : vacina.dataVencimento
                                              .split("-")
                                              .reverse()
                                              .join("/")}
                                      </span>
                                    )}
                                    {vacina.lote && (
                                      <span className="text-sm text-gray-500 dark:text-slate-400">
                                        Lote: {vacina.lote}
                                      </span>
                                    )}
                                  </div>
                                  {vacina.observacao && (
                                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                                      {vacina.observacao}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVacinaEditando(vacina);
                                      setVacinaModalOpen(true);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                                    title="Editar vacinação"
                                  >
                                    <Icons.Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const dataFormatada =
                                        vacina.dataAplicacao.includes("/")
                                          ? vacina.dataAplicacao
                                          : vacina.dataAplicacao
                                              .split("-")
                                              .reverse()
                                              .join("/");
                                      if (
                                        confirm(
                                          `Deseja realmente excluir a vacinação de ${vacina.vacina} aplicada em ${dataFormatada}?`,
                                        )
                                      ) {
                                        try {
                                          const { uuid } =
                                            await import("../utils/uuid");
                                          const deletedId = uuid();
                                          await db.deletedRecords.add({
                                            id: deletedId,
                                            uuid: vacina.id,
                                            remoteId: vacina.remoteId || null,
                                            deletedAt: new Date().toISOString(),
                                            synced: false,
                                            entity: "vacina",
                                          });

                                          if (vacina.remoteId) {
                                            try {
                                              const { supabase } =
                                                await import("../api/supabaseClient");
                                              const { error } = await supabase
                                                .from("vacinacoes_online")
                                                .delete()
                                                .eq("id", vacina.remoteId);

                                              if (!error) {
                                                await db.deletedRecords.update(
                                                  deletedId,
                                                  { synced: true },
                                                );
                                              }
                                            } catch (err) {
                                              console.error(
                                                "Erro ao excluir vacinação no servidor:",
                                                err,
                                              );
                                            }
                                          } else {
                                            await db.deletedRecords.update(
                                              deletedId,
                                              { synced: true },
                                            );
                                          }

                                          await db.vacinacoes.delete(vacina.id);
                                          showToast({
                                            type: "success",
                                            title: "Vacinação excluída",
                                            message:
                                              "A vacinação foi excluída com sucesso.",
                                          });
                                        } catch (error) {
                                          console.error(
                                            "Erro ao excluir vacinação:",
                                            error,
                                          );
                                          showToast({
                                            type: "error",
                                            title: "Erro ao excluir",
                                            message:
                                              "Não foi possível excluir a vacinação.",
                                          });
                                        }
                                      }
                                    }}
                                    className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                    title="Excluir vacinação"
                                  >
                                    <Icons.Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                    <div className="text-center py-8">
                      <Icons.Injection className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Salve o animal primeiro para adicionar vacinações.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA: Tags e Observações */}
            {activeTab === "tags" && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <Icons.Tag className="w-4 h-4" />
                    Tags e Observações
                  </h3>

                  <div className="space-y-4">
                    {/* Tags */}
                    <div>
                      <TagSelector
                        selectedTagIds={selectedTagIds}
                        onChange={setSelectedTagIds}
                        entityType="animal"
                      />
                    </div>

                    {/* Observações */}
                    <div>
                      <Textarea
                        {...(() => {
                          const { ref, onChange, onBlur, name, ...rest } =
                            register("obs");
                          return {
                            ...rest,
                            name,
                            value: obsWatch || "",
                            onChange: (
                              e: React.ChangeEvent<HTMLTextAreaElement>,
                            ) => {
                              onChange(e);
                              setValue("obs", e.target.value, {
                                shouldValidate: false,
                              });
                            },
                            onBlur,
                            ref,
                          };
                        })()}
                        label="Observações"
                        rows={3}
                        placeholder="Observações gerais sobre o animal..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Footer com Botões */}
          <div className="flex-shrink-0 flex gap-2 md:gap-3 px-3 sm:px-6 py-3 md:py-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Icons.X className="w-4 h-4" />
              Cancelar
            </button>
            <button
              type="submit"
              form="animal-form"
              disabled={saving}
              className={`flex-1 px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-base ${getPrimaryButtonClass(primaryColor)} text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {saving ? (
                <>
                  <Icons.Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Salvando...</span>
                </>
              ) : (
                <>
                  <Icons.Check className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {internalMode === "create"
                      ? "Cadastrar Animal"
                      : "Salvar Alterações"}
                  </span>
                  <span className="sm:hidden">
                    {internalMode === "create" ? "Salvar" : "Salvar"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modais de Cadastro Rápido */}
      <TipoAnimalModal
        open={tipoModalOpen}
        mode="create"
        onClose={() => setTipoModalOpen(false)}
        onSuccess={(tipoId) => {
          setValue("tipoId", tipoId);
          setTipoModalOpen(false);
        }}
      />

      <StatusAnimalModal
        open={statusModalOpen}
        mode="create"
        onClose={() => setStatusModalOpen(false)}
        onSuccess={(statusId) => {
          setValue("statusId", statusId);
          setStatusModalOpen(false);
        }}
      />

      {/* Modais de Pesagem e Vacinação */}
      {internalMode === "edit" && animalId && (
        <>
          <PesagemModal
            open={pesagemModalOpen}
            mode={pesagemEditando ? "edit" : "create"}
            animalId={animalId || ""}
            initialData={pesagemEditando || undefined}
            onClose={() => {
              setPesagemModalOpen(false);
              setPesagemEditando(null);
            }}
            onSaved={() => {
              // useLiveQuery atualiza automaticamente
              setPesagemModalOpen(false);
              setPesagemEditando(null);
            }}
            onEditPesagem={(pesagem) => {
              setPesagemEditando(pesagem);
            }}
          />

          <VacinaModal
            open={vacinaModalOpen}
            mode={vacinaEditando ? "edit" : "create"}
            animalId={animalId || ""}
            initialData={vacinaEditando || undefined}
            onClose={() => {
              setVacinaModalOpen(false);
              setVacinaEditando(null);
            }}
            onSaved={() => {
              // useLiveQuery atualiza automaticamente
              setVacinaModalOpen(false);
              setVacinaEditando(null);
            }}
            onEditVacina={(vacina) => {
              setVacinaEditando(vacina);
            }}
          />

          <DesmamaModal
            open={desmamaModalOpen}
            mode={desmamaEditando ? "edit" : "create"}
            animalId={animalId || ""}
            initialData={desmamaEditando || undefined}
            onClose={() => {
              setDesmamaModalOpen(false);
              setDesmamaEditando(null);
            }}
            onSaved={() => {
              // useLiveQuery atualiza automaticamente
              setDesmamaModalOpen(false);
              setDesmamaEditando(null);
            }}
          />
        </>
      )}
    </>
  );
}
