import { TooltipProps } from 'recharts';

interface CustomTooltipProps extends TooltipProps<number, string> {
  title?: string;
}

export function CustomTooltip({ active, payload, label, title }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl p-3 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
        {title || label}
      </p>
      <div className="space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-gray-600 dark:text-slate-400">
                {entry.name}:
              </span>
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
              {typeof entry.value === 'number' ? entry.value.toLocaleString('pt-BR') : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PercentageTooltipProps extends TooltipProps<number, string> {
  total?: number;
}

export function PercentageTooltip({ active, payload, label, total }: PercentageTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0].value as number;
  const percentage = total && total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl p-3 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95">
      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
        {label}
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: payload[0].color }}
            />
            <span className="text-xs text-gray-600 dark:text-slate-400">
              Quantidade:
            </span>
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
            {value.toLocaleString('pt-BR')}
          </span>
        </div>
        {total && (
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-200 dark:border-slate-700">
            <span className="text-xs text-gray-600 dark:text-slate-400">
              Percentual:
            </span>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">
              {percentage}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ComparativeTooltipProps extends TooltipProps<number, string> {}

export function ComparativeTooltip({ active, payload, label }: ComparativeTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const nascimentos = payload.find(p => p.dataKey === 'nascimentos')?.value as number || 0;
  const desmamas = payload.find(p => p.dataKey === 'desmamas')?.value as number || 0;
  const taxa = nascimentos > 0 ? ((desmamas / nascimentos) * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl p-3 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-95 min-w-[180px]">
      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2 truncate">
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-gray-600 dark:text-slate-400">
                {entry.name}:
              </span>
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
              {(entry.value as number).toLocaleString('pt-BR')}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 pt-1.5 mt-1.5 border-t border-gray-200 dark:border-slate-700">
          <span className="text-xs text-gray-600 dark:text-slate-400 font-medium">
            Taxa:
          </span>
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {taxa}%
          </span>
        </div>
      </div>
    </div>
  );
}
