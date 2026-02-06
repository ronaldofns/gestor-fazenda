import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '../db/dexieDB';
import { StatusAnimal } from '../db/models';
import { uuid } from '../utils/uuid';
import { showToast } from '../utils/toast';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass } from '../utils/themeHelpers';
import Modal from './Modal';
import Input from './Input';
import Textarea from './Textarea';
import { msg } from '../utils/validationMessages';

const schemaStatusAnimal = z.object({
  nome: z.string().min(1, msg.obrigatorio),
  cor: z.string().optional(),
  descricao: z.string().optional(),
  ordem: z.preprocess((v) => (v === '' || v === null || v === undefined || (typeof v === 'number' && isNaN(v)) ? undefined : v), z.number().optional())
});

type FormDataStatusAnimal = z.infer<typeof schemaStatusAnimal>;

interface StatusAnimalModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: StatusAnimal | null;
  onClose: () => void;
  onSuccess?: (statusId: string) => void;
}

const CORES_PADRAO = [
  '#10b981', // Verde
  '#3b82f6', // Azul
  '#ef4444', // Vermelho
  '#f59e0b', // Amarelo
  '#ec4899', // Rosa
  '#8b5cf6', // Roxo
  '#6b7280', // Cinza
];

export default function StatusAnimalModal({
  open,
  mode,
  initialData,
  onClose,
  onSuccess
}: StatusAnimalModalProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [saving, setSaving] = useState(false);
  const [corSelecionada, setCorSelecionada] = useState('#10b981');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm<FormDataStatusAnimal>({
    resolver: zodResolver(schemaStatusAnimal)
  });

  useEffect(() => {
    if (open && mode === 'edit' && initialData) {
      setValue('nome', initialData.nome);
      setValue('descricao', initialData.descricao || '');
      setValue('cor', initialData.cor || '#10b981');
      setValue('ordem', initialData.ordem || 0);
      setCorSelecionada(initialData.cor || '#10b981');
    } else if (open && mode === 'create') {
      reset();
      setCorSelecionada('#10b981');
    }
  }, [open, mode, initialData, setValue, reset]);

  const onSubmit = async (data: FormDataStatusAnimal) => {
    setSaving(true);
    try {
      const now = new Date().toISOString();

      if (mode === 'create') {
        const novoStatus: StatusAnimal = {
          id: uuid(),
          nome: data.nome.trim(),
          cor: corSelecionada,
          descricao: data.descricao?.trim(),
          ordem: data.ordem || 99,
          ativo: true,
          createdAt: now,
          updatedAt: now,
          synced: false
        };

        await db.statusAnimal.add(novoStatus);
        showToast({ type: 'success', title: 'Status criado', message: novoStatus.nome });
        
        if (onSuccess) {
          onSuccess(novoStatus.id);
        }
      } else if (mode === 'edit' && initialData) {
        await db.statusAnimal.update(initialData.id, {
          nome: data.nome.trim(),
          cor: corSelecionada,
          descricao: data.descricao?.trim(),
          ordem: data.ordem,
          updatedAt: now,
          synced: false
        });

        showToast({ type: 'success', title: 'Status atualizado', message: data.nome });
      }

      onClose();
      reset();
    } catch (error: any) {
      console.error('Erro ao salvar status:', error);
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
            {mode === 'create' ? 'Novo Status de Animal' : 'Editar Status'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4" noValidate>
          {/* Nome */}
          <Input
            {...register('nome')}
            label="Nome do Status"
            type="text"
            required
            placeholder="Ex: Ativo, Vendido, Morto..."
            error={errors.nome?.message}
          />

          {/* Cor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Cor de Identificação
            </label>
            <div className="flex gap-2 flex-wrap">
              {CORES_PADRAO.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => {
                    setCorSelecionada(cor);
                    setValue('cor', cor);
                  }}
                  className={`w-10 h-10 rounded-full transition-all ${
                    corSelecionada === cor
                      ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: cor }}
                  title={cor}
                />
              ))}
            </div>
          </div>

          {/* Descrição */}
          <Textarea
            {...register('descricao')}
            label="Descrição (opcional)"
            rows={2}
            placeholder="Descrição do status..."
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
