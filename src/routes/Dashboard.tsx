import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/dexieDB';
import useSync from '../hooks/useSync';
import SyncStatus from '../components/SyncStatus';
import { 
  TrendingUp, 
  Users, 
  User, 
  Mars, 
  Venus, 
  Building2,
  BarChart3,
  Plus,
  Upload,
  AlertTriangle
} from 'lucide-react';

export default function Dashboard() {
  useSync();
  
  const nascimentosTodosRaw = useLiveQuery(() => db.nascimentos.toArray(), []) || [];
  const desmamas = useLiveQuery(() => db.desmamas.toArray(), []) || [];
  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const fazendas = useMemo(() => {
    if (!fazendasRaw || !Array.isArray(fazendasRaw) || fazendasRaw.length === 0) return [];
    return [...fazendasRaw].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [fazendasRaw]);

  // Remover duplicados (mesma lógica da Home)
  const nascimentosTodos = useMemo(() => {
    if (!nascimentosTodosRaw || !Array.isArray(nascimentosTodosRaw) || nascimentosTodosRaw.length === 0) return [];
    
    const uniqueByUuid = new Map<string, typeof nascimentosTodosRaw[0]>();
    const uniqueByRemoteId = new Map<number, typeof nascimentosTodosRaw[0]>();
    
    for (const n of nascimentosTodosRaw) {
      if (!uniqueByUuid.has(n.id)) {
        uniqueByUuid.set(n.id, n);
      } else {
        const existing = uniqueByUuid.get(n.id)!;
        const shouldReplace = 
          (n.remoteId && !existing.remoteId) || 
          (n.remoteId && existing.remoteId && n.remoteId === existing.remoteId && 
           n.updatedAt && existing.updatedAt && new Date(n.updatedAt) > new Date(existing.updatedAt)) ||
          (!n.remoteId && !existing.remoteId && 
           n.updatedAt && existing.updatedAt && new Date(n.updatedAt) > new Date(existing.updatedAt));
        
        if (shouldReplace) {
          uniqueByUuid.set(n.id, n);
        }
      }
      
      if (n.remoteId) {
        if (!uniqueByRemoteId.has(n.remoteId)) {
          uniqueByRemoteId.set(n.remoteId, n);
        } else {
          const existing = uniqueByRemoteId.get(n.remoteId)!;
          const shouldReplace = 
            (n.updatedAt && existing.updatedAt && new Date(n.updatedAt) > new Date(existing.updatedAt));
          
          if (shouldReplace) {
            if (uniqueByUuid.has(existing.id)) {
              uniqueByUuid.delete(existing.id);
            }
            uniqueByRemoteId.set(n.remoteId, n);
            uniqueByUuid.set(n.id, n);
          }
        }
      }
    }
    
    return Array.from(uniqueByUuid.values()).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
  }, [nascimentosTodosRaw]);

  // Métricas gerais
  const metricas = useMemo(() => {
    // Verificações de segurança
    if (!nascimentosTodos || !Array.isArray(nascimentosTodos)) {
      return {
        totalNascimentos: 0,
        vacas: 0,
        novilhas: 0,
        femeas: 0,
        machos: 0,
        totalDesmamas: 0,
        taxaDesmama: '0',
        totalMortos: 0,
        taxaMortandade: '0.00',
        nascimentosEsteAno: 0,
        nascimentosEsteMes: 0,
        nascimentosPorMes: [],
        porFazenda: [],
        totaisPorRaca: []
      };
    }
    
    const totalNascimentos = nascimentosTodos.length;
    const vacas = nascimentosTodos.filter(n => n.vaca).length;
    const novilhas = nascimentosTodos.filter(n => n.novilha).length;
    const femeas = nascimentosTodos.filter(n => n.sexo === 'F').length;
    const machos = nascimentosTodos.filter(n => n.sexo === 'M').length;
    const totalDesmamas = Array.isArray(desmamas) ? desmamas.length : 0;
    const totalMortos = nascimentosTodos.filter(n => n.morto === true).length;
    const taxaMortandade = totalNascimentos > 0 
      ? ((totalMortos / totalNascimentos) * 100).toFixed(2)
      : '0.00';
    
    // Nascimentos por mês (últimos 12 meses)
    const agora = new Date();
    const nascimentosPorMes: { mes: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const data = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const mes = data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      const total = nascimentosTodos.filter(n => {
        const nascData = new Date(n.ano, n.mes - 1, 1);
        return nascData.getMonth() === data.getMonth() && nascData.getFullYear() === data.getFullYear();
      }).length;
      nascimentosPorMes.push({ mes, total });
    }

    // Nascimentos por fazenda
    const porFazenda = new Map<string, { nome: string; total: number }>();
    if (Array.isArray(fazendas) && fazendas.length > 0) {
      nascimentosTodos.forEach(n => {
        const fazenda = fazendas.find(f => f.id === n.fazendaId);
        const nome = fazenda?.nome || 'Sem fazenda';
        porFazenda.set(n.fazendaId, {
          nome,
          total: (porFazenda.get(n.fazendaId)?.total || 0) + 1
        });
      });
    }

    // Totais por raça
    const racasMap = new Map<string, number>();
    nascimentosTodos.forEach(n => {
      if (n.raca) {
        const raca = n.raca.toUpperCase();
        racasMap.set(raca, (racasMap.get(raca) || 0) + 1);
      }
    });
    const totaisPorRaca = Array.from(racasMap.entries())
      .map(([raca, total]) => ({ raca, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Top 10 raças

    // Taxa de desmama
    const taxaDesmama = totalNascimentos > 0 
      ? ((totalDesmamas / totalNascimentos) * 100).toFixed(1)
      : '0';

    // Nascimentos este ano
    const anoAtual = agora.getFullYear();
    const nascimentosEsteAno = nascimentosTodos.filter(n => n.ano === anoAtual).length;

    // Nascimentos este mês
    const mesAtual = agora.getMonth() + 1;
    const nascimentosEsteMes = nascimentosTodos.filter(n => 
      n.ano === anoAtual && n.mes === mesAtual
    ).length;

    return {
      totalNascimentos,
      vacas,
      novilhas,
      femeas,
      machos,
      totalDesmamas,
      taxaDesmama,
      totalMortos,
      taxaMortandade,
      nascimentosEsteAno,
      nascimentosEsteMes,
      nascimentosPorMes,
      porFazenda: Array.from(porFazenda.values()).sort((a, b) => a.nome.localeCompare(b.nome)),
      totaisPorRaca
    };
  }, [nascimentosTodos, desmamas, fazendas]);

  const maxNascimentosMes = useMemo(() => {
    if (!metricas.nascimentosPorMes || metricas.nascimentosPorMes.length === 0) return 1;
    return Math.max(...metricas.nascimentosPorMes.map(m => m.total), 1);
  }, [metricas.nascimentosPorMes]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">Visão geral do seu rebanho</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Cards de Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Nascimentos</h3>
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{metricas.totalNascimentos}</div>
            <div className="mt-2 text-xs text-gray-500">
              {metricas.nascimentosEsteAno} este ano • {metricas.nascimentosEsteMes} este mês
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Vacas</h3>
              <Users className="w-6 h-6 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{metricas.vacas}</div>
            <div className="mt-2 text-xs text-gray-500">
              {metricas.totalNascimentos > 0 
                ? `${((metricas.vacas / metricas.totalNascimentos) * 100).toFixed(1)}% do total`
                : '0% do total'}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Novilhas</h3>
              <User className="w-6 h-6 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{metricas.novilhas}</div>
            <div className="mt-2 text-xs text-gray-500">
              {metricas.totalNascimentos > 0 
                ? `${((metricas.novilhas / metricas.totalNascimentos) * 100).toFixed(1)}% do total`
                : '0% do total'}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Mortandade</h3>
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div className="text-3xl font-bold text-red-600">{metricas.totalMortos}</div>
            <div className="mt-2 text-xs text-gray-500">
              Taxa: {metricas.taxaMortandade}% • {metricas.totalNascimentos > 0 
                ? `${metricas.totalNascimentos - metricas.totalMortos} vivos`
                : '0 vivos'}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-pink-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Taxa Desmama</h3>
              <BarChart3 className="w-6 h-6 text-pink-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">{metricas.taxaDesmama}%</div>
            <div className="mt-2 text-xs text-gray-500">
              {metricas.totalDesmamas} de {metricas.totalNascimentos} nascimentos
            </div>
          </div>
        </div>

        {/* Cards de Sexo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Distribuição por Sexo</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Venus className="w-5 h-5 text-pink-500" />
                  <span className="text-sm text-gray-600">Fêmeas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mars className="w-5 h-5 text-blue-500" />
                  <span className="text-sm text-gray-600">Machos</span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Fêmeas</span>
                  <span className="font-semibold text-gray-900">{metricas.femeas}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-pink-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${metricas.totalNascimentos > 0 ? (metricas.femeas / metricas.totalNascimentos) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Machos</span>
                  <span className="font-semibold text-gray-900">{metricas.machos}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${metricas.totalNascimentos > 0 ? (metricas.machos / metricas.totalNascimentos) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nascimentos por Mês (Últimos 12 meses)</h3>
            <div className="space-y-3">
              {metricas.nascimentosPorMes.map((item, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.mes}</span>
                    <span className="font-semibold text-gray-900">{item.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(item.total / maxNascimentosMes) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gráficos por Fazenda e Raça */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Nascimentos por Fazenda</h3>
            </div>
            {metricas.porFazenda.length > 0 ? (
              <div className="space-y-3">
                {metricas.porFazenda.slice(0, 5).map((fazenda, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium truncate">{fazenda.nome}</span>
                      <span className="font-semibold text-gray-900">{fazenda.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${metricas.totalNascimentos > 0 
                            ? (fazenda.total / metricas.totalNascimentos) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Nenhuma fazenda cadastrada</p>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top Raças</h3>
            </div>
            {metricas.totaisPorRaca.length > 0 ? (
              <div className="space-y-3">
                {metricas.totaisPorRaca.map(({ raca, total }) => (
                  <div key={raca}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{raca}</span>
                      <span className="font-semibold text-gray-900">{total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${metricas.totalNascimentos > 0 
                            ? (total / metricas.totalNascimentos) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Nenhuma raça cadastrada</p>
            )}
          </div>
        </div>

        {/* Link para página principal */}
        <div className="bg-white rounded-xl shadow-md p-6 border-2 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Ver todos os nascimentos</h3>
              <p className="text-sm text-gray-600">Acesse a planilha completa com todos os registros</p>
            </div>
            <Link
              to="/"
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Ver Planilha
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

