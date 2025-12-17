import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/dexieDB';
import useSync from '../hooks/useSync';
import { useAlertSettings } from '../hooks/useAlertSettings';
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
  const { alertSettings } = useAlertSettings();
  
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

  // Mapas auxiliares
  const fazendaMap = useMemo(() => {
    const map = new Map<string, string>();
    fazendas.forEach((f) => {
      if (f.id) map.set(f.id, f.nome || '');
    });
    return map;
  }, [fazendas]);

  const desmamaSet = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(desmamas)) {
      desmamas.forEach((d) => {
        if (d.nascimentoId) set.add(d.nascimentoId);
      });
    }
    return set;
  }, [desmamas]);

  const parseDate = (value?: string) => {
    if (!value) return null;
    // Suporte a dd/mm/yyyy
    if (value.includes('/')) {
      const [dia, mes, ano] = value.split('/');
      if (dia && mes && ano) {
        const iso = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        const dParsed = new Date(iso);
        if (!isNaN(dParsed.getTime())) return dParsed;
      }
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  const diffMeses = (a: Date, b: Date) => {
    const anos = b.getFullYear() - a.getFullYear();
    const meses = b.getMonth() - a.getMonth();
    return anos * 12 + meses;
  };

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

  const alertas = useMemo(() => {
    const agora = new Date();
    const { limiteMesesDesmama, janelaMesesMortalidade, limiarMortalidade } = alertSettings;

    // Alertas de desmama atrasada
    const desmamaAtrasada = nascimentosTodos
      .filter((n) => {
        if (n.morto) return false;
        const dataNasc = parseDate(n.dataNascimento);
        if (!dataNasc) return false;
        const meses = diffMeses(dataNasc, agora);
        const semDesmama = !desmamaSet.has(n.id);
        return semDesmama && meses >= limiteMesesDesmama;
      })
      .map((n) => {
        const dataNasc = parseDate(n.dataNascimento)!;
        const meses = diffMeses(dataNasc, agora);
        return {
          id: n.id,
          matrizId: n.matrizId,
          brinco: n.brincoNumero,
          fazenda: fazendaMap.get(n.fazendaId) || 'Sem fazenda',
          meses,
          dataNascimento: n.dataNascimento
        };
      })
      .sort((a, b) => b.meses - a.meses)
      .slice(0, 10); // limitar visual

    // Mortalidade por fazenda (janela móvel)
    const dataLimite = new Date(agora.getFullYear(), agora.getMonth() - (janelaMesesMortalidade - 1), 1);
    const estatisticas = new Map<string, { vivos: number; mortos: number; nome: string }>();

    nascimentosTodos.forEach((n) => {
      const dataRef = parseDate(n.dataNascimento) || parseDate(n.createdAt);
      if (!dataRef) return;
      if (dataRef < dataLimite) return;
      const entry = estatisticas.get(n.fazendaId) || { vivos: 0, mortos: 0, nome: fazendaMap.get(n.fazendaId) || 'Sem fazenda' };
      if (n.morto) entry.mortos += 1;
      else entry.vivos += 1;
      estatisticas.set(n.fazendaId, entry);
    });

    const mortalidadeAlta = Array.from(estatisticas.entries())
      .map(([fazendaId, dados]) => {
        const total = dados.vivos + dados.mortos;
        const taxa = total > 0 ? (dados.mortos / total) * 100 : 0;
        return {
          fazendaId,
          fazenda: dados.nome,
          taxa: Number(taxa.toFixed(2)),
          mortos: dados.mortos,
          total
        };
      })
      .filter((f) => f.total >= 5 && f.taxa >= limiarMortalidade)
      .sort((a, b) => b.taxa - a.taxa);

    return { desmamaAtrasada, mortalidadeAlta };
  }, [nascimentosTodos, desmamaSet, fazendaMap, alertSettings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">Visão geral do seu rebanho</p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Alertas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-6">
          <div className="bg-white rounded-xl shadow-md p-5 border border-amber-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-semibold text-gray-900">Alerta: Desmama atrasada</h3>
              </div>
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
                {alertSettings.limiteMesesDesmama}+ meses
              </span>
            </div>
            {alertas.desmamaAtrasada.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhum bezerro pendente de desmama no limite configurado.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto">
                {alertas.desmamaAtrasada.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-md border border-amber-100 bg-amber-50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        Matriz {item.matrizId} {item.brinco ? `• Brinco ${item.brinco}` : ''}
                      </p>
                      <p className="text-xs text-gray-600 truncate">
                        Fazenda: {item.fazenda} • Nasc.: {item.dataNascimento || '-'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                      {item.meses} meses
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Link
                to="/planilha"
                className="text-xs font-semibold text-amber-700 hover:text-amber-900"
              >
                Ver na planilha
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-5 border border-red-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-semibold text-gray-900">Alerta: Mortalidade alta</h3>
              </div>
              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                Últimos {alertSettings.janelaMesesMortalidade} meses
              </span>
            </div>
            {alertas.mortalidadeAlta.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhuma fazenda acima do limiar de {alertSettings.limiarMortalidade}% na janela.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto">
                {alertas.mortalidadeAlta.map((item) => (
                  <div key={item.fazendaId} className="flex items-center justify-between p-2 rounded-md border border-red-100 bg-red-50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.fazenda}</p>
                      <p className="text-xs text-gray-600">
                        {item.mortos} mortos de {item.total} nascimentos
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-red-700 whitespace-nowrap">
                      {item.taxa}%
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex justify-end">
              <Link
                to="/planilha"
                className="text-xs font-semibold text-red-700 hover:text-red-900"
              >
                Ver na planilha
              </Link>
            </div>
          </div>
        </div>

        {/* Cards de Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 mb-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Distribuição por Sexo</h3>
              <div className="flex items-center gap-2">
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

        {/* Gráficos básicos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Nascimentos (últimos 12 meses)</h3>
              <span className="text-xs text-gray-500">Linha</span>
            </div>
            {metricas.nascimentosPorMes.length === 0 ? (
              <p className="text-sm text-gray-500">Sem dados suficientes.</p>
            ) : (
              <div className="w-full h-36 relative">
                <svg viewBox="0 0 120 60" className="w-full h-full">
                  <defs>
                    <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const values = metricas.nascimentosPorMes.map((m) => m.total);
                    const max = Math.max(...values, 1);
                    const width = 120;
                    const height = 60;
                    const padding = 8;
                    const usableWidth = width - padding * 2;
                    const usableHeight = height - padding * 2;
                    const points = values.map((v, i) => {
                      const x = values.length === 1 ? padding : padding + (i / (values.length - 1)) * usableWidth;
                      const y = height - padding - (v / max) * usableHeight;
                      return `${x},${y}`;
                    }).join(' ');
                    const area = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;
                    return (
                      <>
                        <polyline
                          points={area}
                          fill="url(#sparkFill)"
                          stroke="none"
                          opacity="0.8"
                        />
                        <polyline
                          points={points}
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {values.map((v, i) => {
                          const x = values.length === 1 ? padding : padding + (i / (values.length - 1)) * usableWidth;
                          const y = height - padding - (v / max) * usableHeight;
                          return (
                            <circle
                              key={i}
                              cx={x}
                              cy={y}
                              r={1.6}
                              fill="#2563eb"
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
                <div className="absolute left-3 right-3 bottom-1 flex justify-between text-xs text-gray-600 leading-none pointer-events-none">
                  <span>há 12 meses</span>
                  <span>agora</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Mortalidade por fazenda (janela)</h3>
              <span className="text-xs text-gray-500">Barras</span>
            </div>
            {alertas.mortalidadeAlta.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma fazenda acima do limiar configurado.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-auto pr-1">
                {alertas.mortalidadeAlta.map((item) => (
                  <div key={item.fazendaId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium truncate">{item.fazenda}</span>
                      <span className="font-semibold text-red-600">{item.taxa}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-red-500 to-red-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(item.taxa, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Gráficos por Fazenda e Raça */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-6">
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

      </main>
    </div>
  );
}

