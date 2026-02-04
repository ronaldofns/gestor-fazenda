import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSync from '../hooks/useSync';
import { useRebanhoMetrics, FiltrosDashboard } from '../hooks/useRebanhoMetrics';
import { useNotifications } from '../hooks/useNotifications';
import { useFazendaContext } from '../hooks/useFazendaContext';
import { usePermissions } from '../hooks/usePermissions';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses, getPrimaryBgClass } from '../utils/themeHelpers';
import AlertasBanner from '../components/AlertasBanner';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { exportarDashboardPDF, exportarDashboardExcel } from '../utils/exportarDashboard';
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
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function Dashboard() {
  useSync();
  const { fazendaAtivaId } = useFazendaContext();
  const { appSettings } = useAppSettings();
  const { hasPermission } = usePermissions();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const notificacoes = useNotifications();
  const podeExportarDados = hasPermission('exportar_dados');
  
  // Filtros (conforme PROPOSTA_DASHBOARD_MODERNA - Filtros)
  const [filtroPeriodo, setFiltroPeriodo] = useState<3 | 6 | 12>(12);
  const [filtroTipoIds, setFiltroTipoIds] = useState<string[]>([]);
  const [filtroStatusIds, setFiltroStatusIds] = useState<string[]>([]);
  const [menuFiltrosAberto, setMenuFiltrosAberto] = useState(false);
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);
  
  const tiposOptions = useLiveQuery(() => db.tiposAnimal.filter(t => !t.deletedAt).toArray(), []) || [];
  const statusOptions = useLiveQuery(() => db.statusAnimal.filter(s => !s.deletedAt).toArray(), []) || [];
  
  const filtros: FiltrosDashboard = useMemo(() => ({
    periodoMeses: filtroPeriodo,
    tipoIds: filtroTipoIds.length > 0 ? filtroTipoIds : undefined,
    statusIds: filtroStatusIds.length > 0 ? filtroStatusIds : undefined
  }), [filtroPeriodo, filtroTipoIds, filtroStatusIds]);
  
  // Métricas do rebanho baseadas em ANIMAIS (com filtros)
  const metrics = useRebanhoMetrics(fazendaAtivaId || undefined, filtros);
  
  const limparFiltros = () => {
    setFiltroPeriodo(12);
    setFiltroTipoIds([]);
    setFiltroStatusIds([]);
    setMenuFiltrosAberto(false);
  };
  
  const temFiltrosAtivos = filtroTipoIds.length > 0 || filtroStatusIds.length > 0 || filtroPeriodo !== 12;
  
  // Detectar tema para gráficos (com state reativo)
  const [isDark, setIsDark] = useState(() => 
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  // Observar mudanças no tema
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const textColor = isDark ? '#cbd5e1' : '#4b5563';
  const gridColor = isDark ? '#475569' : '#e5e7eb';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipText = isDark ? '#f1f5f9' : '#111827';
  const tooltipBorder = isDark ? '#475569' : '#e5e7eb';
  
  // Cores para gráfico de pizza
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
  
  // Dados para gráfico de pizza (distribuição por tipo)
  const pieData = useMemo(() => {
    return metrics.tiposOrdenados.slice(0, 5).map(t => ({
      name: t.tipo,
      value: t.total
    }));
  }, [metrics.tiposOrdenados]);

  // Tooltip customizado para o PieChart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px'
          }}
        >
          <p style={{ color: tooltipText, margin: 0, fontWeight: 'bold' }}>
            {payload[0].name}
          </p>
          <p style={{ color: tooltipText, margin: '4px 0 0 0' }}>
            {payload[0].value} animais ({((payload[0].value / metrics.totalAnimais) * 100).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-950 dark:to-slate-900">
      <div className="p-4 sm:p-6 text-gray-900 dark:text-slate-100">
        
        {/* Header com título e info */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getPrimaryBgClass(primaryColor)}`}>
                  <Icons.BarChart3 className="w-6 h-6 text-white" />
                </div>
                Dashboard
              </h1>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                Visão geral do rebanho baseada em dados reais
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {fazendaAtivaId && (
                <div className="text-sm text-gray-600 dark:text-slate-400">
                  <Icons.Building2 className="inline w-4 h-4 mr-1" />
                  Fazenda ativa selecionada
                </div>
              )}
              {/* Botão Filtros (PROPOSTA_DASHBOARD_MODERNA) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuFiltrosAberto(!menuFiltrosAberto)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    temFiltrosAtivos
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                      : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icons.Filter className="w-4 h-4" />
                  Filtros
                  {temFiltrosAtivos && (
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </button>
                {menuFiltrosAberto && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setMenuFiltrosAberto(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-72 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">Filtros</span>
                        {temFiltrosAtivos && (
                          <button type="button" onClick={limparFiltros} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                            Limpar
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Período (evolução)</label>
                          <select
                            value={filtroPeriodo}
                            onChange={(e) => setFiltroPeriodo(Number(e.target.value) as 3 | 6 | 12)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                          >
                            <option value={3}>Últimos 3 meses</option>
                            <option value={6}>Últimos 6 meses</option>
                            <option value={12}>Últimos 12 meses</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Tipo de animal</label>
                          <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-200 dark:border-slate-600 rounded-lg p-2">
                            {tiposOptions.map((t) => (
                              <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={filtroTipoIds.includes(t.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setFiltroTipoIds((ids) => [...ids, t.id]);
                                    else setFiltroTipoIds((ids) => ids.filter((id) => id !== t.id));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-500"
                                />
                                <span className="text-gray-700 dark:text-slate-300">{t.nome}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Status</label>
                          <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-200 dark:border-slate-600 rounded-lg p-2">
                            {statusOptions.map((s) => (
                              <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={filtroStatusIds.includes(s.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setFiltroStatusIds((ids) => [...ids, s.id]);
                                    else setFiltroStatusIds((ids) => ids.filter((id) => id !== s.id));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-500"
                                />
                                <span className="text-gray-700 dark:text-slate-300">{s.nome}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {/* Exportação (requer permissão exportar_dados) */}
              {podeExportarDados && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuExportarAberto(!menuExportarAberto)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  <Icons.Download className="w-4 h-4" />
                  Exportar
                </button>
                {menuExportarAberto && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setMenuExportarAberto(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg py-1">
                      <button
                        type="button"
                        onClick={() => {
                          exportarDashboardPDF({
                            totalAnimais: metrics.totalAnimais,
                            totalVivos: metrics.totalVivos,
                            totalMortos: metrics.totalMortos,
                            variacaoMes: metrics.variacaoMes,
                            gmdMedio: metrics.gmdMedio,
                            iepMedio: metrics.iepMedio,
                            taxaDesmama: metrics.taxaDesmama,
                            taxaMortalidade: metrics.taxaMortalidade,
                            distribuicaoPorFazenda: metrics.distribuicaoPorFazenda,
                            benchmarkingFazendas: metrics.benchmarkingFazendas,
                          });
                          setMenuExportarAberto(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Icons.FileText className="w-4 h-4" />
                        PDF (resumo)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          exportarDashboardExcel({
                            totalAnimais: metrics.totalAnimais,
                            totalVivos: metrics.totalVivos,
                            totalMortos: metrics.totalMortos,
                            variacaoMes: metrics.variacaoMes,
                            gmdMedio: metrics.gmdMedio,
                            iepMedio: metrics.iepMedio,
                            taxaDesmama: metrics.taxaDesmama,
                            taxaMortalidade: metrics.taxaMortalidade,
                            distribuicaoPorFazenda: metrics.distribuicaoPorFazenda,
                            benchmarkingFazendas: metrics.benchmarkingFazendas,
                          });
                          setMenuExportarAberto(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Icons.FileSpreadsheet className="w-4 h-4" />
                        Excel (dados)
                      </button>
                    </div>
                  </>
                )}
              </div>
              )}
            </div>
          </div>
        </div>

        {/* Banner de Alertas - FASE 3 */}
        <AlertasBanner fazendaId={fazendaAtivaId || undefined} />

        {/* Cards de Métricas Principais - FASE 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          
          {/* Card: Total de Animais */}
          <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border-l-4 ${getThemeClasses(primaryColor, 'border')} hover:shadow-md transition-all duration-200`}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                  Total de Animais
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Rebanho completo</p>
              </div>
              <Icons.Cow className={`w-7 h-7 ${getThemeClasses(primaryColor, 'text')}`} />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {metrics.totalAnimais.toLocaleString('pt-BR')}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Icons.Heart className="w-3.5 h-3.5 text-green-500" />
                <span className="text-gray-600 dark:text-slate-400">
                  {metrics.totalVivos} vivos
                </span>
              </div>
              {metrics.variacaoMes !== 0 && (
                <div className={`flex items-center gap-1 ${metrics.variacaoMes > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.variacaoMes > 0 ? (
                    <Icons.TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <Icons.TrendingDown className="w-3.5 h-3.5" />
                  )}
                  <span className="font-medium">
                    {Math.abs(metrics.variacaoMes)} este mês
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card: Bezerras (Fêmeas) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border-l-4 border-pink-500 hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                  Bezerras
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Fêmeas jovens</p>
              </div>
              <Icons.Venus className="w-7 h-7 text-pink-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {metrics.bezerrasFemeas.toLocaleString('pt-BR')}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-pink-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.percentualBezerrasFemeas}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  {metrics.percentualBezerrasFemeas.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">
                Total de fêmeas: <span className="font-semibold text-gray-700 dark:text-slate-300">{metrics.femeas}</span>
              </div>
            </div>
          </div>

          {/* Card: Bezerros (Machos) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border-l-4 border-blue-500 hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                  Bezerros
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Machos jovens</p>
              </div>
              <Icons.Mars className="w-7 h-7 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {metrics.bezerrosMachos.toLocaleString('pt-BR')}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.percentualBezerrosMachos}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  {metrics.percentualBezerrosMachos.toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">
                Total de machos: <span className="font-semibold text-gray-700 dark:text-slate-300">{metrics.machos}</span>
              </div>
            </div>
          </div>

          {/* Card: Matrizes Ativas */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border-l-4 border-purple-500 hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                  Matrizes Ativas
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Com filhos registrados</p>
              </div>
              <Icons.Vaca className="w-7 h-7 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {metrics.totalMatrizes}
            </div>
            <div className="text-xs text-gray-600 dark:text-slate-400">
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {metrics.percentualMatrizes.toFixed(1)}%
              </span> das fêmeas são matrizes
            </div>
          </div>

          {/* Card: Taxa de Mortalidade */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border-l-4 border-red-500 hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                  Mortalidade
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Taxa geral</p>
              </div>
              <Icons.AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <div className="text-3xl font-bold text-red-600 mb-2">
              {metrics.taxaMortalidade.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-slate-400">
              {metrics.totalMortos} {metrics.totalMortos === 1 ? 'animal morto' : 'animais mortos'}
            </div>
          </div>

          {/* Card: Top Tipo */}
          {metrics.tiposOrdenados.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border-l-4 border-emerald-500 hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                    Tipo Predominante
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Categoria com mais animais</p>
                </div>
                <Icons.Award className="w-7 h-7 text-emerald-500" />
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                {metrics.tiposOrdenados[0].tipo}
              </div>
              <div className="text-xs text-gray-600 dark:text-slate-400">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {metrics.tiposOrdenados[0].total} animais
                </span> ({metrics.tiposOrdenados[0].percentual.toFixed(1)}%)
              </div>
            </div>
          )}

          {/* === FASE 2: MÉTRICAS DE PRODUTIVIDADE === */}
          
          {/* Card: GMD (Ganho Médio Diário) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border-l-4 border-purple-500 hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                  GMD Médio
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Ganho médio diário</p>
              </div>
              <Icons.TrendingUp className="w-7 h-7 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {metrics.gmdMedio.toFixed(2)} <span className="text-base text-gray-600 dark:text-slate-400">kg/dia</span>
            </div>
            <div className="text-xs text-gray-600 dark:text-slate-400">
              {metrics.gmdPorCategoria.length > 0 ? (
                <>
                  Melhor: <span className="font-semibold text-purple-600 dark:text-purple-400">
                    {metrics.gmdPorCategoria.sort((a, b) => b.gmd - a.gmd)[0].categoria}
                  </span> ({metrics.gmdPorCategoria.sort((a, b) => b.gmd - a.gmd)[0].gmd.toFixed(2)} kg/dia)
                </>
              ) : (
                'Sem dados de pesagens'
              )}
            </div>
          </div>

          {/* Card: IEP (Intervalo Entre Partos) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border-l-4 border-amber-500 hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                  IEP Médio
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Intervalo entre partos</p>
              </div>
              <Icons.Calendar className="w-7 h-7 text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {metrics.iepMedio > 0 ? Math.round(metrics.iepMedio) : 0} <span className="text-base text-gray-600 dark:text-slate-400">dias</span>
            </div>
            <div className="text-xs text-gray-600 dark:text-slate-400">
              {metrics.iepMedio > 0 ? (
                <>
                  {metrics.iepMedio < 365 ? (
                    <span className="text-green-600 dark:text-green-400 font-semibold">✓ Excelente</span>
                  ) : metrics.iepMedio < 425 ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">⚠ Regular</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 font-semibold">⚠ Atenção</span>
                  )}
                  {' '}({(metrics.iepMedio / 30).toFixed(1)} meses)
                </>
              ) : (
                'Sem dados suficientes'
              )}
            </div>
          </div>

          {/* Card: Taxa de Desmama */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border-l-4 border-cyan-500 hover:shadow-md transition-all duration-200">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-gray-600 dark:text-slate-400 tracking-wide uppercase">
                  Taxa de Desmama
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">% de desmamados</p>
              </div>
              <Icons.Baby className="w-7 h-7 text-cyan-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              {metrics.taxaDesmama.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-slate-400">
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                {metrics.totalDesmamas}
              </span> desmamas de <span className="font-semibold">
                {metrics.totalNascimentos}
              </span> nascimentos
            </div>
          </div>
        </div>

        {/* FASE 4: Comparativo Histórico e Tendência */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Comparativo Mês */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Icons.Calendar className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Comparativo Mensal</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">Total atual (rebanho)</span>
                <span className="font-semibold text-gray-900 dark:text-slate-100">{metrics.comparativoMes.totalAtual}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">Total no fim do mês passado</span>
                <span className="text-gray-700 dark:text-slate-300">{metrics.comparativoMes.totalAnterior}</span>
              </div>
              <div className={`flex justify-between font-medium ${metrics.comparativoMes.variacao >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                <span>Variação</span>
                <span>{metrics.comparativoMes.variacao >= 0 ? '+' : ''}{metrics.comparativoMes.variacao} ({metrics.comparativoMes.variacaoPercentual >= 0 ? '+' : ''}{metrics.comparativoMes.variacaoPercentual.toFixed(1)}%)</span>
              </div>
              <div className="border-t border-gray-200 dark:border-slate-600 pt-2 mt-2">
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Nascimentos mês passado</span>
                  <span className="font-semibold">{metrics.comparativoMes.nascimentosAnterior}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-slate-400 mt-1">
                  <span className="text-xs">Nascimentos este mês</span>
                  <span className="text-xs font-medium">{metrics.comparativoMes.nascimentosAtual}</span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-1">Por data de nascimento • apenas bezerros</p>
              </div>
            </div>
          </div>

          {/* Comparativo Ano */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Icons.Calendar className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Comparativo Anual</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">Total atual</span>
                <span className="font-semibold text-gray-900 dark:text-slate-100">{metrics.comparativoAno.totalAtual}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">12 meses atrás</span>
                <span className="text-gray-700 dark:text-slate-300">{metrics.comparativoAno.totalAnterior}</span>
              </div>
              <div className={`flex justify-between font-medium ${metrics.comparativoAno.variacao >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                <span>Variação</span>
                <span>{metrics.comparativoAno.variacao >= 0 ? '+' : ''}{metrics.comparativoAno.variacao} ({metrics.comparativoAno.variacaoPercentual >= 0 ? '+' : ''}{metrics.comparativoAno.variacaoPercentual.toFixed(1)}%)</span>
              </div>
            </div>
          </div>

          {/* Tendência do Rebanho */}
          <div className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 border-2 ${
            metrics.tendenciaRebanho === 'crescimento' ? 'border-green-500' :
            metrics.tendenciaRebanho === 'queda' ? 'border-red-500' : 'border-gray-300 dark:border-slate-600'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              {metrics.tendenciaRebanho === 'crescimento' && <Icons.TrendingUp className="w-5 h-5 text-green-500" />}
              {metrics.tendenciaRebanho === 'queda' && <Icons.TrendingDown className="w-5 h-5 text-red-500" />}
              {metrics.tendenciaRebanho === 'estavel' && <Icons.Minus className="w-5 h-5 text-gray-500" />}
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Tendência (3 meses)</h3>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-slate-100 capitalize">
              {metrics.tendenciaRebanho === 'crescimento' && 'Crescimento'}
              {metrics.tendenciaRebanho === 'queda' && 'Queda'}
              {metrics.tendenciaRebanho === 'estavel' && 'Estável'}
            </div>
            <p className={`text-sm mt-1 ${metrics.tendenciaPercentual >= 0 ? 'text-green-600 dark:text-green-400' : metrics.tendenciaPercentual < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-slate-400'}`}>
              {metrics.tendenciaPercentual >= 0 ? '+' : ''}{metrics.tendenciaPercentual.toFixed(1)}% vs 3 meses anteriores
            </p>
          </div>
        </div>

        {/* Gráficos - FASE 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          
          {/* Gráfico: Evolução do Rebanho */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  Evolução do Rebanho
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Últimos 12 meses
                </p>
              </div>
              <Icons.TrendingUp className="w-5 h-5 text-gray-400" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={metrics.evolucaoRebanho} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: textColor }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: textColor }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    backgroundColor: tooltipBg,
                    color: tooltipText,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: '8px'
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: textColor }}
                  iconSize={12}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="nascimentos"
                  name="Nascimentos"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="mortes"
                  name="Mortes"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico: Distribuição por Tipo */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  Distribuição por Tipo
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Top 5 categorias
                </p>
              </div>
              <Icons.BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props) => {
                      const { cx, cy, midAngle, innerRadius, outerRadius, percent, name } = props;
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);

                      return (
                        <text
                          x={x}
                          y={y}
                          fill={isDark ? '#f1f5f9' : '#1e293b'}
                          textAnchor={x > cx ? 'start' : 'end'}
                          dominantBaseline="central"
                          style={{ fontSize: 12, fontWeight: 'bold' }}
                        >
                          {`${name}: ${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value: string) => (
                      <span style={{ color: textColor }}>{value}</span>
                    )}
                    iconSize={12}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px]">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Nenhum dado disponível
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tabela: Distribuição por Fazenda */}
        {metrics.distribuicaoPorFazenda.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  Distribuição por Fazenda
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Performance comparativa
                </p>
              </div>
              <Icons.Building2 className="w-5 h-5 text-gray-400" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-slate-300">Fazenda</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-slate-300">Total</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-slate-300">Vivos</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-slate-300">Mortos</th>
                    <th className="text-center py-3 px-2 font-semibold text-purple-600 dark:text-purple-400">Vacas</th>
                    <th className="text-center py-3 px-2 font-semibold text-amber-600 dark:text-amber-400">Bezerros</th>
                    <th className="text-center py-3 px-2 font-semibold text-cyan-600 dark:text-cyan-400">Novilhas</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-600 dark:text-slate-400">Outros</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-slate-300">%</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.distribuicaoPorFazenda.map((fazenda, index) => (
                    <tr 
                      key={fazenda.fazendaId}
                      className={`border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${
                        index === 0 ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <td className="py-3 px-2 font-medium text-gray-900 dark:text-slate-100">
                        {fazenda.nome}
                      </td>
                      <td className="text-center py-3 px-2 text-gray-700 dark:text-slate-300 font-semibold">
                        {fazenda.total}
                      </td>
                      <td className="text-center py-3 px-2 text-green-600 dark:text-green-400">
                        {fazenda.vivos}
                      </td>
                      <td className="text-center py-3 px-2 text-red-600 dark:text-red-400">
                        {fazenda.mortos}
                      </td>
                      <td className="text-center py-3 px-2 text-purple-600 dark:text-purple-400 font-medium">
                        {fazenda.vacas}
                      </td>
                      <td className="text-center py-3 px-2 text-amber-600 dark:text-amber-400 font-medium">
                        {fazenda.bezerros}
                      </td>
                      <td className="text-center py-3 px-2 text-cyan-600 dark:text-cyan-400 font-medium">
                        {fazenda.novilhas}
                      </td>
                      <td className="text-center py-3 px-2 text-gray-600 dark:text-slate-400">
                        {fazenda.outros}
                      </td>
                      <td className="text-center py-3 px-2 text-gray-600 dark:text-slate-400">
                        {fazenda.percentual.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FASE 4: Benchmarking entre Fazendas */}
        {metrics.benchmarkingFazendas.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  Benchmarking entre Fazendas
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Comparativo: total, nascimentos, mortes, GMD e taxa de desmama (12 meses)
                </p>
              </div>
              <Icons.Award className="w-5 h-5 text-amber-500" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    <th className="text-left py-3 px-2 font-semibold text-gray-700 dark:text-slate-300">Fazenda</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-slate-300">Total</th>
                    <th className="text-center py-3 px-2 font-semibold text-green-600 dark:text-green-400">Nasc. 12m</th>
                    <th className="text-center py-3 px-2 font-semibold text-red-600 dark:text-red-400">Mortes 12m</th>
                    <th className="text-center py-3 px-2 font-semibold text-purple-600 dark:text-purple-400">GMD (kg/dia)</th>
                    <th className="text-center py-3 px-2 font-semibold text-cyan-600 dark:text-cyan-400">Taxa Desmama</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.benchmarkingFazendas.map((fazenda, index) => (
                    <tr
                      key={fazenda.fazendaId}
                      className={`border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${
                        index === 0 ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''
                      }`}
                    >
                      <td className="py-3 px-2 font-medium text-gray-900 dark:text-slate-100">
                        {fazenda.nome}
                      </td>
                      <td className="text-center py-3 px-2 text-gray-700 dark:text-slate-300 font-semibold">
                        {fazenda.total}
                      </td>
                      <td className="text-center py-3 px-2 text-green-600 dark:text-green-400">
                        {fazenda.nascimentos12m}
                      </td>
                      <td className="text-center py-3 px-2 text-red-600 dark:text-red-400">
                        {fazenda.mortes12m}
                      </td>
                      <td className="text-center py-3 px-2 text-purple-600 dark:text-purple-400 font-medium">
                        {fazenda.gmdMedio > 0 ? fazenda.gmdMedio.toFixed(2) : '-'}
                      </td>
                      <td className="text-center py-3 px-2 text-cyan-600 dark:text-cyan-400 font-medium">
                        {fazenda.taxaDesmama > 0 ? `${fazenda.taxaDesmama.toFixed(1)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
