import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { Fazenda } from '../db/models';
import Modal from './Modal';
import TagSelector from './TagSelector';
import Input from './Input';
import { showToast } from '../utils/toast';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass } from '../utils/themeHelpers';
import { useAuth } from '../hooks/useAuth';

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
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

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
      
      // Carregar tags da fazenda
      db.tagAssignments
        .where({ entityId: initialData.id, entityType: 'fazenda' })
        .filter(a => !a.deletedAt)
        .toArray()
        .then(assignments => {
          const tagIds = assignments.map(a => a.tagId);
          setSelectedTagIds(tagIds);
        })
        .catch(err => console.error('Erro ao carregar tags da fazenda:', err));
    } else if (mode === 'create' && open) {
      reset({
        nome: '',
        logoUrl: ''
      });
      setSelectedTagIds([]);
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
        
        // Atualizar tags
        if (user) {
          const currentAssignments = await db.tagAssignments
            .where({ entityId: initialData.id, entityType: 'fazenda' })
            .toArray();
          const currentTagIds = currentAssignments.map(a => a.tagId);

          const tagsToRemove = currentTagIds.filter(id => !selectedTagIds.includes(id));
          for (const assignment of currentAssignments) {
            if (tagsToRemove.includes(assignment.tagId)) {
              await db.tagAssignments.update(assignment.id, {
                deletedAt: now,
                synced: false
              });
              const tag = await db.tags.get(assignment.tagId);
              if (tag && tag.usageCount > 0) {
                await db.tags.update(assignment.tagId, {
                  usageCount: tag.usageCount - 1,
                  synced: false
                });
              }
            }
          }

          const tagsToAdd = selectedTagIds.filter(id => !currentTagIds.includes(id));
          if (tagsToAdd.length > 0) {
            const newAssignments = tagsToAdd.map(tagId => ({
              id: uuid(),
              entityId: initialData.id,
              entityType: 'fazenda' as const,
              tagId,
              assignedBy: user.id,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
              synced: false,
              remoteId: null
            }));
            
            await db.tagAssignments.bulkAdd(newAssignments);
            
            // 🔧 FIX: Recalcular usageCount baseado em assignments reais
            const { recalculateTagUsage } = await import('../utils/fixTagUsageCount');
            for (const tagId of tagsToAdd) {
              await recalculateTagUsage(tagId);
            }
          }
        }
        
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
        
        // Salvar tags
        if (selectedTagIds.length > 0 && user) {
          const tagAssignments = selectedTagIds.map(tagId => ({
            id: uuid(),
            entityId: newId,
            entityType: 'fazenda' as const,
            tagId,
            assignedBy: user.id,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            synced: false,
            remoteId: null
          }));
          
          await db.tagAssignments.bulkAdd(tagAssignments);
          
          // 🔧 FIX: Recalcular usageCount baseado em assignments reais
          const { recalculateTagUsage } = await import('../utils/fixTagUsageCount');
          for (const tagId of selectedTagIds) {
            await recalculateTagUsage(tagId);
          }
        }
        
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
      <Input
        {...register('nome')}
        label="Nome da Fazenda"
        type="text"
        required
        placeholder="Ex: Fazenda Capenema III"
        error={errors.nome?.message}
        autoFocus
      />

      <Input
        {...register('logoUrl')}
        label="URL do Logo (opcional)"
        type="url"
        placeholder="https://exemplo.com/logo.png"
      />

      {/* Tags */}
      <TagSelector
        selectedTagIds={selectedTagIds}
        onChange={setSelectedTagIds}
        entityType="fazenda"
        disabled={isSubmitting}
      />

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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 pt-6 pb-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{titulo}</h2>
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

