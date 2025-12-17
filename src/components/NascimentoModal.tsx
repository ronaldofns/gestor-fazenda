import React, { useEffect, useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Combobox, { ComboboxOption } from './Combobox';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { Nascimento } from '../db/models';
import Modal from './Modal';
import { showToast } from '../utils/toast';

type Mode = 'create' | 'edit';

const schemaNascimento = z.object({
  fazendaId: z.string().min(1, 'Selecione a fazenda'),
  mes: z.number().min(1).max(12),
  ano: z.number().min(2000).max(2100),
  matrizId: z.string().min(1, 'Informe a matriz'),
  tipo: z.enum(['novilha', 'vaca'], { required_error: 'Selecione o tipo: Vaca ou Novilha' }),
  brincoNumero: z.string().optional(),
  dataNascimento: z.string().optional(),
  sexo: z.enum(['M', 'F'], { required_error: 'Selecione o sexo' }),
  raca: z.string().optional(),
  obs: z.string().optional(),
  morto: z.boolean().optional()
});

export type VerificarBrincoFn = (brincoNumero?: string, fazendaId?: string, ignorarId?: string) => Promise<boolean>;

interface NascimentoModalProps {
  open: boolean;
  mode: Mode;
  fazendaOptions: ComboboxOption[];
  racasOptions: string[];
  defaultFazendaId?: string;
  defaultMes?: number;
  defaultAno?: number;
  initialData?: Nascimento | null;
  onClose: () => void;
  onSaved?: () => void;
  onAddRaca?: () => void;
  novaRacaSelecionada?: string;
  verificarBrincoDuplicado: VerificarBrincoFn;
}

function NascimentoModalComponent({
  open,
  mode,
  fazendaOptions,
  racasOptions,
  defaultFazendaId,
  defaultMes,
  defaultAno,
  initialData,
  onClose,
  onSaved,
  onAddRaca,
  novaRacaSelecionada,
  verificarBrincoDuplicado
}: NascimentoModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const titulo = mode === 'create' ? 'Novo Nascimento/Desmama' : 'Editar Nascimento/Desmama';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<z.infer<typeof schemaNascimento>>({
    resolver: zodResolver(schemaNascimento),
    defaultValues: mode === 'create'
      ? {
          fazendaId: defaultFazendaId || '',
          mes: defaultMes,
          ano: defaultAno,
          matrizId: '',
          brincoNumero: '',
          dataNascimento: '',
          sexo: undefined,
          raca: '',
          tipo: undefined,
          obs: '',
          morto: false
        }
      : undefined,
    shouldUnregister: false
  });

  // Pré-carregar dados no modo edição
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      const tipo = initialData.vaca ? 'vaca' : initialData.novilha ? 'novilha' : undefined;
      reset({
        fazendaId: initialData.fazendaId,
        mes: initialData.mes,
        ano: initialData.ano,
        matrizId: initialData.matrizId,
        brincoNumero: initialData.brincoNumero || '',
        dataNascimento: initialData.dataNascimento || '',
        sexo: initialData.sexo,
        raca: initialData.raca || '',
        tipo: tipo as 'novilha' | 'vaca' | undefined,
        obs: initialData.obs || '',
        morto: initialData.morto || false
      });
    } else if (mode === 'create' && open) {
      reset({
        fazendaId: defaultFazendaId || '',
        mes: defaultMes,
        ano: defaultAno,
        matrizId: '',
        brincoNumero: '',
        dataNascimento: '',
        sexo: undefined,
        raca: '',
        tipo: undefined,
        obs: '',
        morto: false
      });
    }
  }, [mode, initialData, reset, defaultFazendaId, defaultMes, defaultAno, open]);

  // Aplicar nova raça cadastrada externamente
  useEffect(() => {
    if (novaRacaSelecionada) {
      setValue('raca', novaRacaSelecionada);
    }
  }, [novaRacaSelecionada, setValue]);

  const fazendaIdAtual = watch('fazendaId');
  const mesAtual = watch('mes');
  const anoAtual = watch('ano');
  const dataNascimentoAtual = watch('dataNascimento');

  const handleLimpar = () => {
    reset({
      fazendaId: fazendaIdAtual || defaultFazendaId || '',
      mes: mesAtual || defaultMes,
      ano: anoAtual || defaultAno,
      dataNascimento: dataNascimentoAtual || '',
      matrizId: '',
      brincoNumero: '',
      sexo: undefined,
      raca: '',
      tipo: undefined,
      obs: '',
      morto: false
    });
  };

  const onSubmit = async (values: z.infer<typeof schemaNascimento>) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Validação de brinco duplicado
      if (values.brincoNumero && values.fazendaId) {
        const duplicado = await verificarBrincoDuplicado(
          values.brincoNumero,
          values.fazendaId,
          mode === 'edit' && initialData ? initialData.id : undefined
        );
        if (duplicado) {
          showToast({ type: 'warning', title: 'Brinco duplicado', message: 'Já existe para esta fazenda.' });
          setIsSubmitting(false);
          return;
        }
      }

      if (mode === 'create') {
        const id = uuid();
        const now = new Date().toISOString();
        const novilha = values.tipo === 'novilha';
        const vaca = values.tipo === 'vaca';
        await db.nascimentos.add({
          id,
          fazendaId: values.fazendaId,
          mes: Number(values.mes),
          ano: Number(values.ano),
          matrizId: values.matrizId,
          brincoNumero: values.brincoNumero || '',
          dataNascimento: values.dataNascimento || '',
          sexo: values.sexo,
          raca: values.raca || '',
          obs: values.obs || '',
          morto: values.morto || false,
          novilha,
          vaca,
          createdAt: now,
          updatedAt: now,
          synced: false
        });
      } else if (mode === 'edit' && initialData) {
        const novilha = values.tipo === 'novilha';
        const vaca = values.tipo === 'vaca';
        const now = new Date().toISOString();
        await db.nascimentos.update(initialData.id, {
          fazendaId: values.fazendaId,
          mes: Number(values.mes),
          ano: Number(values.ano),
          matrizId: values.matrizId,
          brincoNumero: values.brincoNumero || '',
          dataNascimento: values.dataNascimento || '',
          sexo: values.sexo,
          raca: values.raca || '',
          obs: values.obs || '',
          morto: values.morto || false,
          novilha,
          vaca,
          updatedAt: now,
          synced: false
        });
      }

      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showToast({ type: 'error', title: 'Erro ao salvar', message: 'Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const conteudoFormulario = (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <div className="flex flex-col md:flex-row gap-2">
        <div className="flex-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Fazenda *</label>
          <Combobox
            value={watch('fazendaId') || ''}
            onChange={(value) => startTransition(() => setValue('fazendaId', value))}
            options={fazendaOptions}
            placeholder="Selecione a fazenda"
            allowCustomValue={false}
          />
          {errors.fazendaId && <p className="text-red-600 text-sm mt-1">{String(errors.fazendaId.message)}</p>}
        </div>

        <div className="md:w-40">
          <label className="block text-sm font-medium text-gray-700 mb-1">Mês *</label>
          <Combobox
            value={watch('mes') && !isNaN(Number(watch('mes'))) ? watch('mes')?.toString() : ''}
            onChange={(value) => {
              if (value) {
                const numValue = Number(value);
                if (!isNaN(numValue)) {
                  setValue('mes', numValue, { shouldValidate: true });
                }
              }
            }}
            options={Array.from({ length: 12 }, (_, i) => {
              const mes = i + 1;
              return {
                label: new Date(2000, mes - 1).toLocaleDateString('pt-BR', { month: 'long' }),
                value: mes.toString()
              };
            })}
            placeholder="Selecione o mês"
            allowCustomValue={false}
          />
          {errors.mes && <p className="text-red-600 text-sm mt-1">{String(errors.mes.message)}</p>}
        </div>

        <div className="md:w-28">
          <label className="block text-sm font-medium text-gray-700 mb-1">Ano *</label>
          <input
            type="number"
            min="2000"
            max="2100"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...register('ano', { valueAsNumber: true })}
          />
          {errors.ano && <p className="text-red-600 text-sm mt-1">{String(errors.ano.message)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Matriz *</label>
          <input
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...register('matrizId')}
            placeholder="Número da matriz"
            autoFocus
          />
          {errors.matrizId && <p className="text-red-600 text-sm mt-1">{String(errors.matrizId.message)}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número do Brinco</label>
          <input
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...register('brincoNumero')}
            placeholder="Número do brinco"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
          <input
            type="date"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...register('dataNascimento')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sexo *</label>
          <Combobox
            value={watch('sexo') || ''}
            onChange={(value) => setValue('sexo', value as 'M' | 'F', { shouldValidate: true })}
            options={[
              { label: 'Macho', value: 'M' },
              { label: 'Fêmea', value: 'F' }
            ]}
            placeholder="Selecione o sexo"
            allowCustomValue={false}
          />
          {errors.sexo && <p className="text-red-600 text-sm mt-1">{String(errors.sexo.message)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Raça</label>
          <Combobox
            value={watch('raca') || ''}
            onChange={(value) => setValue('raca', value)}
            options={racasOptions}
            placeholder="Digite ou selecione uma raça"
            onAddNew={onAddRaca}
            addNewLabel="Cadastrar nova raça"
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Tipo *</label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="novilha"
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                {...register('tipo')}
              />
              <span className="text-xs sm:text-sm font-medium text-gray-700">Novilha</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="vaca"
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                {...register('tipo')}
              />
              <span className="text-xs sm:text-sm font-medium text-gray-700">Vaca</span>
            </label>
          </div>
          {errors.tipo && <p className="text-red-600 text-xs sm:text-sm mt-1">{String(errors.tipo.message)}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          {...register('obs')}
          placeholder="Observações adicionais"
        />
      </div>

      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
        <input
          type="checkbox"
          id="morto-modal"
          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
          {...register('morto')}
        />
        <label htmlFor="morto-modal" className="text-sm font-medium text-red-800 cursor-pointer">
          Bezerro nasceu morto
        </label>
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Salvando...' : mode === 'create' ? 'Salvar' : 'Salvar Alterações'}
        </button>
        <button
          type="button"
          onClick={handleLimpar}
          disabled={isSubmitting}
          className="px-4 py-2 bg-yellow-500 text-white font-medium rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );

  return (
    <Modal isOpen={open} onClose={onClose} title={titulo}>
      {conteudoFormulario}
    </Modal>
  );
}

export default React.memo(NascimentoModalComponent);

