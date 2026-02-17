import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { db } from "../db/dexieDB";
import { uuid } from "../utils/uuid";
import { ConfinamentoAnimal, Animal, Pesagem } from "../db/models";
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
  confinamentoAnimalId: z.string().min(1, msg.obrigatorio),
  data: z.string().min(1, msg.obrigatorio),
  peso: z.number().min(0.01, "Peso deve ser maior que zero"),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ConfinamentoPesagemModalProps {
  open: boolean;
  confinamentoId: string;
  vinculosAtivos: ConfinamentoAnimal[];
  animaisMap: Map<string, Animal>;
  dataInicioConfinamento?: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ConfinamentoPesagemModal({
  open,
  vinculosAtivos,
  animaisMap,
  dataInicioConfinamento,
  onClose,
  onSaved,
}: ConfinamentoPesagemModalProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buscaOuExibe, setBuscaOuExibe] = useState("");
  const [dropdownAberto, setDropdownAberto] = useState(false);

  const opcoesAnimais = useMemo(() => {
    return vinculosAtivos.map((v) => {
      const animal = animaisMap.get(v.animalId);
      const brinco = animal?.brinco != null ? String(animal.brinco) : "";
      const nome = animal?.nome ?? "";
      const label = nome
        ? `${brinco} - ${nome}`
        : brinco || v.animalId.slice(0, 8);
      return { label, value: v.id, brinco, nome };
    });
  }, [vinculosAtivos, animaisMap]);

  const opcoesFiltradas = useMemo(() => {
    const term = buscaOuExibe.trim().toLowerCase();
    if (!term) return opcoesAnimais;
    return opcoesAnimais.filter(
      (o) =>
        o.brinco.toLowerCase().includes(term) ||
        o.nome.toLowerCase().includes(term),
    );
  }, [opcoesAnimais, buscaOuExibe]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      confinamentoAnimalId: "",
      data: "",
      peso: undefined,
      observacoes: "",
    },
  });

  const confinamentoAnimalId = watch("confinamentoAnimalId");

  useEffect(() => {
    if (open && vinculosAtivos.length > 0) {
      reset({
        confinamentoAnimalId: "",
        data: converterDataParaFormatoInput(
          new Date().toISOString().slice(0, 10),
        ),
        peso: undefined,
        observacoes: "",
      });
      setBuscaOuExibe("");
    }
  }, [open, reset, vinculosAtivos.length]);

  useEffect(() => {
    if (confinamentoAnimalId) {
      const op = opcoesAnimais.find((o) => o.value === confinamentoAnimalId);
      setBuscaOuExibe(op ? op.label : "");
    } else {
      setBuscaOuExibe("");
    }
  }, [confinamentoAnimalId, opcoesAnimais]);

  useEffect(() => {
    const v = vinculosAtivos.find((x) => x.id === confinamentoAnimalId);
    if (v && animaisMap.get(v.animalId)?.pesoAtual != null) {
      const pesoAtual = animaisMap.get(v.animalId)!.pesoAtual!;
      if (watch("peso") === 0) setValue("peso", pesoAtual);
    }
  }, [confinamentoAnimalId, vinculosAtivos, animaisMap, setValue, watch]);

  const onSubmit = async (values: FormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const dataBanco = converterDataParaFormatoBanco(values.data);
      // Encontrar vínculo para obter animalId
      const vinculo = vinculosAtivos.find(
        (v) => v.id === values.confinamentoAnimalId,
      );
      if (!vinculo) {
        showToast({
          type: "error",
          message: "Vínculo do animal não encontrado.",
        });
        setIsSubmitting(false);
        return;
      }
      const animalId = vinculo.animalId;

      const { validarPesagemUnica } =
        await import("../utils/unicidadeValidation");
      const unico = await validarPesagemUnica(animalId, dataBanco);
      if (!unico.valido) {
        showToast({
          type: "error",
          message: unico.erro || "Já existe uma pesagem para essa data.",
        });
        setIsSubmitting(false);
        return;
      }

      const now = new Date().toISOString();
      const novoId = uuid();
      const novo: Pesagem = {
        id: novoId,
        animalId,
        dataPesagem: dataBanco,
        peso: values.peso,
        observacao: values.observacoes || undefined,
        createdAt: now,
        updatedAt: now,
        synced: false,
      };

      await db.pesagens.add(novo);
      if (user) {
        await registrarAudit({
          entity: "pesagem",
          entityId: novoId,
          action: "create",
          userId: user.id,
          userNome: user.nome,
          after: JSON.stringify(novo),
        });
      }
      await createSyncEvent("INSERT", "pesagem", novoId, novo);
      showToast({ type: "success", message: "Pesagem registrada." });
      onSaved?.();
      onClose();
    } catch (error: any) {
      console.error("Erro ao registrar pesagem:", error);
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
            Registrar pesagem
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Animal no confinamento <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Digite o brinco ou nome e escolha na lista"
              value={buscaOuExibe}
              onChange={(e) => {
                setBuscaOuExibe(e.target.value);
                setDropdownAberto(true);
                if (!e.target.value.trim())
                  setValue("confinamentoAnimalId", "");
              }}
              onFocus={() => setDropdownAberto(true)}
              onBlur={() => setTimeout(() => setDropdownAberto(false), 200)}
              className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
            />
            <Icons.ChevronDown className="absolute right-3 top-9 w-4 h-4 text-gray-400 pointer-events-none" />
            {dropdownAberto && (
              <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md shadow-lg max-h-48 overflow-auto">
                {opcoesFiltradas.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-500 dark:text-slate-400">
                    {opcoesAnimais.length === 0
                      ? "Nenhum animal no confinamento"
                      : `Nenhum animal com "${buscaOuExibe.trim()}"`}
                  </p>
                ) : (
                  opcoesFiltradas.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        setValue("confinamentoAnimalId", o.value);
                        setBuscaOuExibe(o.label);
                        setDropdownAberto(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700 first:rounded-t-md last:rounded-b-md"
                    >
                      {o.label}
                    </button>
                  ))
                )}
              </div>
            )}
            <input type="hidden" {...register("confinamentoAnimalId")} />
            {errors.confinamentoAnimalId && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.confinamentoAnimalId.message}
              </p>
            )}
          </div>
          <Input
            label="Data da pesagem"
            type="text"
            placeholder="DD/MM/YYYY"
            {...register("data")}
            error={errors.data?.message}
            required
          />
          <Input
            label="Peso (kg)"
            type="number"
            step="0.01"
            min="0.01"
            {...register("peso", { valueAsNumber: true })}
            error={errors.peso?.message}
            required
          />
          <Textarea
            label="Observações"
            {...register("observacoes")}
            error={errors.observacoes?.message}
            rows={2}
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
              {isSubmitting ? "Salvando..." : "Registrar pesagem"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
