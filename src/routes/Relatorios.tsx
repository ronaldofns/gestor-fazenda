/**
 * Relatórios e Análises (item 17 - Sprint 5)
 * Comparativos temporais e relatórios personalizados.
 */

import { useMemo, useState, useEffect } from 'react';
import { useFazendaContext } from '../hooks/useFazendaContext';
import { useRebanhoMetrics, FiltrosDashboard } from '../hooks/useRebanhoMetrics';
import { useAppSettings } from '../hooks/useAppSettings';
import { usePermissions } from '../hooks/usePermissions';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getTitleTextClass } from '../utils/themeHelpers';
import { Icons } from '../utils/iconMapping';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { exportarDashboardPDF, exportarDashboardExcel } from '../utils/exportarDashboard';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

export default function Relatorios() {
  const { fazendaAtivaId } = useFazendaContext();
  const { appSettings } = useAppSettings();
  const { hasPermission } = usePermissions();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const podeExportarDados = hasPermission('exportar_dados');

  const [filtroPeriodo, setFiltroPeriodo] = useState<3 | 6 | 12>(12);
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);

  const filtros: FiltrosDashboard = useMemo(() => ({
    periodoMeses: filtroPeriodo
  }), [filtroPeriodo]);

  const metrics = useRebanhoMetrics(fazendaAtivaId || undefined, filtros);

  const [isDark, setIsDark] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const textColor = isDark ? '#cbd5e1' : '#4b5563';
  const gridColor = isDark ? '#475569' : '#e5e7eb';

  const evolucaoData = useMemo(() =>
    metrics.evolucaoRebanho.map((e) => ({
      mes: e.mes,
      total: e.total,
      nascimentos: e.nascimentos,
      mortes: e.mortes
    })),
    [metrics.evolucaoRebanho]
  );

  const pieData = useMemo(() =>
    metrics.tiposOrdenados.slice(0, 7).map((t) => ({ name: t.tipo, value: t.total })),
    [metrics.tiposOrdenados]
  );

  const fazendasData = useMemo(() =>
    metrics.distribuicaoPorFazenda.slice(0, 10).map((f) => ({
      nome: f.nome.length > 15 ? f.nome.slice(0, 15) + '…' : f.nome,
      total: f.total,
      vivos: f.vivos,
      bezerros: f.bezerros,
      vacas: f.vacas
    })),
    [metrics.distribuicaoPorFazenda]
  );

  const dadosParaExportar = useMemo(() => ({
    totalAnimais: metrics.totalAnimais,
    totalVivos: metrics.totalVivos,
    totalMortos: metrics.totalMortos,
    variacaoMes: metrics.variacaoMes,
    gmdMedio: metrics.gmdMedio,
    iepMedio: metrics.iepMedio,
    taxaDesmama: metrics.taxaDesmama,
    taxaMortalidade: metrics.taxaMortalidade,
    distribuicaoPorFazenda: metrics.distribuicaoPorFazenda.map((f) => ({
      nome: f.nome,
      total: f.total,
      vivos: f.vivos,
      mortos: f.mortos,
      vacas: f.vacas,
      bezerros: f.bezerros,
      novilhas: f.novilhas,
      outros: f.outros,
      percentual: f.percentual
    })),
    benchmarkingFazendas: metrics.distribuicaoPorFazenda.map((f) => ({
      nome: f.nome,
      total: f.total,
      nascimentos12m: 0,
      mortes12m: 0,
      gmdMedio: metrics.gmdMedio,
      taxaDesmama: metrics.taxaDesmama
    }))
  }), [metrics]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${getTitleTextClass(primaryColor)}`}>
            Relatórios e Análises
          </h1>
          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Comparativos temporais e distribuição do rebanho
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(Number(e.target.value) as 3 | 6 | 12)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100"
          >
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
          {podeExportarDados && (
          <div className="relative">
            <button
              onClick={() => setMenuExportarAberto((v) => !v)}
              className={`${getPrimaryButtonClass(primaryColor)} text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm`}
            >
              <Icons.Download className="w-4 h-4" />
              Exportar
            </button>
            {menuExportarAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuExportarAberto(false)} />
                <div className="absolute right-0 mt-1 py-1 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-20">
                  <button
                    onClick={() => {
                      exportarDashboardPDF(dadosParaExportar);
                      setMenuExportarAberto(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => {
                      exportarDashboardExcel(dadosParaExportar);
                      setMenuExportarAberto(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    Excel
                  </button>
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-slate-400">Total de animais</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{metrics.totalAnimais}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-slate-400">Vivos</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{metrics.totalVivos}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-slate-400">Matrizes</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{metrics.totalMatrizes}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-slate-400">Variação (mês)</p>
          <p className={`text-2xl font-bold ${metrics.variacaoMes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {metrics.variacaoMes >= 0 ? '+' : ''}{metrics.variacaoMes}
          </p>
        </div>
      </div>

      {/* Evolução temporal */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Evolução do rebanho</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucaoData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="mes" tick={{ fill: textColor }} fontSize={12} />
              <YAxis tick={{ fill: textColor }} fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}` }}
                labelStyle={{ color: textColor }}
              />
              <Legend />
              <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="nascimentos" name="Nascimentos" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="mortes" name="Mortes" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por tipo */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Distribuição por tipo</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Por fazenda */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Animais por fazenda (top 10)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fazendasData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis type="number" tick={{ fill: textColor }} fontSize={12} />
                <YAxis type="category" dataKey="nome" tick={{ fill: textColor }} fontSize={11} width={55} />
                <Tooltip
                  contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${gridColor}` }}
                />
                <Legend />
                <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="vivos" name="Vivos" fill="#10b981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="bezerros" name="Bezerros" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="vacas" name="Vacas" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
