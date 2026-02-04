import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '../db/dexieDB';
import { TipoAnimal } from '../db/models';
import { uuid } from '../utils/uuid';
import { showToast } from '../utils/toast';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass } from '../utils/themeHelpers';
import Modal from './Modal';
import Input from './Input';
import Textarea from './Textarea';

const schemaTipoAnimal = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  descricao: z.string().optional(),
  ordem: z.number().optional()
});

type FormDataTipoAnimal = z.infer<typeof schemaTipoAnimal>;

interface TipoAnimalModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: TipoAnimal | null;
  onClose: () => void;
  onSuccess?: (tipoId: string) => void;
}

export default function TipoAnimalModal({
  open,
  mode,
  initialData,
  onClose,
  onSuccess
}: TipoAnimalModalProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm<FormDataTipoAnimal>({
    resolver: zodResolver(schemaTipoAnimal)
  });

  useEffect(() => {
    if (open && mode === 'edit' && initialData) {
      setValue('nome', initialData.nome);
      setValue('descricao', initialData.descricao || '');
      setValue('ordem', initialData.ordem || 0);
    } else if (open && mode === 'create') {
      reset();
    }
  }, [open, mode, initialData, setValue, reset]);

  const onSubmit = async (data: FormDataTipoAnimal) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();

      if (mode === 'create') {
        const novoTipo: TipoAnimal = {
          id: uuid(),
          nome: data.nome.trim(),
          descricao: data.descricao?.trim(),
          ordem: data.ordem || 99,
          ativo: true,
          createdAt: now,
          updatedAt: now,
          synced: false
        };

        await db.tiposAnimal.add(novoTipo);
        showToast({ type: 'success', title: 'Tipo criado', message: novoTipo.nome });
        
        if (onSuccess) {
          onSuccess(novoTipo.id);
        }
      } else if (mode === 'edit' && initialData) {
        await db.tiposAnimal.update(initialData.id, {
          nome: data.nome.trim(),
          descricao: data.descricao?.trim(),
          ordem: data.ordem,
          updatedAt: now,
          synced: false
        });

        showToast({ type: 'success', title: 'Tipo atualizado', message: data.nome });
      }

      onClose();
      reset();
    } catch (error: any) {
      console.error('Erro ao salvar tipo:', error);
      showToast({ type: 'error', title: 'Erro ao salvar', message: error?.message || 'Tente novamente' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            {mode === 'create' ? 'Novo Tipo de Animal' : 'Editar Tipo'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* Nome */}
          <Input
            {...register('nome')}
            label="Nome do Tipo"
            type="text"
            required
            placeholder="Ex: Bezerro, Vaca, Touro..."
            error={errors.nome?.message}
          />

          {/* Descrição */}
          <Textarea
            {...register('descricao')}
            label="Descrição (opcional)"
            rows={2}
            placeholder="Ex: Macho até 12 meses..."
          />

          {/* Ordem */}
          <Input
            {...register('ordem', { valueAsNumber: true })}
            label="Ordem de Exibição"
            type="number"
            min="0"
            placeholder="0"
          />

          {/* Botões */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 px-4 py-2 ${getPrimaryButtonClass(primaryColor)} text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {saving ? (
                <>
                  <Icons.Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Icons.Check className="w-4 h-4" />
                  {mode === 'create' ? 'Criar' : 'Salvar'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
