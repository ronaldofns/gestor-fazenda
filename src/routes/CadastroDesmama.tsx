import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { showToast } from '../utils/toast';
import { useLiveQuery } from 'dexie-react-hooks';
import { X } from 'lucide-react';

const schema = z.object({
  dataDesmama: z.string().min(1, 'Informe a data de desmama'),
  pesoDesmama: z.string().min(1, 'Informe o peso').transform(val => parseFloat(val))
});

export default function CadastroDesmama() {
  const { nascimentoId } = useParams<{ nascimentoId: string }>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // useLiveQuery retorna dados imediatamente do cache local, sem piscar tela
  const nascimento = useLiveQuery(
    () => (nascimentoId ? db.nascimentos.get(nascimentoId) : undefined),
    [nascimentoId]
  );

  const { register, handleSubmit, formState: { errors } } = useForm({ 
    resolver: zodResolver(schema),
    shouldUnregister: false // Preservar estado do formulário
  });

  async function onSubmit(values: any) {
    if (isSubmitting || !nascimentoId) return;
    
    setIsSubmitting(true);
    try {
      // Verificar se já existe desmama para este nascimento
      const desmamasExistentes = await db.desmamas.where('nascimentoId').equals(nascimentoId).toArray();
      
      if (desmamasExistentes.length > 0) {
        // Atualizar desmama existente
        const desmamaId = desmamasExistentes[0].id;
        const now = new Date().toISOString();
        await db.desmamas.update(desmamaId, {
          dataDesmama: values.dataDesmama,
          pesoDesmama: values.pesoDesmama,
          updatedAt: now,
          synced: false
        });
      } else {
        // Criar nova desmama
        const id = uuid();
        const now = new Date().toISOString();
        await db.desmamas.add({
          id,
          nascimentoId,
          dataDesmama: values.dataDesmama,
          pesoDesmama: values.pesoDesmama,
          createdAt: now,
          updatedAt: now,
          synced: false
        });
      }
      
      // Navegação suave sem recarregar página
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showToast({ type: 'error', title: 'Erro ao salvar', message: 'Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Se não encontrou nascimento, mostrar mensagem em modal
  if (!nascimento) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true" role="dialog">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => navigate(-1)}></div>
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-gray-900">Desmama</h2>
              <button
                onClick={() => navigate(-1)}
                className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 text-sm text-yellow-800 bg-yellow-50 border-b border-yellow-200">
              Nascimento não encontrado.
            </div>
            <div className="p-4 flex justify-end">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Voltar para a lista
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true" role="dialog">
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => navigate(-1)}></div>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-semibold text-gray-900">Cadastro de Desmama</h2>
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Informações do Nascimento</h3>
              <div className="grid grid-cols-2 gap-2 sm:gap-2 text-xs sm:text-sm">
                <div>
                  <span className="text-gray-500">Matriz:</span>
                  <span className="ml-2 font-medium">{nascimento.matrizId}</span>
                </div>
                <div>
                  <span className="text-gray-500">Sexo:</span>
                  <span className="ml-2 font-medium">{nascimento.sexo || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Raça:</span>
                  <span className="ml-2 font-medium">{nascimento.raca || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Brinco:</span>
                  <span className="ml-2 font-medium">{nascimento.brincoNumero || '-'}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Data de Desmama *
                  </label>
                  <input 
                    type="date"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                    {...register('dataDesmama')} 
                  />
                  {errors.dataDesmama && (
                    <p className="text-red-600 text-sm mt-1">{String(errors.dataDesmama.message)}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Peso de Desmama (kg) *
                  </label>
                  <input 
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                    {...register('pesoDesmama')} 
                    placeholder="Ex: 180.5"
                  />
                  {errors.pesoDesmama && (
                    <p className="text-red-600 text-sm mt-1">{String(errors.pesoDesmama.message)}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Desmama'}
                </button>
                <button 
                  type="button" 
                  onClick={() => navigate(-1)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

