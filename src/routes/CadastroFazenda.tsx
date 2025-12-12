import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';

const schema = z.object({
  nome: z.string().min(1, 'Informe o nome da fazenda'),
  logoUrl: z.string().optional()
});

export default function CadastroFazenda() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!id;

  const fazenda = useLiveQuery(
    () => id ? db.fazendas.get(id) : null,
    [id]
  );

  const { register, handleSubmit, formState: { errors }, reset } = useForm({ 
    resolver: zodResolver(schema),
    shouldUnregister: false
  });

  useEffect(() => {
    if (fazenda && isEditing) {
      reset({
        nome: fazenda.nome,
        logoUrl: fazenda.logoUrl || ''
      });
    }
  }, [fazenda, isEditing, reset]);

  async function onSubmit(values: any) {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      
      if (isEditing && id) {
        // Atualizar fazenda existente
        await db.fazendas.update(id, {
          ...values,
          updatedAt: now,
          synced: false
        });
      } else {
        // Criar nova fazenda
        const newId = uuid();
        await db.fazendas.add({ 
          ...values, 
          id: newId, 
          createdAt: now, 
          updatedAt: now, 
          synced: false 
        });
      }
      
      navigate('/fazendas', { replace: true });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isEditing && !fazenda) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
          <p className="text-yellow-800">Fazenda não encontrada.</p>
          <button
            onClick={() => navigate('/fazendas')}
            className="mt-2 text-blue-600 hover:text-blue-800 underline text-sm"
          >
            Voltar para a lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 break-words">
        {isEditing ? 'Editar Fazenda' : 'Nova Fazenda'}
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Nome da Fazenda *</label>
          <input 
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            {...register('nome')} 
            placeholder="Ex: Fazenda Capenema III"
          />
          {errors.nome && <p className="text-red-600 text-sm mt-1">{String(errors.nome.message)}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL do Logo (opcional)</label>
          <input 
            type="url"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            {...register('logoUrl')} 
            placeholder="https://exemplo.com/logo.png"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar'}
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

