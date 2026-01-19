import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/dexieDB';
import useSync from '../hooks/useSync';
import { useAlertSettings } from '../hooks/useAlertSettings';
import { useNotifications } from '../hooks/useNotifications';
import { useFazendaContext } from '../hooks/useFazendaContext';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses, getPrimaryBgClass } from '../utils/themeHelpers';
import { calcularGMDAcumulado } from '../utils/calcularGMD';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { CustomTooltip, PercentageTooltip, ComparativeTooltip } from '../components/ChartTooltip';
import { useAdvancedMetrics } from '../hooks/useAdvancedMetrics';

export default function Dashboard() {
  useSync();
  const { alertSettings } = useAlertSettings();
  const notificacoes = useNotifications();
  const { fazendaAtivaId } = useFazendaContext();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  
  // Métricas avançadas
  const metricasAvancadas = useAdvancedMetrics(fazendaAtivaId || undefined);
  
  // Detectar tema atual para ajustar cores dos gráficos
  const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#cbd5e1' : '#4b5563';
  const gridColor = isDark ? '#475569' : '#e5e7eb';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipText = isDark ? '#f1f5f9' : '#111827';
  const tooltipBorder = isDark ? '#475569' : '#e5e7eb';
  
  const nascimentosTodosRaw = useLiveQuery(() => db.nascimentos.toArray(), []) || [];
  const desmamas = useLiveQuery(() => db.desmamas.toArray(), []) || [];
  const pesagens = useLiveQuery(() => db.pesagens.toArray(), []) || [];
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
    
    let resultado = Array.from(uniqueByUuid.values());
    
    // Aplicar filtro por fazenda ativa
    if (fazendaAtivaId) {
      resultado = resultado.filter(n => n.fazendaId === fazendaAtivaId);
    }
    
    return resultado.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
  }, [nascimentosTodosRaw, fazendaAtivaId]);

  // Mapas auxiliares
  const fazendaMap = useMemo(() => {
    const map = new Map<string, string>();
    fazendas.forEach((f) => {
      if (f.id) map.set(f.id, f.nome || '');
    });
    return map;
  }, [fazendas]);

  const matrizes = useLiveQuery(() => db.matrizes.toArray(), []) || [];
  const matrizMap = useMemo(() => {
    const map = new Map<string, string>(); // ID -> identificador
    matrizes.forEach((m) => {
      if (m.id && m.identificador) {
        map.set(m.id, m.identificador);
      }
    });
    return map;
  }, [matrizes]);

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
        totaisPorRaca: [],
        gmdMedio: null,
        gmdAnimais: 0,
        intervaloPartoDias: null,
        intervalosParto: 0
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
        const raca = n.raca;
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

    // Intervalo parto-parto médio por matriz
    const nascimentosPorMatriz = new Map<string, Date[]>();
    nascimentosTodos.forEach((n) => {
      if (!n.matrizId) return;
      const dataBase = n.dataNascimento || n.createdAt;
      const data = parseDate(dataBase);
      if (!data) return;
      const lista = nascimentosPorMatriz.get(n.matrizId) || [];
      lista.push(data);
      nascimentosPorMatriz.set(n.matrizId, lista);
    });

    const intervalosDias: number[] = [];
    nascimentosPorMatriz.forEach((datas) => {
      if (!Array.isArray(datas) || datas.length < 2) return;
      const ordenadas = [...datas].sort((a, b) => a.getTime() - b.getTime());
      for (let i = 1; i < ordenadas.length; i++) {
        const diff = Math.floor((ordenadas[i].getTime() - ordenadas[i - 1].getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 0) intervalosDias.push(diff);
      }
    });

    const intervaloPartoDias = intervalosDias.length > 0
      ? intervalosDias.reduce((sum, d) => sum + d, 0) / intervalosDias.length
      : null;

    // GMD médio baseado em pesagens por animal
    const pesagensPorAnimal = new Map<string, typeof pesagens>();
    if (Array.isArray(pesagens) && pesagens.length > 0) {
      pesagens.forEach((p) => {
        if (!p.nascimentoId) return;
        const lista = pesagensPorAnimal.get(p.nascimentoId) || [];
        lista.push(p);
        pesagensPorAnimal.set(p.nascimentoId, lista);
      });
    }

    const gmdValores: number[] = [];
    pesagensPorAnimal.forEach((lista) => {
      if (!Array.isArray(lista) || lista.length < 2) return;
      const gmd = calcularGMDAcumulado(lista);
      if (gmd !== null && Number.isFinite(gmd)) {
        gmdValores.push(gmd);
      }
    });

    const gmdMedio = gmdValores.length > 0
      ? gmdValores.reduce((sum, v) => sum + v, 0) / gmdValores.length
      : null;

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
      totaisPorRaca,
      gmdMedio,
      gmdAnimais: gmdValores.length,
      intervaloPartoDias,
      intervalosParto: intervalosDias.length
    };
  }, [nascimentosTodos, desmamas, fazendas, pesagens]);

  const maxNascimentosMes = useMemo(() => {
    if (!metricas.nascimentosPorMes || metricas.nascimentosPorMes.length === 0) return 1;
    return Math.max(...metricas.nascimentosPorMes.map(m => m.total), 1);
  }, [metricas.nascimentosPorMes]);

  const comparativoFazendas = useMemo(() => {
    if (!nascimentosTodos || !Array.isArray(nascimentosTodos) || nascimentosTodos.length === 0) {
      return [];
    }

    const mapa = new Map<string, { fazendaId: string; nome: string; total: number; mortos: number; desmamas: number }>();

    nascimentosTodos.forEach((n) => {
      const fazendaId = n.fazendaId || 'sem-fazenda';
      const nome = fazendaMap.get(n.fazendaId) || 'Sem fazenda';
      const existente = mapa.get(fazendaId) || { fazendaId, nome, total: 0, mortos: 0, desmamas: 0 };

      existente.total += 1;
      if (n.morto) existente.mortos += 1;
      if (desmamaSet.has(n.id)) existente.desmamas += 1;

      mapa.set(fazendaId, existente);
    });

    return Array.from(mapa.values())
      .map((f) => ({
        ...f,
        vivos: f.total - f.mortos,
        taxaMortandade: f.total > 0 ? Number(((f.mortos / f.total) * 100).toFixed(1)) : 0,
        taxaDesmama: f.total > 0 ? Number(((f.desmamas / f.total) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [nascimentosTodos, desmamaSet, fazendaMap]);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-950 dark:to-slate-900">
      <div className="p-4 sm:p-6 text-gray-900 dark:text-slate-100">

        {/* Resumo de Alertas */}
        {notificacoes.total > 0 && (
          <div className="mb-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100/70 dark:bg-amber-900/30">
                    <Icons.Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      Resumo de Notificações
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {notificacoes.total} {notificacoes.total === 1 ? 'alerta pendente' : 'alertas pendentes'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {notificacoes.desmamaAtrasada.length > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-600/90 dark:text-white font-medium flex items-center gap-1">
                      <Icons.AlertTriangle className="w-3 h-3" />
                      Desmama: {notificacoes.desmamaAtrasada.length}
                    </span>
                  )}
                  {notificacoes.mortalidadeAlta.length > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-600/90 dark:text-white font-medium flex items-center gap-1">
                      <Icons.AlertTriangle className="w-3 h-3" />
                      Mortalidade: {notificacoes.mortalidadeAlta.length}
                    </span>
                  )}
                  {notificacoes.pesoForaPadrao.length > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-600/90 dark:text-white font-medium flex items-center gap-1">
                      <Icons.Scale className="w-3 h-3" />
                      Peso: {notificacoes.pesoForaPadrao.length}
                    </span>
                  )}
                  {(notificacoes.vacinasVencidas.length + notificacoes.vacinasVencendo.length) > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-600/90 dark:text-white font-medium flex items-center gap-1">
                      <Icons.Injection className="w-3 h-3" />
                      Vacinas: {notificacoes.vacinasVencidas.length + notificacoes.vacinasVencendo.length}
                    </span>
                  )}
                  {notificacoes.dadosIncompletos.length > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-600/90 dark:text-white font-medium flex items-center gap-1">
                      <Icons.FileWarning className="w-3 h-3" />
                      Dados: {notificacoes.dadosIncompletos.length}
                    </span>
                  )}
                  {notificacoes.matrizesSemCadastro.length > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-600/90 dark:text-white font-medium flex items-center gap-1">
                      <Icons.Cow className="w-3 h-3" />
                      Matrizes: {notificacoes.matrizesSemCadastro.length}
                    </span>
                  )}
                  <Link
                    to="/notificacoes"
                    className={`text-xs font-semibold px-4 py-1.5 rounded-full transition-colors flex items-center gap-1 ${getPrimaryBgClass(primaryColor)} text-white hover:opacity-90`}
                  >
                    <Icons.Eye className="w-3 h-3" />
                    Ver todos
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cards de Métricas Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
          <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border-l-4 ${getThemeClasses(primaryColor, 'border')} hover:shadow-md transition-shadow min-w-0`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                Total Nascimentos
              </h3>
              <Icons.TrendingUp className={`w-6 h-6 ${getThemeClasses(primaryColor, 'text')}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{metricas.totalNascimentos}</div>
            <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              {metricas.nascimentosEsteAno} este ano • {metricas.nascimentosEsteMes} este mês
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border-l-4 border-purple-500 hover:shadow-md transition-shadow min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">Vacas</h3>
              <Icons.Vaca className="w-6 h-6 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{metricas.vacas}</div>
            <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              {metricas.totalNascimentos > 0 
                ? `${((metricas.vacas / metricas.totalNascimentos) * 100).toFixed(1)}% do total`
                : '0% do total'}
            </div>
          </div>

          <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border-l-4 ${getThemeClasses(primaryColor, 'border')} hover:shadow-md transition-shadow min-w-0`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">Novilhas</h3>
              <Icons.Novilha className={`w-6 h-6 ${getThemeClasses(primaryColor, 'text')}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{metricas.novilhas}</div>
            <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              {metricas.totalNascimentos > 0 
                ? `${((metricas.novilhas / metricas.totalNascimentos) * 100).toFixed(1)}% do total`
                : '0% do total'}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border-l-4 border-red-500 hover:shadow-md transition-shadow min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">Mortandade</h3>
              <Icons.AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">{metricas.totalMortos}</div>
            <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              Taxa: {metricas.taxaMortandade}% • {metricas.totalNascimentos > 0 
                ? `${metricas.totalNascimentos - metricas.totalMortos} vivos`
                : '0 vivos'}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border-l-4 border-pink-500 hover:shadow-md transition-shadow min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">Taxa Desmama</h3>
              <Icons.BarChart3 className="w-6 h-6 text-pink-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">{metricas.taxaDesmama}%</div>
            <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              {metricas.totalDesmamas} de {metricas.totalNascimentos} nascimentos
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border-l-4 border-emerald-500 hover:shadow-md transition-shadow min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">GMD médio</h3>
                <p className="text-xs text-gray-500 dark:text-slate-500">Ganho Médio Diário</p>
              </div>
              <Icons.TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {metricas.gmdMedio !== null ? `${metricas.gmdMedio.toFixed(2)}` : '-'}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              kg/dia • {metricas.gmdAnimais} animal(is) com pesagens
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border-l-4 border-indigo-500 hover:shadow-md transition-shadow min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">Intervalo parto–parto</h3>
                <p className="text-xs text-gray-500 dark:text-slate-500">Média entre partos</p>
              </div>
              <Icons.Calendar className="w-6 h-6 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {metricas.intervaloPartoDias !== null ? `${Math.round(metricas.intervaloPartoDias)} d` : '-'}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              {metricas.intervaloPartoDias !== null
                ? `~${(metricas.intervaloPartoDias / 30.4).toFixed(1)} meses • ${metricas.intervalosParto} intervalo(s)`
                : 'Sem intervalos suficientes'}
            </div>
          </div>
        </div>

        {/* Cards de Sexo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Distribuição por Sexo</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Icons.Venus className="w-5 h-5 text-pink-500" />
                  <span className="text-xs text-gray-600 dark:text-slate-300">Fêmeas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icons.Mars className={`w-5 h-5 ${getThemeClasses(primaryColor, 'text')}`} />
                  <span className="text-xs text-gray-600 dark:text-slate-300">Machos</span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-slate-300">Fêmeas</span>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">{metricas.femeas}</span>
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
                  <span className="text-gray-600 dark:text-slate-300">Machos</span>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">{metricas.machos}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-green-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${metricas.totalNascimentos > 0 ? (metricas.machos / metricas.totalNascimentos) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">Nascimentos por Mês (Últimos 12 meses)</h3>
            <div className="space-y-3">
              {metricas.nascimentosPorMes.map((item, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-slate-300">{item.mes}</span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100">{item.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`bg-gradient-to-r ${getThemeClasses(primaryColor, 'gradient-to')} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${(item.total / maxNascimentosMes) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gráficos interativos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Nascimentos (últimos 12 meses)</h3>
              <span className="text-xs text-gray-500 dark:text-slate-400">Gráfico de linha</span>
            </div>
            {metricas.nascimentosPorMes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">Sem dados suficientes.</p>
            ) : (
              <div className="w-full" style={{ height: '150px' }}>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={metricas.nascimentosPorMes} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 10, fill: textColor }}
                      tickLine={false}
                      axisLine={{ stroke: gridColor }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: textColor }}
                      tickLine={false}
                      axisLine={{ stroke: gridColor }}
                    />
                    <Tooltip
                      contentStyle={{ 
                        fontSize: 11, 
                        backgroundColor: tooltipBg, 
                        color: tooltipText,
                        border: `1px solid ${tooltipBorder}`,
                        borderRadius: '6px'
                      }}
                      formatter={(value: any) => [`${value} nascimentos`, 'Total']}
                      labelStyle={{ fontSize: 11, color: tooltipText }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Mortalidade por fazenda (janela)</h3>
              <span className="text-xs text-gray-500 dark:text-slate-400">Gráfico de barras</span>
            </div>
            {alertas.mortalidadeAlta.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-slate-400">Nenhuma fazenda acima do limiar configurado.</p>
            ) : (
              <div className="w-full" style={{ height: '190px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={alertas.mortalidadeAlta.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 30, right: 10, left: 140, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 10, fill: textColor }}
                    />
                    <YAxis
                      type="category"
                      dataKey="fazenda"
                      tick={{ fontSize: 10, fill: textColor }}
                      tickLine={false}
                      width={140}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={{ 
                        fontSize: 11, 
                        backgroundColor: tooltipBg, 
                        color: tooltipText,
                        border: `1px solid ${tooltipBorder}`,
                        borderRadius: '6px'
                      }}
                      formatter={(value: any) => [`${value}%`, 'Taxa de mortalidade']}
                      labelStyle={{ fontSize: 11, color: tooltipText }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="left"
                      iconSize={10}
                      wrapperStyle={{ 
                        fontSize: 11, 
                        paddingBottom: 10, 
                        paddingLeft: 10, 
                        paddingTop: 5,
                        color: textColor 
                      }}
                    />
                    <Bar
                      dataKey="taxa"
                      name="Taxa de mortalidade"
                      fill="#ef4444"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Gráficos por Fazenda e Raça */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icons.Building2 className="w-5 h-5 text-gray-600 dark:text-slate-300" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Comparativo por Fazenda</h3>
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400">Nasc. x Desm.</span>
            </div>
            {comparativoFazendas.length > 0 ? (
              <div className="w-full" style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={comparativoFazendas.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 5, right: 0, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: textColor }}
                    />
                    <YAxis
                      type="category"
                      dataKey="nome"
                      tick={{ fontSize: 10, fill: textColor }}
                      tickLine={false}
                      width={140}
                      interval={0}
                    />
                    <Tooltip
                      contentStyle={{ 
                        fontSize: 11, 
                        backgroundColor: tooltipBg, 
                        color: tooltipText,
                        border: `1px solid ${tooltipBorder}`,
                        borderRadius: '6px'
                      }}
                      formatter={(value: any, name: any) => {
                        if (name === 'Nascimentos') return [`${value} nascimentos`, name];
                        if (name === 'Desmamas') return [`${value} desmamas`, name];
                        return [value, name];
                      }}
                      labelStyle={{ fontSize: 11, color: tooltipText }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="left"
                      iconSize={10}
                      wrapperStyle={{ 
                        fontSize: 11, 
                        paddingBottom: 10, 
                        paddingLeft: 10, 
                        paddingTop: 5,
                        color: textColor 
                      }}
                    />
                    <Bar
                      dataKey="total"
                      name="Nascimentos"
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={20}
                    />
                    <Bar
                      dataKey="desmamas"
                      name="Desmamas"
                      fill="#22c55e"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={20}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-slate-400 text-sm">Nenhuma fazenda cadastrada</p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <Icons.BarChart3 className="w-5 h-5 text-gray-600 dark:text-slate-300" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Top Raças</h3>
            </div>
            {metricas.totaisPorRaca.length > 0 ? (
              <div className="space-y-3">
                {metricas.totaisPorRaca.map(({ raca, total }) => (
                  <div key={raca}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-slate-300 font-medium">{raca}</span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100">{total}</span>
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
              <p className="text-gray-500 dark:text-slate-400 text-sm">Nenhuma raça cadastrada</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

