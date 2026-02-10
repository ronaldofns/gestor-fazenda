import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { OcorrenciaAnimal, OcorrenciaTipo } from '../db/models';
import Modal from './Modal';
import Input from './Input';
import Textarea from './Textarea';
import { showToast } from '../utils/toast';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass } from '../utils/themeHelpers';
import { useAuth } from '../hooks/useAuth';
import { converterDataParaFormatoInput, converterDataParaFormatoBanco } from '../utils/dateInput';
import { msg } from '../utils/validationMessages';
import { createSyncEvent } from '../utils/syncEvents';
import { registrarAudit } from '../utils/audit';

const TIPOS: { value: OcorrenciaTipo; label: string }[] = [
  { value: 'doenca', label: 'Doença' },
  { value: 'tratamento', label: 'Tratamento' },
  { value: 'morte', label: 'Morte' },
  { value: 'outro', label: 'Outro' }
];

const schema = z.object({
  data: z.string().min(1, msg.obrigatorio),
  tipo: z.enum(['doenca', 'tratamento', 'morte', 'outro']),
  custo: z.number().min(0).optional(),
  observacoes: z.string().optional()
});

type FormData = z.infer<typeof schema>;

interface OcorrenciaAnimalModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  animalId: string;
  confinamentoAnimalId?: string;
  initialData?: OcorrenciaAnimal | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function OcorrenciaAnimalModal({
  open,
  mode,
  animalId,
  confinamentoAnimalId,
  initialData,
  onClose,
  onSaved
}: OcorrenciaAnimalModalProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const titulo = mode === 'create' ? 'Nova Ocorrência' : 'Editar Ocorrência';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      data: '',
      tipo: 'tratamento',
      custo: undefined,
      observacoes: ''
    }
  });

  useEffect(() => {
    if (mode === 'edit' && initialData) {
      reset({
        data: converterDataParaFormatoInput(initialData.data),
        tipo: initialData.tipo,
        custo: initialData.custo ?? undefined,
        observacoes: initialData.observacoes || ''
      });
    } else if (mode === 'create' && open) {
      const hoje = new Date().toISOString().split('T')[0];
      reset({
        data: converterDataParaFormatoInput(hoje),
        tipo: 'tratamento',
        custo: undefined,
        observacoes: ''
      });
    }
  }, [mode, initialData, reset, open]);

  const onSubmit = async (values: FormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const dataBanco = converterDataParaFormatoBanco(values.data);
      const now = new Date().toISOString();

      if (mode === 'edit' && initialData) {
        await db.ocorrenciaAnimais.update(initialData.id, {
          data: dataBanco,
          tipo: values.tipo,
          custo: values.custo,
          observacoes: values.observacoes?.trim() || undefined,
          updatedAt: now,
          synced: false
        });
        const atualizado = await db.ocorrenciaAnimais.get(initialData.id);
        if (atualizado) await createSyncEvent('UPDATE', 'ocorrenciaAnimal', initialData.id, atualizado);
        if (user) {
          registrarAudit({
            entity: 'ocorrenciaAnimal',
            entityId: initialData.id,
            action: 'update',
            userId: user.id,
            userNome: user.nome,
            description: `Ocorrência (${values.tipo}) atualizada`
          });
        }
        showToast({ type: 'success', message: 'Ocorrência atualizada.' });
      } else {
        const novo: OcorrenciaAnimal = {
          id: uuid(),
          animalId,
          confinamentoAnimalId,
          data: dataBanco,
          tipo: values.tipo,
          custo: values.custo,
          observacoes: values.observacoes?.trim() || undefined,
          createdAt: now,
          updatedAt: now,
          synced: false
        };
        await db.ocorrenciaAnimais.add(novo);
        await createSyncEvent('INSERT', 'ocorrenciaAnimal', novo.id, novo);
        if (user) {
          registrarAudit({
            entity: 'ocorrenciaAnimal',
            entityId: novo.id,
            action: 'create',
            userId: user.id,
            userNome: user.nome,
            description: `Ocorrência (${values.tipo}) registrada`
          });
        }
        showToast({ type: 'success', message: 'Ocorrência registrada.' });
      }
      onSaved?.();
      onClose();
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Erro ao salvar' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 pt-6 pb-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <Input
            label="Data"
            type="text"
            placeholder="DD/MM/YYYY"
            {...register('data')}
            error={errors.data?.message}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tipo</label>
            <select
              {...register('tipo')}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 px-3 py-2"
            >
              {TIPOS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <Input
            label="Custo (R$) — opcional"
            type="number"
            step="0.01"
            min={0}
            {...register('custo', { valueAsNumber: true })}
            error={errors.custo?.message}
          />
          <Textarea
            label="Observações"
            {...register('observacoes')}
            error={errors.observacoes?.message}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 text-sm rounded-lg text-white ${getPrimaryButtonClass(primaryColor)} disabled:opacity-50`}
            >
              {isSubmitting ? 'Salvando...' : mode === 'create' ? 'Registrar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
