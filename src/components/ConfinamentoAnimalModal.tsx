import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexieDB";
import { uuid } from "../utils/uuid";
import { ConfinamentoAnimal, Animal } from "../db/models";
import Modal from "./Modal";
import Input from "./Input";
import Textarea from "./Textarea";
import AnimalSearchCombobox from "./AnimalSearchCombobox";
import AnimalModal from "./AnimalModal";
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
import {
  validarConfinamentoAnimal,
  validarEntradaAnimal,
} from "../utils/confinamentoRules";
import { createSyncEvent } from "../utils/syncEvents";
import { registrarAudit } from "../utils/audit";
import { msg } from "../utils/validationMessages";

const schema = z.object({
  animalId: z.string().min(1, msg.obrigatorio),
  dataEntrada: z.string().min(1, msg.obrigatorio),
  pesoEntrada: z
    .number()
    .min(0.01, "Peso deve ser maior que zero")
    .or(z.undefined()),
  dataSaida: z.string().optional(),
  pesoSaida: z.number().min(0).optional(),
  observacoes: z.string().optional(),
});

type FormDataConfinamentoAnimal = z.infer<typeof schema>;

interface ConfinamentoAnimalModalProps {
  open: boolean;
  mode: "create" | "edit";
  confinamentoId: string;
  initialData?: ConfinamentoAnimal | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ConfinamentoAnimalModal({
  open,
  mode,
  confinamentoId,
  initialData,
  onClose,
  onSaved,
}: ConfinamentoAnimalModalProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animalSelecionado, setAnimalSelecionado] = useState<Animal | null>(
    null,
  );
  const [modalAnimalOpen, setModalAnimalOpen] = useState(false);

  const titulo =
    mode === "create"
      ? "Adicionar Animal ao Confinamento"
      : "Editar Vínculo Animal-Confinamento";

  // Buscar confinamento
  const confinamento = useLiveQuery(
    () => db.confinamentos.get(confinamentoId),
    [confinamentoId],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<FormDataConfinamentoAnimal>({
    resolver: zodResolver(schema),
    defaultValues: {
      animalId: "",
      dataEntrada: "",
      pesoEntrada: undefined,
      dataSaida: "",
      pesoSaida: undefined as number | undefined,
      observacoes: "",
    },
  });

  const animalId = watch("animalId");

  // Carregar animal quando selecionado
  useEffect(() => {
    if (animalId) {
      db.animais.get(animalId).then((animal) => {
        setAnimalSelecionado(animal || null);
        // Preencher peso atual do animal se disponível
        if (animal && animal.pesoAtual && !watch("pesoEntrada")) {
          setValue("pesoEntrada", animal.pesoAtual);
        }
      });
    } else {
      setAnimalSelecionado(null);
    }
  }, [animalId, setValue, watch]);

  // Pré-carregar dados no modo edição; no modo criar, usar data de início do confinamento
  useEffect(() => {
    if (mode === "edit" && initialData) {
      reset({
        animalId: initialData.animalId,
        dataEntrada: converterDataParaFormatoInput(initialData.dataEntrada),
        pesoEntrada: initialData.pesoEntrada,
        dataSaida: initialData.dataSaida
          ? converterDataParaFormatoInput(initialData.dataSaida)
          : "",
        pesoSaida: initialData.pesoSaida ?? undefined,
        observacoes: initialData.observacoes || "",
      });
    } else if (mode === "create" && open) {
      const dataEntradaInicial = confinamento?.dataInicio
        ? converterDataParaFormatoInput(confinamento.dataInicio)
        : "";
      reset({
        animalId: "",
        dataEntrada: dataEntradaInicial,
        pesoEntrada: undefined,
        dataSaida: "",
        pesoSaida: undefined,
        observacoes: "",
      });
      setAnimalSelecionado(null);
    }
  }, [mode, initialData, reset, open, confinamento?.dataInicio]);

  const handleLimpar = () => {
    const dataEntradaPadrao = confinamento?.dataInicio
      ? converterDataParaFormatoInput(confinamento.dataInicio)
      : "";
    reset({
      animalId: "",
      dataEntrada: dataEntradaPadrao,
      pesoEntrada: undefined,
      dataSaida: "",
      pesoSaida: undefined,
      observacoes: "",
    });
    setAnimalSelecionado(null);
  };

  const onSubmit = async (values: FormDataConfinamentoAnimal) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Validar entrada do animal (regra: só pode ter 1 confinamento ativo)
      if (mode === "create") {
        const validacaoEntrada = await validarEntradaAnimal(
          values.animalId,
          confinamentoId,
        );
        if (!validacaoEntrada.valido) {
          showToast({
            type: "error",
            message: validacaoEntrada.erro || "Animal não pode ser adicionado",
          });
          setIsSubmitting(false);
          return;
        }
      }

      const dataEntradaBanco = converterDataParaFormatoBanco(
        values.dataEntrada,
      );

      const vínculoData: Partial<ConfinamentoAnimal> = {
        confinamentoId,
        animalId: values.animalId,
        dataEntrada: dataEntradaBanco,
        pesoEntrada: values.pesoEntrada,
        observacoes: values.observacoes || undefined,
        updatedAt: new Date().toISOString(),
        synced: false,
      };
      if (values.dataSaida?.trim()) {
        vínculoData.dataSaida = converterDataParaFormatoBanco(values.dataSaida);
      }
      if (values.pesoSaida != null && values.pesoSaida > 0) {
        vínculoData.pesoSaida = values.pesoSaida;
      }

      // Validação de regras de negócio
      const validacao = validarConfinamentoAnimal(vínculoData);
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
        // Atualizar vínculo existente
        await db.confinamentoAnimais.update(initialData.id, vínculoData);

        // Registrar auditoria
        if (user) {
          await registrarAudit({
            entity: "confinamentoAnimal",
            entityId: initialData.id,
            action: "update",
            userId: user.id,
            userNome: user.nome,
            before: JSON.stringify(initialData),
            after: JSON.stringify({ ...initialData, ...vínculoData }),
          });
        }

        // Criar evento de sincronização
        const vínculoAtualizado = await db.confinamentoAnimais.get(
          initialData.id,
        );
        if (vínculoAtualizado) {
          await createSyncEvent(
            "UPDATE",
            "confinamentoAnimal",
            initialData.id,
            vínculoAtualizado,
          );
        }

        showToast({
          type: "success",
          message: "Vínculo atualizado com sucesso!",
        });
      } else {
        // Criar novo vínculo
        const novoId = uuid();
        const novoVínculo: ConfinamentoAnimal = {
          ...(vínculoData as ConfinamentoAnimal),
          id: novoId,
          createdAt: now,
        };

        await db.confinamentoAnimais.add(novoVínculo);

        // Registrar auditoria
        if (user) {
          await registrarAudit({
            entity: "confinamentoAnimal",
            entityId: novoId,
            action: "create",
            userId: user.id,
            userNome: user.nome,
            after: JSON.stringify(novoVínculo),
          });
        }

        // Criar evento de sincronização
        await createSyncEvent(
          "INSERT",
          "confinamentoAnimal",
          novoId,
          novoVínculo,
        );

        showToast({
          type: "success",
          message: "Animal adicionado ao confinamento com sucesso!",
        });
      }

      onSaved?.();
      onClose();
    } catch (error: any) {
      console.error("Erro ao salvar vínculo animal-confinamento:", error);
      showToast({
        type: "error",
        message: error.message || "Erro ao salvar vínculo",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const conteudoFormulario = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {confinamento && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Confinamento:</strong> {confinamento.nome}
          </p>
        </div>
      )}

      {/* Animal */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Animal <span className="text-red-500">*</span>
        </label>
        <AnimalSearchCombobox
          value={watch("animalId")}
          onChange={(value) =>
            setValue("animalId", value, { shouldValidate: true })
          }
          disabled={mode === "edit"}
          onAddNew={() => setModalAnimalOpen(true)}
          addNewLabel="Novo animal"
        />
        {errors.animalId && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.animalId.message}
          </p>
        )}
        {animalSelecionado && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            <p>Brinco: {animalSelecionado.brinco}</p>
            {animalSelecionado.pesoAtual && (
              <p>Peso Atual: {animalSelecionado.pesoAtual.toFixed(2)} kg</p>
            )}
          </div>
        )}
      </div>

      {/* Data de Entrada */}
      <Input
        label="Data de Entrada"
        type="text"
        placeholder="DD/MM/YYYY"
        {...register("dataEntrada")}
        error={errors.dataEntrada?.message}
        required
      />

      {/* Peso de Entrada */}
      <Input
        label="Peso de Entrada (kg)"
        placeholder="Ex.: 180.00"
        type="number"
        step="0.01"
        min="0.01"
        {...register("pesoEntrada", { valueAsNumber: true })}
        error={errors.pesoEntrada?.message}
        required
      />

      {mode === "edit" && initialData?.dataSaida != null && (
        <>
          <Input
            label="Data de Saída"
            type="text"
            placeholder="DD/MM/YYYY"
            {...register("dataSaida")}
            error={errors.dataSaida?.message}
          />
          <Input
            label="Peso de Saída (kg)"
            type="number"
            step="0.01"
            min="0"
            {...register("pesoSaida", { valueAsNumber: true })}
            error={errors.pesoSaida?.message}
          />
        </>
      )}

      {/* Observações */}
      <Textarea
        label="Observações"
        {...register("observacoes")}
        error={errors.observacoes?.message}
        rows={3}
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
              ? "Adicionar"
              : "Salvar"}
        </button>
      </div>
    </form>
  );

  return (
    <>
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

      <AnimalModal
        open={modalAnimalOpen}
        mode="create"
        onClose={() => setModalAnimalOpen(false)}
        onSaved={async () => {
          setModalAnimalOpen(false);
          // Pequeno delay para a UI atualizar e o novo animal aparecer na busca
          setTimeout(() => {
            showToast({
              type: "success",
              message: "Animal criado! Agora você pode selecioná-lo.",
            });
          }, 300);
        }}
      />
    </>
  );
}
