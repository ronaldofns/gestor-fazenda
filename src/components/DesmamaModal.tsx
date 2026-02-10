import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Desmama } from '../db/models';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { showToast } from '../utils/toast';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { useAuth } from '../hooks/useAuth';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass } from '../utils/themeHelpers';
import { registrarAudit } from '../utils/audit';
import Modal from './Modal';
import Input from './Input';
import { converterDataParaFormatoInput, converterDataParaFormatoBanco } from '../utils/dateInput';
import { msg } from '../utils/validationMessages';
import { createSyncEvent } from '../utils/syncEvents';

const schemaDesmama = z.object({
  dataDesmama: z.string().min(1, msg.dataObrigatoria).regex(/^\d{2}\/\d{2}\/\d{4}$/, msg.formatoData),
  pesoDesmama: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      const parsed = parseFloat(String(val));
      return isNaN(parsed) ? undefined : parsed;
    },
    z.number({ invalid_type_error: msg.informeValor }).positive(msg.valorMaiorQueZero).min(0.01, msg.valorMaiorQueZero)
  )
});

type FormDataDesmama = z.infer<typeof schemaDesmama>;

interface DesmamaModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  animalId: string;
  initialData?: Desmama | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function DesmamaModal({ 
  open, 
  mode, 
  animalId,
  initialData, 
  onClose, 
  onSaved 
}: DesmamaModalProps) {
  const { user } = useAuth();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormDataDesmama>({
    resolver: zodResolver(schemaDesmama),
    defaultValues: {
      dataDesmama: '',
      pesoDesmama: undefined
    }
  });

  // Preencher form quando abrir em modo edição
  useEffect(() => {
    if (open && initialData) {
      reset({
        dataDesmama: initialData.dataDesmama ? converterDataParaFormatoInput(initialData.dataDesmama) : '',
        pesoDesmama: initialData.pesoDesmama || undefined
      });
    } else if (open && mode === 'create') {
      reset({
        dataDesmama: '',
        pesoDesmama: undefined
      });
    }
  }, [open, initialData, mode, reset]);

  const onSubmit = async (data: FormDataDesmama) => {
    if (!user) {
      showToast('Usuário não autenticado', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const dataDesmamaBanco = converterDataParaFormatoBanco(data.dataDesmama);

      if (mode === 'create') {
        const novaDesmama: Desmama = {
          id: uuid(),
          animalId: animalId,
          dataDesmama: dataDesmamaBanco,
          pesoDesmama: data.pesoDesmama,
          createdAt: now,
          updatedAt: now,
          synced: false,
          remoteId: null
        };

        await db.desmamas.add(novaDesmama);
        await createSyncEvent('INSERT', 'desmama', novaDesmama.id, novaDesmama);

        await registrarAudit({
          entity: 'desmama',
          entityId: novaDesmama.id,
          action: 'create',
          user: { id: user.id, nome: user.nome || '' },
          description: `Desmama cadastrada para animal ${animalId}`
        });

        showToast('Desmama cadastrada com sucesso!', 'success');
      } else {
        if (!initialData?.id) {
          showToast('ID da desmama não encontrado', 'error');
          return;
        }

        await db.desmamas.update(initialData.id, {
          dataDesmama: dataDesmamaBanco,
          pesoDesmama: data.pesoDesmama,
          updatedAt: now,
          synced: false
        });
        const desmamaAtualizada = await db.desmamas.get(initialData.id);
        if (desmamaAtualizada) {
          await createSyncEvent('UPDATE', 'desmama', initialData.id, desmamaAtualizada);
        }

        await registrarAudit({
          entity: 'desmama',
          entityId: initialData.id,
          action: 'update',
          user: { id: user.id, nome: user.nome || '' },
          description: `Desmama atualizada para animal ${animalId}`
        });

        showToast('Desmama atualizada com sucesso!', 'success');
      }

      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar desmama:', error);
      showToast('Erro ao salvar desmama', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header fixo */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${primaryColor === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' : primaryColor === 'green' ? 'bg-green-100 dark:bg-green-900/30' : primaryColor === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
              <Icons.Baby className={`w-5 h-5 ${primaryColor === 'blue' ? 'text-blue-600 dark:text-blue-400' : primaryColor === 'green' ? 'text-green-600 dark:text-green-400' : primaryColor === 'purple' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}`} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {mode === 'create' ? 'Registrar Desmama' : 'Editar Desmama'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Informe a data e peso da desmama do animal
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              <Icons.X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Conteúdo com scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {/* Card com campos */}
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Data Desmama */}
                <Controller
                  name="dataDesmama"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-1.5">
                      <Input
                        label="Data da Desmama"
                        type="text"
                        placeholder="DD/MM/YYYY"
                        error={errors.dataDesmama?.message}
                        required
                        {...field}
                      />
                      <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Icons.Calendar className="w-3.5 h-3.5" />
                        Data em que o animal foi desmamado
                      </p>
                    </div>
                  )}
                />

                {/* Peso Desmama */}
                <Controller
                  name="pesoDesmama"
                  control={control}
                  render={({ field: { value, ...rest } }) => (
                    <div className="space-y-1.5">
                      <Input
                        label="Peso na Desmama (kg)"
                        type="number"
                        step="0.1"
                        placeholder="Ex: 180.5"
                        error={errors.pesoDesmama?.message}
                        required
                        value={value ?? ''}
                        {...rest}
                      />
                      <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Icons.Scale className="w-3.5 h-3.5" />
                        Peso do animal no momento da desmama
                      </p>
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors font-medium flex items-center justify-center gap-2"
                disabled={isSubmitting}
              >
                <Icons.X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                type="submit"
                className={`flex-1 px-4 py-2.5 ${getPrimaryButtonClass(primaryColor)} text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 shadow-sm`}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Icons.Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Icons.Save className="w-4 h-4" />
                    Salvar Desmama
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
