import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexieDB";
import { uuid } from "../utils/uuid";
import { Confinamento } from "../db/models";
import Modal from "./Modal";
import Input from "./Input";
import Textarea from "./Textarea";
import Combobox, { ComboboxOption } from "./Combobox";
import { showToast } from "../utils/toast";
import { Icons } from "../utils/iconMapping";
import { useAppSettings } from "../hooks/useAppSettings";
import { ColorPaletteKey } from "../hooks/useThemeColors";
import { getPrimaryButtonClass } from "../utils/themeHelpers";
import { useAuth } from "../hooks/useAuth";
import { useFazendaContext } from "../hooks/useFazendaContext";
import {
  converterDataParaFormatoInput,
  converterDataParaFormatoBanco,
} from "../utils/dateInput";
import { validarConfinamento } from "../utils/confinamentoRules";
import { createSyncEvent } from "../utils/syncEvents";
import { registrarAudit } from "../utils/audit";
import { msg } from "../utils/validationMessages";

const schema = z.object({
  nome: z.string().min(1, msg.obrigatorio),
  fazendaId: z.string().min(1, msg.obrigatorio),
  dataInicio: z.string().min(1, msg.obrigatorio),
  dataFimPrevista: z.string().optional(),
  status: z.enum(["ativo", "finalizado", "cancelado"]),
  precoVendaKg: z
    .string()
    .optional()
    .transform((s) => {
      if (s == null || String(s).trim() === "") return undefined;
      const normalized = String(s).trim().replace(",", ".");
      const n = parseFloat(normalized);
      return isNaN(n) ? undefined : n;
    }),
  observacoes: z.string().optional(),
});

type FormDataConfinamento = z.infer<typeof schema>;

interface ConfinamentoModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialData?: Confinamento | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ConfinamentoModal({
  open,
  mode,
  initialData,
  onClose,
  onSaved,
}: ConfinamentoModalProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;
  const { user } = useAuth();
  const { fazendaSelecionada } = useFazendaContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titulo =
    mode === "create" ? "Novo Confinamento" : "Editar Confinamento";

  // Buscar fazendas
  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const fazendas: ComboboxOption[] = fazendasRaw.map((f) => ({
    label: f.nome,
    value: f.id,
  }));

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormDataConfinamento>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      fazendaId: fazendaSelecionada?.id || "",
      dataInicio: "",
      dataFimPrevista: "",
      status: "ativo",
      precoVendaKg: "",
      observacoes: "",
    },
  });

  const statusSelecionado = watch("status");

  // Formata número para exibição com vírgula (pt-BR)
  const precoVendaKgParaForm = (value: number | undefined | null): string => {
    if (value == null || (typeof value === "number" && isNaN(value))) return "";
    return String(value).replace(".", ",");
  };

  // Pré-carregar dados no modo edição (precoVendaKg sempre string com vírgula para o input)
  useEffect(() => {
    if (mode === "edit" && initialData) {
      reset({
        nome: initialData.nome,
        fazendaId: initialData.fazendaId,
        dataInicio: converterDataParaFormatoInput(initialData.dataInicio),
        dataFimPrevista: initialData.dataFimPrevista
          ? converterDataParaFormatoInput(initialData.dataFimPrevista)
          : "",
        status: initialData.status,
        precoVendaKg:
          initialData.precoVendaKg != null
            ? String(initialData.precoVendaKg).replace(".", ",")
            : "",
        observacoes: initialData.observacoes || "",
      });
    } else if (mode === "create" && open) {
      reset({
        nome: "",
        fazendaId: fazendaSelecionada?.id || "",
        dataInicio: "",
        dataFimPrevista: "",
        status: "ativo",
        precoVendaKg: "",
        observacoes: "",
      });
    }
  }, [mode, initialData, reset, open, fazendaSelecionada]);

  const handleLimpar = () => {
    reset({
      nome: "",
      fazendaId: fazendaSelecionada?.id || "",
      dataInicio: "",
      dataFimPrevista: "",
      status: "ativo",
      precoVendaKg: mode === "edit" && initialData ? precoVendaKgParaForm(initialData.precoVendaKg) : "",
      observacoes: "",
    });
  };

  const onSubmit = async (values: FormDataConfinamento) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const dataInicioBanco = converterDataParaFormatoBanco(values.dataInicio);
      const dataFimPrevistaBanco = values.dataFimPrevista
        ? converterDataParaFormatoBanco(values.dataFimPrevista)
        : undefined;

      const confinamentoData: Partial<Confinamento> = {
        nome: values.nome,
        fazendaId: values.fazendaId,
        dataInicio: dataInicioBanco,
        dataFimPrevista: dataFimPrevistaBanco,
        status: values.status,
        precoVendaKg: values.precoVendaKg,
        observacoes: values.observacoes || undefined,
        updatedAt: new Date().toISOString(),
        synced: false,
      };

      // Validação de regras de negócio
      const validacao = validarConfinamento(confinamentoData);
      if (!validacao.valido) {
        showToast({
          type: "error",
          message: validacao.erro || "Dados inválidos",
        });
        setIsSubmitting(false);
        return;
      }

      const now = new Date().toISOString();

      if (mode === "edit" && initialData) {
        // Atualizar confinamento existente
        await db.confinamentos.update(initialData.id, confinamentoData);

        // Registrar auditoria
        if (user) {
          await registrarAudit({
            entity: "confinamento",
            entityId: initialData.id,
            action: "update",
            userId: user.id,
            userNome: user.nome,
            before: JSON.stringify(initialData),
            after: JSON.stringify({ ...initialData, ...confinamentoData }),
          });
        }

        // Criar evento de sincronização
        const confinamentoAtualizado = await db.confinamentos.get(
          initialData.id,
        );
        if (confinamentoAtualizado) {
          await createSyncEvent(
            "UPDATE",
            "confinamento",
            initialData.id,
            confinamentoAtualizado,
          );
        }

        showToast({
          type: "success",
          message: "Confinamento atualizado com sucesso!",
        });
      } else {
        // Criar novo confinamento
        const novoId = uuid();
        const novoConfinamento: Confinamento = {
          ...(confinamentoData as Confinamento),
          id: novoId,
          createdAt: now,
        };

        await db.confinamentos.add(novoConfinamento);

        // Registrar auditoria
        if (user) {
          await registrarAudit({
            entity: "confinamento",
            entityId: novoId,
            action: "create",
            userId: user.id,
            userNome: user.nome,
            after: JSON.stringify(novoConfinamento),
          });
        }

        // Criar evento de sincronização
        await createSyncEvent(
          "INSERT",
          "confinamento",
          novoId,
          novoConfinamento,
        );

        showToast({
          type: "success",
          message: "Confinamento criado com sucesso!",
        });
      }

      onSaved?.();
      onClose();
    } catch (error: any) {
      console.error("Erro ao salvar confinamento:", error);
      showToast({
        type: "error",
        message: error.message || "Erro ao salvar confinamento",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const conteudoFormulario = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Nome */}
      <Input
        label="Nome do Confinamento"
        placeholder="Ex: Confinamento Maio/2026 – Terminação"
        {...register("nome")}
        error={errors.nome?.message}
        required
        autoFocus
      />

      {/* Fazenda */}
      <Combobox
        label="Fazenda"
        value={watch("fazendaId")}
        onChange={(value) =>
          setValue("fazendaId", value, { shouldValidate: true })
        }
        options={fazendas}
        placeholder="Selecione a fazenda"
        error={errors.fazendaId?.message}
        required
      />

      {/* Data de Início */}
      <Input
        label="Data de Início"
        type="text"
        placeholder="DD/MM/YYYY"
        {...register("dataInicio")}
        error={errors.dataInicio?.message}
        required
      />

      {/* Data Fim Prevista */}
      <Input
        label="Data Fim Prevista (opcional)"
        type="text"
        placeholder="DD/MM/YYYY"
        {...register("dataFimPrevista")}
        error={errors.dataFimPrevista?.message}
      />

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Status <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          {(["ativo", "finalizado", "cancelado"] as const).map((status) => (
            <label key={status} className="flex items-center cursor-pointer">
              <input
                type="radio"
                value={status}
                checked={statusSelecionado === status}
                onChange={(e) =>
                  setValue("status", e.target.value as any, {
                    shouldValidate: true,
                  })
                }
                className="mr-2"
              />
              <span className="text-sm capitalize">{status}</span>
            </label>
          ))}
        </div>
        {errors.status && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.status.message}
          </p>
        )}
      </div>

      {/* Preço venda/kg (para margem estimada) */}
      <Input
        label="Preço venda/kg (R$) — opcional"
        type="text"
        inputMode="decimal"
        placeholder="Ex: 15,50 — para ver margem estimada nos indicadores"
        {...register("precoVendaKg")}
        error={errors.precoVendaKg?.message}
      />

      {/* Observações */}
      <Textarea
        label="Observações"
        {...register("observacoes")}
        error={errors.observacoes?.message}
        rows={4}
      />

      {/* Botões */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-slate-700">
        <button
          type="button"
          onClick={handleLimpar}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`px-4 py-2 text-sm ${getPrimaryButtonClass(primaryColor)} text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50`}
        >
          {isSubmitting
            ? "Salvando..."
            : mode === "create"
              ? "Criar"
              : "Salvar"}
        </button>
      </div>
    </form>
  );

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 pt-6 pb-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {titulo}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pt-6 pb-8">{conteudoFormulario}</div>
      </div>
    </Modal>
  );
}
