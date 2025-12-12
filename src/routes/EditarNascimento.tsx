import { useState, useRef, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import ModalRaca from '../components/ModalRaca';
import Combobox from '../components/Combobox';

const schema = z.object({
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

type FormData = z.infer<typeof schema>;

export default function EditarNascimento() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalRacaOpen, setModalRacaOpen] = useState(false);
  const matrizInputRef = useRef<HTMLInputElement>(null);
  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const fazendas = useMemo(() => {
    return fazendasRaw.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [fazendasRaw]);
  const racas = useLiveQuery(() => db.racas.orderBy('nome').toArray(), []) || [];
  
  const nascimento = useLiveQuery(
    () => id ? db.nascimentos.get(id) : null,
    [id]
  );

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<FormData>({ 
    resolver: zodResolver(schema),
    shouldUnregister: false
  });

  // Carregar dados quando nascimento for carregado
  useEffect(() => {
    if (nascimento) {
      // Converter novilha/vaca do banco para 'tipo' do formulário
      const tipo = nascimento.vaca ? 'vaca' : nascimento.novilha ? 'novilha' : undefined;
      
      reset({
        fazendaId: nascimento.fazendaId,
        mes: nascimento.mes,
        ano: nascimento.ano,
        matrizId: nascimento.matrizId,
        brincoNumero: nascimento.brincoNumero || '',
        dataNascimento: nascimento.dataNascimento || '',
        sexo: nascimento.sexo,
        raca: nascimento.raca || '',
        tipo: tipo as 'novilha' | 'vaca' | undefined,
        obs: nascimento.obs || '',
        morto: nascimento.morto || false
      });
    }
  }, [nascimento, reset]);

  async function onSubmit(values: FormData) {
    if (isSubmitting || !id) return;
    
    setIsSubmitting(true);
    try {
      // Converter 'tipo' para novilha/vaca booleanos
      const novilha = values.tipo === 'novilha';
      const vaca = values.tipo === 'vaca';
      
      // Remover 'tipo' do objeto antes de salvar (não existe no modelo do banco)
      const { tipo, ...dadosParaSalvar } = values;
      
      const now = new Date().toISOString();
      await db.nascimentos.update(id, { 
        ...dadosParaSalvar,
        mes: Number(values.mes),
        ano: Number(values.ano),
        novilha,
        vaca,
        morto: values.morto || false,
        updatedAt: now,
        synced: false // Marcar como não sincronizado após edição
      });
      // Preservar parâmetros de busca da URL ao voltar
      const currentSearch = location.search;
      navigate(`/${currentSearch}`, { replace: true });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleRacaCadastrada = (racaNome: string) => {
    setValue('raca', racaNome);
  };

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

  if (fazendas.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 mb-2">Você precisa cadastrar pelo menos uma fazenda antes de editar um nascimento.</p>
          <button
            onClick={() => navigate('/nova-fazenda')}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
          >
            Cadastrar Fazenda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">Editar Nascimento/Desmama</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-white p-6 rounded-lg shadow-sm">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="flex-1">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Fazenda *</label>
            <Combobox
              value={watch('fazendaId') || ''}
              onChange={(value) => setValue('fazendaId', value)}
              options={fazendas.map(f => ({ label: f.nome, value: f.id }))}
              placeholder="Selecione a fazenda"
              allowCustomValue={false}
            />
            {errors.fazendaId && <p className="text-red-600 text-sm mt-1">{String(errors.fazendaId.message)}</p>}
          </div>

          <div className="md:w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Mês *</label>
            <Combobox
              value={watch('mes') && !isNaN(Number(watch('mes'))) ? watch('mes').toString() : ''}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Matriz *</label>
            <input 
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              {...register('matrizId', {
                onBlur: () => {},
              })}
              ref={(e) => {
                register('matrizId').ref(e);
                matrizInputRef.current = e;
              }}
              placeholder="Número da matriz"
            />
            {errors.matrizId && <p className="text-red-600 text-sm mt-1">{String(errors.matrizId.message)}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número do Brinco</label>
            <input 
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
              {...register('brincoNumero')} 
              placeholder="Número do brinco"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
            <input 
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raça</label>
            <Combobox
              value={watch('raca') || ''}
              onChange={(value) => setValue('raca', value)}
              options={racas.map(r => r.nome)}
              placeholder="Digite ou selecione uma raça"
              onAddNew={() => setModalRacaOpen(true)}
              addNewLabel="Cadastrar nova raça"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Tipo *</label>
            <div className="flex items-center gap-6">
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
            id="morto"
            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500" 
            {...register('morto')} 
          />
          <label htmlFor="morto" className="text-sm font-medium text-red-800 cursor-pointer">
            Bezerro nasceu morto
          </label>
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
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

      <ModalRaca 
        open={modalRacaOpen}
        onClose={() => setModalRacaOpen(false)}
        onRacaCadastrada={handleRacaCadastrada}
      />
    </div>
  );
}

