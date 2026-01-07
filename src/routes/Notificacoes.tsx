import { Icons } from '../utils/iconMapping';
import { Link } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { marcarNotificacaoComoLida, marcarTodasComoLidas, chaveDesmama, chaveMortalidade, chaveDadosIncompletos, chaveMatrizSemCadastro } from '../utils/notificacoesLidas';

export default function Notificacoes() {
  const notificacoes = useNotifications();

  const handleMarcarComoLida = async (tipo: 'desmama' | 'mortalidade' | 'dados' | 'matriz', chave: string) => {
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

  const handleMarcarTodasComoLidas = async (tipo: 'desmama' | 'mortalidade' | 'dados' | 'matriz', chaves: string[]) => {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold">Notificações</h2>
          <p className="text-sm text-gray-600 dark:text-slate-400">Pendências detectadas pelo sistema.</p>
        </div>
        <Link
          to="/dashboard"
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          Voltar
        </Link>
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-amber-200 dark:border-amber-500/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icons.AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Desmama atrasada</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200 rounded-full">
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
                <div key={item.id} className="flex items-center justify-between p-2 rounded-md border border-amber-100 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Mortalidade alta</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200 rounded-full">
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
                <div key={item.fazendaId} className="flex items-center justify-between p-2 rounded-md border border-red-100 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10">
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

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-blue-200 dark:border-blue-500/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icons.FileWarning className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Dados incompletos</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200 rounded-full">
                {notificacoes.dadosIncompletos.length} registro(s)
              </span>
              {notificacoes.dadosIncompletos.length > 0 && (
                <button
                  onClick={() => {
                    const chaves = notificacoes.dadosIncompletos.map(n => chaveDadosIncompletos(n.id));
                    handleMarcarTodasComoLidas('dados', chaves);
                  }}
                  className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors flex items-center gap-1"
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
                <div key={item.id} className="flex items-start justify-between p-2 rounded-md border border-blue-100 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      Matriz {item.matrizId} {item.brinco ? `• Brinco ${item.brinco}` : ''}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 truncate">
                      Fazenda: {item.fazenda}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.problemas.map((problema, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 dark:bg-blue-500/30 dark:text-blue-200 rounded">
                          {problema}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleMarcarComoLida('dados', chaveDadosIncompletos(item.id))}
                    className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded transition-colors ml-2"
                    title="Marcar como lida"
                  >
                    <Check className="w-4 h-4" />
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Matrizes sem cadastro</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200 rounded-full">
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
                <div key={`${item.matrizId}-${item.fazendaId}`} className="flex items-center justify-between p-2 rounded-md border border-purple-100 bg-purple-50 dark:border-purple-500/30 dark:bg-purple-500/10">
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
      </div>
    </div>
  );
}

