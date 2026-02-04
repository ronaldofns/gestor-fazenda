import { Link } from 'react-router-dom';
import { Icons } from '../utils/iconMapping';
import { useAlertas, Alerta } from '../hooks/useAlertas';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { useAuth } from '../hooks/useAuth';

interface AlertasBannerProps {
  fazendaId?: string;
}

export default function AlertasBanner({ fazendaId }: AlertasBannerProps) {
  const { user } = useAuth();
  const { alertasNaoLidos, totalNaoLidos } = useAlertas(fazendaId, user?.id);
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;

  // Contar alertas de alta prioridade não lidos
  const alertasAltaNaoLidos = alertasNaoLidos.filter(a => a.severidade === 'alta').length;

  if (totalNaoLidos === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <Icons.CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-900 dark:text-green-100">
              ✅ Tudo em ordem!
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
              Nenhum alerta pendente no momento
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/10 dark:to-red-900/10 border border-orange-200 dark:border-orange-800 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="relative">
              <Icons.AlertTriangle className="w-7 h-7 text-orange-600 dark:text-orange-400" />
              {alertasAltaNaoLidos > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {alertasAltaNaoLidos}
                </span>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              🚨 {totalNaoLidos} {totalNaoLidos === 1 ? 'Alerta Não Lido' : 'Alertas Não Lidos'}
            </h3>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
              {alertasAltaNaoLidos > 0 && (
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  {alertasAltaNaoLidos} de alta prioridade
                </span>
              )}
            </p>
          </div>
        </div>
        
        <Link
          to="/notificacoes"
          className="flex-shrink-0 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-slate-300 transition-colors flex items-center gap-2"
        >
          Ver Todos
          <Icons.ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Lista de Alertas Não Lidos */}
      <div className="space-y-2">
        {alertasNaoLidos.slice(0, 3).map((alerta) => (
          <AlertaItem key={alerta.id} alerta={alerta} />
        ))}
        
        {alertasNaoLidos.length > 3 && (
          <div className="text-center pt-2">
            <Link
              to="/notificacoes"
              className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 font-medium inline-flex items-center gap-1"
            >
              Ver mais {alertasNaoLidos.length - 3} {alertasNaoLidos.length - 3 === 1 ? 'alerta' : 'alertas'}
              <Icons.ChevronDown className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertaItem({ alerta }: { alerta: Alerta }) {
  const IconComponent = Icons[alerta.icone as keyof typeof Icons] || Icons.AlertCircle;
  
  const getBgColor = (cor: string) => {
    switch (cor) {
      case 'red': return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-800';
      case 'amber': return 'bg-amber-100 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800';
      case 'orange': return 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800';
      case 'purple': return 'bg-purple-100 dark:bg-purple-900/20 border-purple-300 dark:border-purple-800';
      default: return 'bg-gray-100 dark:bg-slate-800 border-gray-300 dark:border-slate-700';
    }
  };

  const getIconColor = (cor: string) => {
    switch (cor) {
      case 'red': return 'text-red-600 dark:text-red-400';
      case 'amber': return 'text-amber-600 dark:text-amber-400';
      case 'orange': return 'text-orange-600 dark:text-orange-400';
      case 'purple': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-gray-600 dark:text-slate-400';
    }
  };

  const getTextColor = (cor: string) => {
    switch (cor) {
      case 'red': return 'text-red-900 dark:text-red-100';
      case 'amber': return 'text-amber-900 dark:text-amber-100';
      case 'orange': return 'text-orange-900 dark:text-orange-100';
      case 'purple': return 'text-purple-900 dark:text-purple-100';
      default: return 'text-gray-900 dark:text-slate-100';
    }
  };

  return (
    <div className={`${getBgColor(alerta.cor)} border rounded-lg p-3 hover:shadow-sm transition-shadow`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <IconComponent className={`w-5 h-5 ${getIconColor(alerta.cor)}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`text-sm font-semibold ${getTextColor(alerta.cor)}`}>
              {alerta.titulo}
            </h4>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
              alerta.severidade === 'alta' 
                ? 'bg-red-500 text-white' 
                : alerta.severidade === 'media'
                ? 'bg-amber-500 text-white'
                : 'bg-blue-500 text-white'
            }`}>
              {alerta.severidade.toUpperCase()}
            </span>
          </div>
          <p className={`text-xs ${getTextColor(alerta.cor)} opacity-90`}>
            {alerta.mensagem}
          </p>
        </div>
      </div>
    </div>
  );
}
