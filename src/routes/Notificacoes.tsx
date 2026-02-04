import { useState } from 'react';
import { Icons } from '../utils/iconMapping';
import { Link } from 'react-router-dom';
import { useAlertas, Alerta } from '../hooks/useAlertas';
import { useFazendaContext } from '../hooks/useFazendaContext';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryBgClass } from '../utils/themeHelpers';
import { useAuth } from '../hooks/useAuth';
import { marcarAlertaComoLido, marcarAlertaComoNaoLido, marcarTodosAlertasComoLidos } from '../utils/alertasLidos';
import { NotificacaoLida } from '../db/models';

export default function Notificacoes() {
  const { fazendaAtivaId } = useFazendaContext();
  const { user } = useAuth();
  const { alertas, totalAlertas, totalNaoLidos, alertasAlta, alertasMedia } = useAlertas(
    fazendaAtivaId || undefined,
    user?.id
  );
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [filtroSeveridade, setFiltroSeveridade] = useState<'todas' | 'alta' | 'media' | 'baixa'>('todas');
  const [filtroLeitura, setFiltroLeitura] = useState<'todos' | 'nao_lidos' | 'lidos'>('todos');

  const alertasFiltrados = alertas.filter(alerta => {
    // Filtro de severidade
    if (filtroSeveridade !== 'todas' && alerta.severidade !== filtroSeveridade) {
      return false;
    }
    
    // Filtro de leitura
    if (filtroLeitura === 'nao_lidos' && alerta.lido) return false;
    if (filtroLeitura === 'lidos' && !alerta.lido) return false;
    
    return true;
  });

  // Função para alternar o estado de leitura de um alerta
  const toggleAlertaLido = async (alerta: Alerta) => {
    if (!user?.id) return;

    try {
      if (alerta.lido) {
        await marcarAlertaComoNaoLido(alerta.id);
      } else {
        // Mapear tipo do alerta para tipo da notificação
        const tipoMap: Record<string, NotificacaoLida['tipo']> = {
          'desmama': 'desmama_atrasada',
          'matriz': 'matriz_improdutiva',
          'peso': 'peso_critico',
          'vacina': 'vacinas_vencidas',
          'mortalidade': 'mortalidade_alta'
        };
        const tipo = tipoMap[alerta.tipo] || 'desmama';
        await marcarAlertaComoLido(alerta.id, tipo, user.id);
      }
    } catch (error) {
      console.error('Erro ao alternar alerta:', error);
    }
  };

  // Função para marcar todos como lidos
  const marcarTodosComoLidos = async () => {
    if (!user?.id) return;

    try {
      // Obter apenas alertas não lidos
      const alertasNaoLidos = alertas.filter(a => !a.lido);
      
      const tipoMap: Record<string, NotificacaoLida['tipo']> = {
        'desmama': 'desmama_atrasada',
        'matriz': 'matriz_improdutiva',
        'peso': 'peso_critico',
        'vacina': 'vacinas_vencidas',
        'mortalidade': 'mortalidade_alta'
      };

      // Marcar todos em lote
      for (const alerta of alertasNaoLidos) {
        const tipo = tipoMap[alerta.tipo] || 'desmama';
        await marcarAlertaComoLido(alerta.id, tipo, user.id);
      }
    } catch (error) {
      console.error('Erro ao marcar todos como lidos:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-950 dark:to-slate-900">
      <div className="p-4 sm:p-6 text-gray-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getPrimaryBgClass(primaryColor)}`}>
                  <Icons.Bell className="w-6 h-6 text-white" />
                </div>
                Alertas e Notificações
              </h1>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                Sistema inteligente de monitoramento do rebanho
              </p>
            </div>
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-slate-300 transition-colors"
            >
              <Icons.ArrowLeft className="w-4 h-4" />
              Voltar ao Dashboard
            </Link>
          </div>
        </div>

        {/* Resumo de Alertas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border-l-4 border-gray-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide">
                  Total
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {totalAlertas}
                </p>
              </div>
              <Icons.AlertTriangle className="w-8 h-8 text-gray-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide">
                  Alta Prioridade
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {alertasAlta}
                </p>
              </div>
              <Icons.AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border-l-4 border-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide">
                  Média Prioridade
                </p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {alertasMedia}
                </p>
              </div>
              <Icons.Info className="w-8 h-8 text-amber-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide">
                  Baixa Prioridade
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {alertas.filter(a => a.severidade === 'baixa').length}
                </p>
              </div>
              <Icons.CheckCircle className="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 mb-6">
          {/* Filtros de Severidade */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">
              Filtrar por severidade:
            </span>
            <button
              onClick={() => setFiltroSeveridade('todas')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtroSeveridade === 'todas'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              Todas ({totalAlertas})
            </button>
            <button
              onClick={() => setFiltroSeveridade('alta')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtroSeveridade === 'alta'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30'
              }`}
            >
              Alta ({alertasAlta})
            </button>
            <button
              onClick={() => setFiltroSeveridade('media')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtroSeveridade === 'media'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/30'
              }`}
            >
              Média ({alertasMedia})
            </button>
            <button
              onClick={() => setFiltroSeveridade('baixa')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtroSeveridade === 'baixa'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30'
              }`}
            >
              Baixa ({alertas.filter(a => a.severidade === 'baixa').length})
            </button>
          </div>

          {/* Filtros de Leitura */}
          <div className="flex items-center gap-2 flex-wrap justify-between border-t border-gray-200 dark:border-slate-700 pt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                Filtrar por status:
              </span>
              <button
                onClick={() => setFiltroLeitura('todos')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filtroLeitura === 'todos'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                Todos ({totalAlertas})
              </button>
              <button
                onClick={() => setFiltroLeitura('nao_lidos')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filtroLeitura === 'nao_lidos'
                    ? 'bg-orange-600 text-white'
                    : 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/30'
                }`}
              >
                Não Lidos ({totalNaoLidos})
              </button>
              <button
                onClick={() => setFiltroLeitura('lidos')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filtroLeitura === 'lidos'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/30'
                }`}
              >
                Lidos ({totalAlertas - totalNaoLidos})
              </button>
            </div>

            {/* Botão Marcar Todos como Lidos */}
            {totalNaoLidos > 0 && (
              <button
                onClick={marcarTodosComoLidos}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Icons.CheckCircle className="w-4 h-4" />
                Marcar Todos como Lidos
              </button>
            )}
          </div>
        </div>

        {/* Lista de Alertas */}
        {totalAlertas === 0 ? (
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
            <Icons.CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-green-900 dark:text-green-100 mb-2">
              ✅ Tudo em ordem!
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300">
              Nenhum alerta pendente no momento. Seu rebanho está bem monitorado!
            </p>
          </div>
        ) : alertasFiltrados.length === 0 ? (
          <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-8 text-center">
            <Icons.Filter className="w-16 h-16 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-700 dark:text-slate-300 mb-2">
              Nenhum alerta nesta categoria
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Tente selecionar outro filtro de severidade
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alertasFiltrados.map((alerta) => (
              <AlertaCard 
                key={alerta.id} 
                alerta={alerta} 
                primaryColor={primaryColor}
                onToggleLido={toggleAlertaLido}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertaCard({ 
  alerta, 
  primaryColor, 
  onToggleLido 
}: { 
  alerta: Alerta; 
  primaryColor: ColorPaletteKey;
  onToggleLido: (alerta: Alerta) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const IconComponent = Icons[alerta.icone as keyof typeof Icons] || Icons.AlertCircle;

  const getBgColor = (cor: string) => {
    switch (cor) {
      case 'red': return 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-800';
      case 'amber': return 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-800';
      case 'orange': return 'bg-orange-50 dark:bg-orange-900/10 border-orange-300 dark:border-orange-800';
      case 'purple': return 'bg-purple-50 dark:bg-purple-900/10 border-purple-300 dark:border-purple-800';
      default: return 'bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700';
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
    <div className={`${getBgColor(alerta.cor)} border-2 rounded-xl shadow-sm hover:shadow-md transition-all`}>
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className={`p-3 rounded-lg ${
              alerta.severidade === 'alta' 
                ? 'bg-red-100 dark:bg-red-900/30' 
                : alerta.severidade === 'media'
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-blue-100 dark:bg-blue-900/30'
            }`}>
              <IconComponent className={`w-6 h-6 ${getIconColor(alerta.cor)}`} />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className={`text-lg font-bold ${getTextColor(alerta.cor)}`}>
                    {alerta.titulo}
                  </h3>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    alerta.severidade === 'alta' 
                      ? 'bg-red-500 text-white' 
                      : alerta.severidade === 'media'
                      ? 'bg-amber-500 text-white'
                      : 'bg-blue-500 text-white'
                  }`}>
                    {alerta.severidade.toUpperCase()}
                  </span>
                  {alerta.lido && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      LIDO
                    </span>
                  )}
                </div>
                <p className={`text-sm ${getTextColor(alerta.cor)} opacity-90`}>
                  {alerta.mensagem}
                </p>
              </div>
              
              {/* Botão Marcar como Lido/Não Lido */}
              <button
                onClick={() => onToggleLido(alerta)}
                className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                  alerta.lido
                    ? 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300'
                    : 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400'
                }`}
                title={alerta.lido ? 'Marcar como não lido' : 'Marcar como lido'}
              >
                {alerta.lido ? (
                  <Icons.Eye className="w-5 h-5" />
                ) : (
                  <Icons.CheckCircle className="w-5 h-5" />
                )}
              </button>
            </div>

            {alerta.detalhes && alerta.detalhes.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setExpandido(!expandido)}
                  className={`text-sm font-medium ${getIconColor(alerta.cor)} hover:opacity-80 transition-opacity flex items-center gap-1`}
                >
                  {expandido ? (
                    <>
                      <Icons.ChevronUp className="w-4 h-4" />
                      Ocultar detalhes
                    </>
                  ) : (
                    <>
                      <Icons.ChevronDown className="w-4 h-4" />
                      Ver detalhes ({alerta.detalhes.length})
                    </>
                  )}
                </button>

                {expandido && (
                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                    {alerta.detalhes.map((detalhe: any, index: number) => (
                      <div
                        key={index}
                        className="bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-gray-200 dark:border-slate-700"
                      >
                        {detalhe.brinco && (
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            🏷️ Brinco: {detalhe.brinco}
                          </p>
                        )}
                        {detalhe.nome && (
                          <p className="text-xs text-gray-600 dark:text-slate-400">
                            Nome: {detalhe.nome}
                          </p>
                        )}
                        {detalhe.dataNascimento && (
                          <p className="text-xs text-gray-600 dark:text-slate-400">
                            Nascimento: {new Date(detalhe.dataNascimento).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
