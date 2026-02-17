import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexieDB";
import { uuid } from "../utils/uuid";
import { ConfinamentoAlimentacao } from "../db/models";
import Modal from "./Modal";
import Input from "./Input";
import Textarea from "./Textarea";
import { showToast } from "../utils/toast";
import { Icons } from "../utils/iconMapping";
import { useAppSettings } from "../hooks/useAppSettings";
import { ColorPaletteKey } from "../hooks/useThemeColors";
import { getPrimaryButtonClass } from "../utils/themeHelpers";
import { useAuth } from "../hooks/useAuth";
import {
  converterDataParaFormatoInput,
  converterDataParaFormatoBanco,
} from "../utils/dateInput";
import { createSyncEvent } from "../utils/syncEvents";
import { registrarAudit } from "../utils/audit";
import { msg } from "../utils/validationMessages";

const schema = z.object({
  data: z.string().min(1, msg.obrigatorio),
  tipoDieta: z.string().optional(),
  custoTotal: z.number().min(0).optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ConfinamentoAlimentacaoModalProps {
  open: boolean;
  mode: "create" | "edit";
  confinamentoId: string;
  initialData?: ConfinamentoAlimentacao | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ConfinamentoAlimentacaoModal({
  open,
  mode,
  confinamentoId,
  initialData,
  onClose,
  onSaved,
}: ConfinamentoAlimentacaoModalProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const confinamento = useLiveQuery(
    () => db.confinamentos.get(confinamentoId),
    [confinamentoId],
  );
  const titulo =
    mode === "create"
      ? "Adicionar Registro de Alimentação"
      : "Editar Alimentação";

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      data: "",
      tipoDieta: "",
      custoTotal: undefined,
      observacoes: "",
    },
  });

  useEffect(() => {
    if (mode === "edit" && initialData) {
      reset({
        data: converterDataParaFormatoInput(initialData.data),
        tipoDieta: initialData.tipoDieta || "",
        custoTotal: initialData.custoTotal ?? undefined,
        observacoes: initialData.observacoes || "",
      });
    } else if (mode === "create" && open && confinamento?.dataInicio) {
      reset({
        data: converterDataParaFormatoInput(confinamento.dataInicio),
        tipoDieta: "",
        custoTotal: undefined,
        observacoes: "",
      });
    }
  }, [mode, initialData, reset, open, confinamento?.dataInicio]);

  const onSubmit = async (values: FormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const dataBanco = converterDataParaFormatoBanco(values.data);
      const now = new Date().toISOString();
      const payload: Partial<ConfinamentoAlimentacao> = {
        confinamentoId,
        data: dataBanco,
        tipoDieta: values.tipoDieta || undefined,
        custoTotal: values.custoTotal ?? undefined,
        observacoes: values.observacoes || undefined,
        updatedAt: now,
        synced: false,
      };

      if (mode === "edit" && initialData) {
        await db.confinamentoAlimentacao.update(initialData.id, payload);
        if (user) {
          await registrarAudit({
            entity: "confinamentoAlimentacao",
            entityId: initialData.id,
            action: "update",
            userId: user.id,
            userNome: user.nome,
            before: JSON.stringify(initialData),
            after: JSON.stringify({ ...initialData, ...payload }),
          });
        }
        const atualizado = await db.confinamentoAlimentacao.get(initialData.id);
        if (atualizado)
          await createSyncEvent(
            "UPDATE",
            "confinamentoAlimentacao",
            initialData.id,
            atualizado,
          );
        showToast({
          type: "success",
          message: "Registro de alimentação atualizado.",
        });
      } else {
        const novoId = uuid();
        const novo: ConfinamentoAlimentacao = {
          id: novoId,
          ...payload,
          createdAt: now,
        } as ConfinamentoAlimentacao;
        await db.confinamentoAlimentacao.add(novo);
        if (user) {
          await registrarAudit({
            entity: "confinamentoAlimentacao",
            entityId: novoId,
            action: "create",
            userId: user.id,
            userNome: user.nome,
            after: JSON.stringify(novo),
          });
        }
        await createSyncEvent(
          "INSERT",
          "confinamentoAlimentacao",
          novoId,
          novo,
        );
        showToast({
          type: "success",
          message: "Registro de alimentação adicionado.",
        });
      }
      onSaved?.();
      onClose();
    } catch (error: any) {
      console.error("Erro ao salvar alimentação:", error);
      showToast({ type: "error", message: error.message || "Erro ao salvar" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 pt-6 pb-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {titulo}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        {confinamento && (
          <div className="px-6 pt-2">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Confinamento: {confinamento.nome}
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <Input
            label="Data"
            type="text"
            placeholder="DD/MM/YYYY"
            {...register("data")}
            error={errors.data?.message}
            required
          />
          <Input
            label="Tipo de dieta"
            type="text"
            placeholder="Ex.: Volumoso, Concentrado"
            {...register("tipoDieta")}
            error={errors.tipoDieta?.message}
          />
          <Input
            label="Custo total (R$)"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            {...register("custoTotal", { valueAsNumber: true })}
            error={errors.custoTotal?.message}
          />
          <Textarea
            label="Observações"
            {...register("observacoes")}
            error={errors.observacoes?.message}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-md hover:bg-gray-300 dark:hover:bg-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 text-sm text-white font-medium rounded-md ${getPrimaryButtonClass(primaryColor)} disabled:opacity-50`}
            >
              {isSubmitting
                ? "Salvando..."
                : mode === "create"
                  ? "Adicionar"
                  : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
