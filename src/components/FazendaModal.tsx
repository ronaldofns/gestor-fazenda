import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { Fazenda } from '../db/models';
import Modal from './Modal';
import { showToast } from '../utils/toast';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass } from '../utils/themeHelpers';
import { getThemeClasses } from '../utils/themeHelpers';

type Mode = 'create' | 'edit';

const schema = z.object({
  nome: z.string().min(1, 'Informe o nome da fazenda'),
  logoUrl: z.string().optional()
});

type FormDataFazenda = z.infer<typeof schema>;

interface FazendaModalProps {
  open: boolean;
  mode: Mode;
  initialData?: Fazenda | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function FazendaModal({
  open,
  mode,
  initialData,
  onClose,
  onSaved
}: FazendaModalProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titulo = mode === 'create' ? 'Nova Fazenda' : 'Editar Fazenda';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<FormDataFazenda>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: '',
      logoUrl: ''
    }
  });

  // Pré-carregar dados no modo edição
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      reset({
        nome: initialData.nome,
        logoUrl: initialData.logoUrl || ''
      });
    } else if (mode === 'create' && open) {
      reset({
        nome: '',
        logoUrl: ''
      });
    }
  }, [mode, initialData, reset, open]);

  const handleLimpar = () => {
    reset({
      nome: '',
      logoUrl: ''
    });
  };

  const onSubmit = async (values: FormDataFazenda) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();

      if (mode === 'edit' && initialData) {
        await db.fazendas.update(initialData.id, {
          nome: values.nome,
          logoUrl: values.logoUrl || undefined,
          updatedAt: now,
          synced: false
        });
        showToast({ type: 'success', title: 'Fazenda atualizada', message: values.nome });
      } else if (mode === 'create') {
        const newId = uuid();
        await db.fazendas.add({
          id: newId,
          nome: values.nome,
          logoUrl: values.logoUrl || undefined,
          createdAt: now,
          updatedAt: now,
          synced: false
        });
        showToast({ type: 'success', title: 'Fazenda cadastrada', message: values.nome });
      }

      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar fazenda:', error);
      showToast({ type: 'error', title: 'Erro ao salvar', message: 'Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const conteudoFormulario = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Nome da Fazenda *
        </label>
        <input
          type="text"
            className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
          placeholder="Ex: Fazenda Capenema III"
          {...register('nome')}
          autoFocus
        />
        {errors.nome && (
          <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.nome.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          URL do Logo (opcional)
        </label>
        <input
          type="url"
            className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
          placeholder="https://exemplo.com/logo.png"
          {...register('logoUrl')}
        />
      </div>

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
          {isSubmitting ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{titulo}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{conteudoFormulario}</div>
      </div>
    </Modal>
  );
}

