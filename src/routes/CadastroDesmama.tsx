import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/dexieDB';
import { Nascimento } from '../db/models';
import { uuid } from '../utils/uuid';
import { useLiveQuery } from 'dexie-react-hooks';

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
    () => nascimentoId ? db.nascimentos.get(nascimentoId) : null,
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
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Se não encontrou nascimento, mostrar mensagem mas não "Carregando..."
  if (!nascimento) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Nascimento não encontrado.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 text-blue-600 hover:text-blue-800 underline"
          >
            Voltar para a lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 break-words">Cadastro de Desmama</h2>
      
      <div className="bg-gray-50 p-4 rounded-lg mb-4 sm:mb-6">
        <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Informações do Nascimento</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div className="flex gap-3 pt-4">
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
  );
}

