import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { showToast } from '../utils/toast';
import { CategoriaMatriz } from '../db/models';
import { ArrowLeft } from 'lucide-react';

const schemaMatriz = z.object({
  identificador: z.string().min(1, 'Informe o identificador da matriz'),
  fazendaId: z.string().min(1, 'Selecione a fazenda'),
  categoria: z.enum(['novilha', 'vaca'], { required_error: 'Selecione a categoria' }),
  raca: z.string().optional(),
  dataNascimento: z.string().optional(),
  pai: z.string().optional(),
  mae: z.string().optional(),
  ativo: z.boolean().default(true),
  obs: z.string().optional()
});

type FormDataMatriz = z.infer<typeof schemaMatriz>;

export default function CadastroMatriz() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const fazendas = fazendasRaw.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const matriz = useLiveQuery(
    () => (id ? db.matrizes.get(id) : null),
    [id]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<FormDataMatriz>({
    resolver: zodResolver(schemaMatriz),
    defaultValues: {
      identificador: '',
      fazendaId: '',
      categoria: 'vaca',
      raca: '',
      dataNascimento: '',
      pai: '',
      mae: '',
      ativo: true,
      obs: ''
    }
  });

  useEffect(() => {
    if (matriz && isEditing) {
      reset({
        identificador: matriz.identificador,
        fazendaId: matriz.fazendaId,
        categoria: matriz.categoria as CategoriaMatriz,
        raca: matriz.raca || '',
        dataNascimento: matriz.dataNascimento || '',
        pai: matriz.pai || '',
        mae: matriz.mae || '',
        ativo: matriz.ativo,
        obs: '' // campo apenas local
      });
    }
  }, [matriz, isEditing, reset]);

  // Pré-preencher ao criar a partir da tela de Matrizes
  useEffect(() => {
    if (isEditing) return;
    const identificadorFromUrl = searchParams.get('identificador') || '';
    const fazendaFromUrl = searchParams.get('fazenda') || '';
    if (identificadorFromUrl || fazendaFromUrl) {
      reset((current) => ({
        ...current,
        identificador: identificadorFromUrl || current.identificador,
        fazendaId: fazendaFromUrl || current.fazendaId
      }));
    }
  }, [isEditing, searchParams, reset]);

  const normalizarData = (valor: string) => {
    const digits = valor.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  };

  const onSubmit = async (data: FormDataMatriz) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        identificador: data.identificador.trim(),
        fazendaId: data.fazendaId,
        categoria: data.categoria,
        raca: data.raca?.trim() || undefined,
        dataNascimento: data.dataNascimento?.trim() || undefined,
        pai: data.pai?.trim() || undefined,
        mae: data.mae?.trim() || undefined,
        ativo: data.ativo
      };

      if (isEditing && id) {
        await db.matrizes.update(id, {
          ...payload,
          updatedAt: now,
          synced: false
        });
        showToast({ type: 'success', title: 'Matriz atualizada', message: payload.identificador });
      } else {
        const newId = uuid();
        await db.matrizes.add({
          id: newId,
          ...payload,
          createdAt: now,
          updatedAt: now,
          synced: false,
          remoteId: null
        });
        showToast({ type: 'success', title: 'Matriz cadastrada', message: payload.identificador });
      }

      navigate('/matrizes', { replace: true });
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

  if (isEditing && !matriz) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
          <p className="text-yellow-800">Matriz não encontrada.</p>
          <button
            onClick={() => navigate('/matrizes')}
            className="mt-2 text-blue-600 hover:text-blue-800 underline text-sm"
          >
            Voltar para a lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2">
            <Link
              to="/matrizes"
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                {isEditing ? 'Editar Matriz' : 'Nova Matriz'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Cadastro completo de matrizes (vacas/novilhas).
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="bg-white shadow-sm rounded-lg p-4 sm:p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Identificador da matriz *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Ex: 123, V-01..."
                  {...register('identificador')}
                />
                {errors.identificador && (
                  <p className="text-red-600 text-xs mt-1">{errors.identificador.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fazenda *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  {...register('fazendaId')}
                >
                  <option value="">Selecione</option>
                  {fazendas.map((fazenda) => (
                    <option key={fazenda.id} value={fazenda.id}>
                      {fazenda.nome}
                    </option>
                  ))}
                </select>
                {errors.fazendaId && (
                  <p className="text-red-600 text-xs mt-1">{errors.fazendaId.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  {...register('categoria')}
                >
                  <option value="novilha">Novilha</option>
                  <option value="vaca">Vaca</option>
                </select>
                {errors.categoria && (
                  <p className="text-red-600 text-xs mt-1">{errors.categoria.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Raça
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Ex: Nelore, Angus..."
                  {...register('raca')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de nascimento
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pai
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Identificador do pai (se houver)"
                  {...register('pai')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mãe
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Identificador da mãe (se houver)"
                  {...register('mae')}
                />
              </div>

              <div className="flex items-center mt-2">
                <input
                  type="checkbox"
                  id="ativo"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  {...register('ativo')}
                />
                <label htmlFor="ativo" className="ml-2 block text-sm text-gray-700">
                  Matriz ativa
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Informações adicionais relevantes sobre a matriz."
                {...register('obs')}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/matrizes')}
                disabled={isSubmitting}
                className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}


