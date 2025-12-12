import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/dexieDB';
import { useNavigate } from 'react-router-dom';
import { Edit, Trash2 } from 'lucide-react';

export default function ListaFazendas() {
  const navigate = useNavigate();
  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const fazendas = useMemo(() => {
    return fazendasRaw.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [fazendasRaw]);

  const handleDelete = async (fazendaId: string, fazendaNome: string) => {
    if (!confirm(`Deseja realmente excluir a fazenda "${fazendaNome}"?`)) {
      return;
    }

    try {
      // Verificar se há nascimentos associados a esta fazenda
      const nascimentos = await db.nascimentos.where('fazendaId').equals(fazendaId).toArray();
      
      if (nascimentos.length > 0) {
        alert(`Não é possível excluir a fazenda "${fazendaNome}" pois existem ${nascimentos.length} nascimento(s) associado(s) a ela.`);
        return;
      }

      // Excluir no servidor se tiver remoteId
      const fazenda = await db.fazendas.get(fazendaId);
      if (fazenda?.remoteId) {
        try {
          const { supabase } = await import('../api/supabaseClient');
          const { error } = await supabase.from('fazendas_online').delete().eq('id', fazenda.remoteId);
          if (error) {
            console.warn('Erro ao excluir fazenda no servidor:', error);
          }
        } catch (err) {
          console.warn('Erro ao excluir fazenda no servidor:', err);
        }
      }

      // Excluir localmente
      await db.fazendas.delete(fazendaId);
      console.log('Fazenda excluída:', fazendaId);
    } catch (error) {
      console.error('Erro ao excluir fazenda:', error);
      alert(`Erro ao excluir: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold">Fazendas</h2>
        <Link
          to="/nova-fazenda"
          className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
        >
          Nova Fazenda
        </Link>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {fazendas.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Nenhuma fazenda cadastrada ainda.
            <Link to="/nova-fazenda" className="ml-2 text-blue-600 hover:text-blue-800 underline">
              Cadastrar primeira fazenda
            </Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fazendas.map((fazenda) => (
                <tr key={fazenda.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      {fazenda.logoUrl && (
                        <img 
                          src={fazenda.logoUrl} 
                          alt={fazenda.nome}
                          className="w-8 h-8 rounded-full mr-3 object-cover"
                        />
                      )}
                      <span className="text-sm font-medium text-gray-900">{fazenda.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {fazenda.synced ? (
                      <span className="text-green-600">Sincronizado</span>
                    ) : (
                      <span className="text-yellow-600">Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/editar-fazenda/${fazenda.id}`)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                        title="Editar fazenda"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(fazenda.id, fazenda.nome)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Excluir fazenda"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
