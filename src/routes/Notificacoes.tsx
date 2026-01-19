import { Icons } from '../utils/iconMapping';
import { Link } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryBgClass, getThemeClasses, getPrimaryCardClass, getPrimaryBadgeClass, getPrimarySmallButtonClass } from '../utils/themeHelpers';
import { marcarNotificacaoComoLida, marcarTodasComoLidas, chaveDesmama, chaveMortalidade, chaveDadosIncompletos, chaveMatrizSemCadastro, chavePesoForaPadrao, chaveVacina } from '../utils/notificacoesLidas';

export default function Notificacoes() {
  const notificacoes = useNotifications();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;

  const handleMarcarComoLida = async (tipo: 'desmama' | 'mortalidade' | 'dados' | 'matriz' | 'peso' | 'vacina', chave: string) => {
    try {
      await marcarNotificacaoComoLida(chave, tipo);
      // Sincronizar imediatamente após marcar como lida
      try {
        const { pushPending } = await import('../api/syncService');
        await pushPending();
      } catch (syncError) {
        console.error('Erro ao sincronizar após marcar como lida:', syncError);
        // Não mostrar erro ao usuário, apenas logar - a sincronização automática vai tentar depois
      }
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      alert('Erro ao marcar notificação como lida. Tente novamente.');
    }
  };

  const handleMarcarTodasComoLidas = async (tipo: 'desmama' | 'mortalidade' | 'dados' | 'matriz' | 'peso' | 'vacina', chaves: string[]) => {
    try {
      await marcarTodasComoLidas(tipo, chaves);
      // Sincronizar imediatamente após marcar todas como lidas
      try {
        const { pushPending } = await import('../api/syncService');
        await pushPending();
      } catch (syncError) {
        console.error('Erro ao sincronizar após marcar todas como lidas:', syncError);
        // Não mostrar erro ao usuário, apenas logar - a sincronização automática vai tentar depois
      }
    } catch (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error);
      alert('Erro ao marcar todas as notificações como lidas. Tente novamente.');
    }
  };

  return (
    <div className="p-4 sm:p-6 text-gray-900 dark:text-slate-100">

      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-amber-200 dark:border-amber-500/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icons.AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Desmama atrasada</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-600/90 dark:text-white font-medium rounded-full">
                {notificacoes.desmamaAtrasada.length} pendência(s)
              </span>
              {notificacoes.desmamaAtrasada.length > 0 && (
                <button
                  onClick={() => {
                    const chaves = notificacoes.desmamaAtrasada.map(n => chaveDesmama(n.id));
                    handleMarcarTodasComoLidas('desmama', chaves);
                  }}
                  className="text-xs px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-colors flex items-center gap-1"
                  title="Marcar todas como lidas"
                >
                  <Icons.CheckCheck className="w-3 h-3" />
                  Marcar todas
                </button>
              )}
            </div>
          </div>
          {notificacoes.desmamaAtrasada.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-slate-400">Nenhuma pendência.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {notificacoes.desmamaAtrasada.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-600/50 dark:bg-amber-900/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      Matriz {item.matrizId} {item.brinco ? `• Brinco ${item.brinco}` : ''}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                      Fazenda: {item.fazenda} • Nasc.: {item.dataNascimento || '-'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                      {item.meses} meses
                    </span>
                    <button
                      onClick={() => handleMarcarComoLida('desmama', chaveDesmama(item.id))}
                      className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded transition-colors"
                      title="Marcar como lida"
                    >
                      <Icons.Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-red-200 dark:border-red-500/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icons.AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Mortalidade alta</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-red-100 text-red-800 dark:bg-red-600/90 dark:text-white font-medium rounded-full">
                {notificacoes.mortalidadeAlta.length} alerta(s)
              </span>
              {notificacoes.mortalidadeAlta.length > 0 && (
                <button
                  onClick={() => {
                    const chaves = notificacoes.mortalidadeAlta.map(n => chaveMortalidade(n.fazendaId));
                    handleMarcarTodasComoLidas('mortalidade', chaves);
                  }}
                  className="text-xs px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors flex items-center gap-1"
                  title="Marcar todas como lidas"
                >
                  <Icons.CheckCheck className="w-3 h-3" />
                  Marcar todas
                </button>
              )}
            </div>
          </div>
          {notificacoes.mortalidadeAlta.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-slate-400">Nenhum alerta.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {notificacoes.mortalidadeAlta.map((item) => (
                <div key={item.fazendaId} className="flex items-center justify-between p-2 rounded-md border border-red-200 bg-red-50 dark:border-red-600/50 dark:bg-red-900/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{item.fazenda}</p>
                    <p className="text-xs text-gray-600 dark:text-slate-400">
                      {item.mortos} mortos de {item.total} nascimentos
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-red-700 whitespace-nowrap">
                      {item.taxa}%
                    </span>
                    <button
                      onClick={() => handleMarcarComoLida('mortalidade', chaveMortalidade(item.fazendaId))}
                      className="p-1 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-colors"
                      title="Marcar como lida"
                    >
                      <Icons.Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-green-200 dark:border-green-500/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icons.FileWarning className={`w-5 h-5 ${getThemeClasses(primaryColor, 'text')}`} />
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Dados incompletos</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-600/90 dark:text-white font-medium rounded-full">
                {notificacoes.dadosIncompletos.length} registro(s)
              </span>
              {notificacoes.dadosIncompletos.length > 0 && (
                <button
                  onClick={() => {
                    const chaves = notificacoes.dadosIncompletos.map(n => chaveDadosIncompletos(n.id));
                    handleMarcarTodasComoLidas('dados', chaves);
                  }}
                  className={`text-xs px-2 py-1 ${getPrimarySmallButtonClass(primaryColor)} text-white rounded-md transition-colors flex items-center gap-1`}
                  title="Marcar todas como lidas"
                >
                  <Icons.CheckCheck className="w-3 h-3" />
                  Marcar todas
                </button>
              )}
            </div>
          </div>
          {notificacoes.dadosIncompletos.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-slate-400">Nenhum registro com dados incompletos.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {notificacoes.dadosIncompletos.slice(0, 20).map((item) => (
                <div key={item.id} className={`flex items-start justify-between p-2 rounded-md border ${getThemeClasses(primaryColor, 'border-light')} ${getThemeClasses(primaryColor, 'bg-light')} dark:${getThemeClasses(primaryColor, 'border')}/30 dark:${getPrimaryBgClass(primaryColor)}/10`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      Matriz {item.matrizId} {item.brinco ? `• Brinco ${item.brinco}` : ''}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                      Fazenda: {item.fazenda}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.problemas.map((problema, idx) => (
                        <span key={idx} className={`text-xs px-2 py-0.5 ${getPrimaryBadgeClass(primaryColor)} rounded`}>
                          {problema}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleMarcarComoLida('dados', chaveDadosIncompletos(item.id))}
                    className={`p-1 ${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'hover-text')} hover:${getThemeClasses(primaryColor, 'bg-light')} dark:hover:${getPrimaryBgClass(primaryColor)}/20 rounded transition-colors ml-2`}
                    title="Marcar como lida"
                  >
                    <Icons.Check className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {notificacoes.dadosIncompletos.length > 20 && (
                <p className="text-xs text-gray-500 dark:text-slate-400 text-center pt-2">
                  ... e mais {notificacoes.dadosIncompletos.length - 20} registro(s)
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-purple-200 dark:border-purple-500/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icons.Cow className="w-5 h-5 text-purple-500" />
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Matrizes sem cadastro</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-600/90 dark:text-white font-medium rounded-full">
                {notificacoes.matrizesSemCadastro.length} matriz(es)
              </span>
              {notificacoes.matrizesSemCadastro.length > 0 && (
                <button
                  onClick={() => {
                    const chaves = notificacoes.matrizesSemCadastro.map(n => chaveMatrizSemCadastro(n.matrizId, n.fazendaId));
                    handleMarcarTodasComoLidas('matriz', chaves);
                  }}
                  className="text-xs px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded-md transition-colors flex items-center gap-1"
                  title="Marcar todas como lidas"
                >
                  <Icons.CheckCheck className="w-3 h-3" />
                  Marcar todas
                </button>
              )}
            </div>
          </div>
          {notificacoes.matrizesSemCadastro.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-slate-400">Todas as matrizes estão cadastradas.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {notificacoes.matrizesSemCadastro.map((item) => (
                <div key={`${item.matrizId}-${item.fazendaId}`} className="flex items-center justify-between p-2 rounded-md border border-purple-200 bg-purple-50 dark:border-purple-600/50 dark:bg-purple-900/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      Matriz {item.matrizId}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                      Fazenda: {item.fazenda}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-purple-700 whitespace-nowrap">
                      {item.totalNascimentos} nascimento(s)
                    </span>
                    <button
                      onClick={() => handleMarcarComoLida('matriz', chaveMatrizSemCadastro(item.matrizId, item.fazendaId))}
                      className="p-1 text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded transition-colors"
                      title="Marcar como lida"
                    >
                      <Icons.Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Peso Fora do Padrão */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-orange-200 dark:border-orange-500/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icons.Scale className="w-5 h-5 text-orange-500" />
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Peso fora do padrão</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200 rounded-full">
                {notificacoes.pesoForaPadrao.length} animal(is)
              </span>
              {notificacoes.pesoForaPadrao.length > 0 && (
                <button
                  onClick={() => {
                    const chaves = notificacoes.pesoForaPadrao.map(n => chavePesoForaPadrao(n.nascimentoId));
                    handleMarcarTodasComoLidas('peso', chaves);
                  }}
                  className="text-xs px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors flex items-center gap-1"
                  title="Marcar todas como lidas"
                >
                  <Icons.CheckCheck className="w-3 h-3" />
                  Marcar todas
                </button>
              )}
            </div>
          </div>
          {notificacoes.pesoForaPadrao.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-slate-400">Todos os animais estão com peso adequado.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {notificacoes.pesoForaPadrao.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded-md border border-orange-100 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {item.brinco ? `Brinco ${item.brinco}` : 'Animal sem brinco'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                      Fazenda: {item.fazenda} • Idade: {item.idadeDias} dias
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      Peso atual: <strong>{item.pesoAtual} kg</strong> • Esperado: <strong>{item.pesoMedioEsperado} kg</strong> • Diferença: <strong>{item.diferencaPercentual.toFixed(1)}%</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMarcarComoLida('peso', chavePesoForaPadrao(item.nascimentoId))}
                      className="p-1 text-orange-600 hover:text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-500/20 rounded transition-colors"
                      title="Marcar como lida"
                    >
                      <Icons.Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vacinas vencidas / vencendo */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-rose-200 dark:border-rose-500/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icons.Injection className="w-5 h-5 text-rose-500" />
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
                Vacinas vencidas / vencendo
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-rose-100 text-rose-800 dark:bg-rose-600/90 dark:text-white font-medium rounded-full">
                {notificacoes.vacinasVencidas.length + notificacoes.vacinasVencendo.length} alerta(s)
              </span>
              {(notificacoes.vacinasVencidas.length + notificacoes.vacinasVencendo.length) > 0 && (
                <button
                  onClick={() => {
                    const chaves = [
                      ...notificacoes.vacinasVencidas.map(n => chaveVacina(n.id)),
                      ...notificacoes.vacinasVencendo.map(n => chaveVacina(n.id))
                    ];
                    handleMarcarTodasComoLidas('vacina', chaves);
                  }}
                  className="text-xs px-2 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-md transition-colors flex items-center gap-1"
                  title="Marcar todas como lidas"
                >
                  <Icons.CheckCheck className="w-3 h-3" />
                  Marcar todas
                </button>
              )}
            </div>
          </div>
          {notificacoes.vacinasVencidas.length + notificacoes.vacinasVencendo.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-slate-400">Nenhuma vacina vencida ou vencendo em breve.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {notificacoes.vacinasVencidas.map((item) => (
                <div key={`vacina-vencida-${item.id}`} className="flex items-center justify-between p-2 rounded-md border border-rose-200 bg-rose-50 dark:border-rose-600/50 dark:bg-rose-900/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {item.vacina} {item.brinco ? `• Brinco ${item.brinco}` : ''}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                      Fazenda: {item.fazenda} • Aplicação: {item.dataAplicacao}
                    </p>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                      Vencida em: <strong>{item.dataVencimento}</strong> • {Math.abs(item.diasParaVencer)} dia(s) em atraso
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-rose-700 whitespace-nowrap">
                      Vencida
                    </span>
                    <button
                      onClick={() => handleMarcarComoLida('vacina', chaveVacina(item.id))}
                      className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded transition-colors"
                      title="Marcar como lida"
                    >
                      <Icons.Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {notificacoes.vacinasVencendo.map((item) => (
                <div key={`vacina-vence-${item.id}`} className="flex items-center justify-between p-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-600/50 dark:bg-amber-900/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {item.vacina} {item.brinco ? `• Brinco ${item.brinco}` : ''}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                      Fazenda: {item.fazenda} • Aplicação: {item.dataAplicacao}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Vence em: <strong>{item.dataVencimento}</strong> • {item.diasParaVencer} dia(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                      Vence em breve
                    </span>
                    <button
                      onClick={() => handleMarcarComoLida('vacina', chaveVacina(item.id))}
                      className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded transition-colors"
                      title="Marcar como lida"
                    >
                      <Icons.Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

