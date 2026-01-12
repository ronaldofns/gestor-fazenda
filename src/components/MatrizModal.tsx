import { useEffect, useState, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import Combobox, { ComboboxOption } from './Combobox';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { Matriz } from '../db/models';
import Modal from './Modal';
import ModalCategoria from './ModalCategoria';
import ModalRaca from './ModalRaca';
import { showToast } from '../utils/toast';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getThemeClasses, getCheckboxClass } from '../utils/themeHelpers';
import { registrarAudit } from '../utils/audit';
import { useAuth } from '../hooks/useAuth';

type Mode = 'create' | 'edit';

const schemaMatriz = z.object({
  identificador: z.string().min(1, 'Informe o identificador da matriz'),
  fazendaId: z.string().min(1, 'Selecione a fazenda'),
  categoriaId: z.string().min(1, 'Selecione a categoria'),
  raca: z.string().optional(),
  dataNascimento: z.string().optional(),
  pai: z.string().optional(),
  mae: z.string().optional(),
  ativo: z.boolean().default(true),
  obs: z.string().optional()
});

type FormDataMatriz = z.infer<typeof schemaMatriz>;

interface MatrizModalProps {
  open: boolean;
  mode: Mode;
  fazendaOptions: ComboboxOption[];
  defaultIdentificador?: string;
  defaultFazendaId?: string;
  initialData?: Matriz | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function MatrizModal({
  open,
  mode,
  fazendaOptions,
  defaultIdentificador,
  defaultFazendaId,
  initialData,
  onClose,
  onSaved
}: MatrizModalProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const [modalCategoriaOpen, setModalCategoriaOpen] = useState(false);
  const [modalRacaOpen, setModalRacaOpen] = useState(false);

  // Carregar categorias do banco
  const categoriasRaw = useLiveQuery(() => db.categorias.toArray(), []) || [];
  
  const categorias = useMemo(() => {
    if (!Array.isArray(categoriasRaw) || categoriasRaw.length === 0) return [];
    return [...categoriasRaw].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [categoriasRaw]);

  const categoriaOptions = useMemo(() => {
    return categorias.map(c => ({ label: c.nome, value: c.id }));
  }, [categorias]);

  // Carregar raças do banco
  const racasRaw = useLiveQuery(() => db.racas.toArray(), []) || [];
  
  const racas = useMemo(() => {
    if (!Array.isArray(racasRaw) || racasRaw.length === 0) return [];
    return [...racasRaw].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [racasRaw]);

  const racaOptions = useMemo(() => {
    return racas.map(r => ({ label: r.nome, value: r.nome }));
  }, [racas]);

  const titulo = mode === 'create' ? 'Nova Matriz' : 'Editar Matriz';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<FormDataMatriz>({
    resolver: zodResolver(schemaMatriz),
    defaultValues: {
      identificador: '',
      fazendaId: '',
      categoriaId: '',
      raca: '',
      dataNascimento: '',
      pai: '',
      mae: '',
      ativo: true,
      obs: ''
    }
  });

  // Pré-carregar dados no modo edição
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      reset({
        identificador: initialData.identificador,
        fazendaId: initialData.fazendaId,
        categoriaId: (initialData as any).categoriaId || (initialData as any).categoria || '',
        raca: initialData.raca || '',
        dataNascimento: initialData.dataNascimento || '',
        pai: initialData.pai || '',
        mae: initialData.mae || '',
        ativo: initialData.ativo,
        obs: ''
      });
    } else if (mode === 'create' && open) {
      // Se não houver categorias, criar as padrão
      if (categorias.length === 0) {
        const criarCategoriasPadrao = async () => {
          const now = new Date().toISOString();
          const categoriaNovilhaId = 'categoria-novilha';
          const categoriaVacaId = 'categoria-vaca';
          
          try {
            await db.categorias.add({
              id: categoriaNovilhaId,
              nome: 'Novilha',
              createdAt: now,
              updatedAt: now,
              synced: false,
              remoteId: null
            });
            await db.categorias.add({
              id: categoriaVacaId,
              nome: 'Vaca',
              createdAt: now,
              updatedAt: now,
              synced: false,
              remoteId: null
            });
          } catch (error) {
            // Pode já existir, ignorar
          }
        };
        criarCategoriasPadrao();
      }
      
      reset({
        identificador: defaultIdentificador || '',
        fazendaId: defaultFazendaId || '',
        categoriaId: categorias.find(c => c.nome === 'Vaca')?.id || '',
        raca: '',
        dataNascimento: '',
        pai: '',
        mae: '',
        ativo: true,
        obs: ''
      });
    }
  }, [mode, initialData, reset, defaultIdentificador, defaultFazendaId, open, categorias]);

  const normalizarData = (valor: string) => {
    const digits = valor.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  };

  const handleLimpar = () => {
    reset({
      identificador: defaultIdentificador || '',
      fazendaId: defaultFazendaId || '',
      categoriaId: categorias.find(c => c.nome === 'Vaca')?.id || '',
      raca: '',
      dataNascimento: '',
      pai: '',
      mae: '',
      ativo: true,
      obs: ''
    });
  };

  const handleCategoriaCadastrada = (categoriaId: string, categoriaNome: string) => {
    setValue('categoriaId', categoriaId);
    showToast({ type: 'success', title: 'Categoria cadastrada', message: categoriaNome });
  };

  const handleRacaCadastrada = (racaNome: string) => {
    setValue('raca', racaNome);
    showToast({ type: 'success', title: 'Raça cadastrada', message: racaNome });
  };

  const onSubmit = async (data: FormDataMatriz) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        identificador: data.identificador.trim(),
        fazendaId: data.fazendaId,
        categoriaId: data.categoriaId,
        raca: data.raca?.trim() || undefined,
        dataNascimento: data.dataNascimento?.trim() || undefined,
        pai: data.pai?.trim() || undefined,
        mae: data.mae?.trim() || undefined,
        ativo: data.ativo
      };

      if (mode === 'edit' && initialData) {
        // Salvar estado anterior para auditoria
        const antes = { ...initialData };
        
        await db.matrizes.update(initialData.id, {
          ...payload,
          updatedAt: now,
          synced: false
        });
        
        // Buscar estado atualizado
        const depois = await db.matrizes.get(initialData.id);
        
        // Registrar auditoria
        await registrarAudit({
          entity: 'matriz',
          entityId: initialData.id,
          action: 'update',
          before: antes,
          after: depois || null,
          user: user ? { id: user.id, nome: user.nome } : undefined
        });
        
        showToast({ type: 'success', title: 'Matriz atualizada', message: payload.identificador });
      } else if (mode === 'create') {
        const newId = uuid();
        const novaMatriz = {
          id: newId,
          ...payload,
          createdAt: now,
          updatedAt: now,
          synced: false,
          remoteId: null
        };
        
        await db.matrizes.add(novaMatriz);
        
        // Registrar auditoria
        await registrarAudit({
          entity: 'matriz',
          entityId: newId,
          action: 'create',
          before: null,
          after: novaMatriz,
          user: user ? { id: user.id, nome: user.nome } : undefined
        });
        
        showToast({ type: 'success', title: 'Matriz cadastrada', message: payload.identificador });
      }

      onSaved?.();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar matriz:', error);
      showToast({
        type: 'error',
        title: 'Erro ao salvar matriz',
        message: error?.message || 'Tente novamente.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const conteudoFormulario = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Identificador da matriz *
          </label>
          <input
            type="text"
            className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
            placeholder="Ex: 123, V-01..."
            {...register('identificador')}
            autoFocus
          />
          {errors.identificador && (
            <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.identificador.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Fazenda *
          </label>
          <Combobox
            value={watch('fazendaId') || ''}
            onChange={(value) => startTransition(() => setValue('fazendaId', value))}
            options={fazendaOptions}
            placeholder="Selecione a fazenda"
            allowCustomValue={false}
          />
          {errors.fazendaId && (
            <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.fazendaId.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Categoria *
          </label>
          <Combobox
            value={watch('categoriaId') || ''}
            onChange={(value) => startTransition(() => setValue('categoriaId', value))}
            options={categoriaOptions}
            placeholder="Selecione a categoria"
            allowCustomValue={false}
            onAddNew={() => setModalCategoriaOpen(true)}
            addNewLabel="Cadastrar nova categoria"
          />          
          {errors.categoriaId && (
            <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.categoriaId.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Raça
          </label>
          <Combobox
            value={watch('raca') || ''}
            onChange={(value) => startTransition(() => setValue('raca', value))}
            options={racaOptions}
            placeholder="Digite ou selecione uma raça"
            allowCustomValue={true}
            onAddNew={() => setModalRacaOpen(true)}
            addNewLabel="Cadastrar nova raça"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Data de nascimento
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
            placeholder="dd/mm/yyyy"
            {...register('dataNascimento')}
            onChange={(e) => {
              const formatted = normalizarData(e.target.value);
              e.target.value = formatted;
            }}
            onBlur={(e) => {
              const formatted = normalizarData(e.target.value);
              e.target.value = formatted;
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Pai
          </label>
          <input
            type="text"
            className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
            placeholder="Identificador do pai (se houver)"
            {...register('pai')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Mãe
          </label>
          <input
            type="text"
            className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
            placeholder="Identificador da mãe (se houver)"
            {...register('mae')}
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="ativo"
            className={`h-4 w-4 ${getCheckboxClass(primaryColor)}`}
            {...register('ativo')}
          />
          <label htmlFor="ativo" className="ml-2 block text-sm text-gray-700 dark:text-slate-300">
            Matriz ativa
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Observações
        </label>
        <textarea
          rows={3}
          className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
          placeholder="Informações adicionais relevantes sobre a matriz."
          {...register('obs')}
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
    <>
      <Modal open={open} onClose={onClose}>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
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
      <ModalCategoria
        open={modalCategoriaOpen}
        onClose={() => setModalCategoriaOpen(false)}
        onCategoriaCadastrada={handleCategoriaCadastrada}
      />
      <ModalRaca
        open={modalRacaOpen}
        onClose={() => setModalRacaOpen(false)}
        onRacaCadastrada={handleRacaCadastrada}
      />
    </>
  );
}

