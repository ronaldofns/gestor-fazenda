/**
 * Pendências do Curral (v0.4) — Lista focada no que precisa ser feito no curral:
 * Bezerros sem desmama, Vacinas vencidas, Animais sem pesagem recente.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { useFazendaContext } from '../hooks/useFazendaContext';
import { useAlertas } from '../hooks/useAlertas';
import { useAuth } from '../hooks/useAuth';
import { useAppSettings } from '../hooks/useAppSettings';
import { usePermissions } from '../hooks/usePermissions';
import { Icons } from '../utils/iconMapping';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getTitleTextClass } from '../utils/themeHelpers';

const DIAS_SEM_PESAGEM = 90; // Considerar "sem pesagem recente" se última pesagem > 90 dias

export default function PendenciasCurral() {
  const { fazendaAtivaId } = useFazendaContext();
  const { user } = useAuth();
  const { appSettings } = useAppSettings();
  const { hasPermission } = usePermissions();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const podeVerAnimais = hasPermission('ver_planilha');

  const { alertas } = useAlertas(fazendaAtivaId || undefined, user?.id);

  const animaisRaw = useLiveQuery(() => db.animais.toArray(), []) || [];
  const pesagensRaw = useLiveQuery(() => db.pesagens.toArray(), []) || [];
  const statusRaw = useLiveQuery(() => db.statusAnimal.filter(s => !s.deletedAt).toArray(), []) || [];

  const alertaDesmama = alertas.find(a => a.id === 'desmama-atrasada');
  const alertaVacina = alertas.find(a => a.id === 'vacinas-vencidas');

  const semPesagemRecente = useMemo(() => {
    const statusMap = new Map(statusRaw.map(s => [s.id, s.nome?.toLowerCase() || '']));
    let animais = fazendaAtivaId
      ? animaisRaw.filter(a => a.fazendaId === fazendaAtivaId)
      : animaisRaw;
    animais = animais.filter(a => statusMap.get(a.statusId) !== 'morto');

    const hoje = new Date();
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() - DIAS_SEM_PESAGEM);

    return animais.filter(animal => {
      const pesagensAnimal = pesagensRaw
        .filter(p => p.animalId === animal.id)
        .filter(p => p.dataPesagem)
        .map(p => ({
          ...p,
          data: new Date(p.dataPesagem.includes('/') ? p.dataPesagem.split('/').reverse().join('-') : p.dataPesagem)
        }))
        .sort((a, b) => b.data.getTime() - a.data.getTime());

      if (pesagensAnimal.length === 0) return true;
      return pesagensAnimal[0].data < limite;
    });
  }, [animaisRaw, pesagensRaw, statusRaw, fazendaAtivaId]);

  const totalPendencias =
    (alertaDesmama?.quantidade ?? 0) +
    (alertaVacina?.quantidade ?? 0) +
    semPesagemRecente.length;

  const secoes = [
    {
      id: 'desmama',
      titulo: 'Bezerros sem desmama',
      descricao: 'Mais de 8 meses sem registro de desmama',
      itens: (alertaDesmama?.detalhes as { id: string; brinco?: string; nome?: string }[]) ?? [],
      cor: 'red',
      icone: 'AlertTriangle',
      linkBase: '/animais'
    },
    {
      id: 'vacina',
      titulo: 'Vacinas vencidas / atrasadas',
      descricao: 'Reforço vacinal há mais de 6 meses',
      itens: (alertaVacina?.detalhes as { id: string; brinco?: string; nome?: string }[]) ?? [],
      cor: 'purple',
      icone: 'Injection',
      linkBase: '/animais'
    },
    {
      id: 'pesagem',
      titulo: 'Sem pesagem recente',
      descricao: `Nenhuma pesagem nos últimos ${DIAS_SEM_PESAGEM} dias`,
      itens: semPesagemRecente.map(a => ({ id: a.id, brinco: a.brinco, nome: a.nome })),
      cor: 'amber',
      icone: 'Scale',
      linkBase: '/animais'
    }
  ];

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-4xl mx-auto w-full overflow-x-hidden">
      <div className="mb-6">
        <h1 className={getTitleTextClass(primaryColor) + ' text-xl font-bold'}>
          Pendências do Curral
        </h1>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
          O que precisa de atenção no curral. Clique no animal para abrir e registrar desmama, pesagem ou vacina.
        </p>
        {totalPendencias === 0 && (
          <div className="mt-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center gap-3">
            <Icons.CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            <span className="font-medium text-green-800 dark:text-green-200">
              Nenhuma pendência no momento.
            </span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {secoes.map(secao => {
          const Icon = Icons[secao.icone as keyof typeof Icons] ?? Icons.AlertCircle;
          const num = secao.itens.length;
          if (num === 0) return null;

          const corClasses = {
            red: {
              bg: 'bg-red-50 dark:bg-red-900/20',
              border: 'border-red-200 dark:border-red-800',
              icon: 'text-red-600 dark:text-red-400',
              badgeBg: 'bg-red-100 dark:bg-red-900/40',
              badgeText: 'text-red-800 dark:text-red-200',
              badgeBorder: 'border-red-200 dark:border-red-800',
              headerBg: 'bg-red-50 dark:bg-red-900/20'
            },
            purple: {
              bg: 'bg-purple-50 dark:bg-purple-900/20',
              border: 'border-purple-200 dark:border-purple-800',
              icon: 'text-purple-600 dark:text-purple-400',
              badgeBg: 'bg-purple-100 dark:bg-purple-900/40',
              badgeText: 'text-purple-800 dark:text-purple-200',
              badgeBorder: 'border-purple-200 dark:border-purple-800',
              headerBg: 'bg-purple-50 dark:bg-purple-900/20'
            },
            amber: {
              bg: 'bg-amber-50 dark:bg-amber-900/20',
              border: 'border-amber-200 dark:border-amber-800',
              icon: 'text-amber-600 dark:text-amber-400',
              badgeBg: 'bg-amber-100 dark:bg-amber-900/40',
              badgeText: 'text-amber-800 dark:text-amber-200',
              badgeBorder: 'border-amber-200 dark:border-amber-800',
              headerBg: 'bg-amber-50 dark:bg-amber-900/20'
            }
          }[secao.cor as 'red' | 'purple' | 'amber'] || {
            bg: 'bg-gray-50 dark:bg-slate-800/80',
            border: 'border-gray-200 dark:border-slate-700',
            icon: 'text-gray-600 dark:text-slate-400',
            badgeBg: 'bg-gray-200 dark:bg-slate-600',
            badgeText: 'text-gray-800 dark:text-slate-200',
            badgeBorder: 'border-gray-200 dark:border-slate-700',
            headerBg: 'bg-gray-50 dark:bg-slate-800/80'
          };

          return (
            <section
              key={secao.id}
              className={`rounded-xl border-2 ${corClasses.border} ${corClasses.bg} overflow-hidden shadow-sm`}
            >
              <div className={`px-4 py-3 border-b ${corClasses.border} flex items-center gap-3 ${corClasses.headerBg}`}>
                <div className={`p-2 rounded-lg ${corClasses.bg} border ${corClasses.border}`}>
                  <Icon className={`w-5 h-5 ${corClasses.icon}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 dark:text-slate-100">
                    {secao.titulo}
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">{secao.descricao}</p>
                </div>
                <div className={`flex flex-col items-center justify-center rounded-lg border ${corClasses.badgeBorder} ${corClasses.badgeBg} ${corClasses.badgeText} px-3 py-1.5 min-w-[60px]`}>
                  <span className="text-lg font-bold leading-none">{num}</span>
                  <span className="text-xs font-medium leading-tight mt-0.5">{num === 1 ? 'animal' : 'animais'}</span>
                </div>
              </div>
              <ul className={`divide-y ${corClasses.border} bg-white dark:bg-slate-800`}>
                {secao.itens.slice(0, 50).map((item: { id: string; brinco?: string; nome?: string }) => (
                  <li key={item.id}>
                    {podeVerAnimais ? (
                      <Link
                        to={`/animais?animalId=${item.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors bg-white dark:bg-slate-800"
                      >
                        <span className="font-mono font-medium text-gray-900 dark:text-slate-100">
                          {item.brinco ?? '—'}
                        </span>
                        {item.nome && (
                          <span className="text-gray-600 dark:text-slate-400 truncate">{item.nome}</span>
                        )}
                        <Icons.ChevronRight className="w-4 h-4 ml-auto text-gray-400" />
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800">
                        <span className="font-mono font-medium text-gray-900 dark:text-slate-100">{item.brinco ?? '—'}</span>
                        {item.nome && <span className="text-gray-600 dark:text-slate-400 truncate">{item.nome}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {secao.itens.length > 50 && (
                <div className={`px-4 py-2 ${corClasses.headerBg} text-sm text-gray-600 dark:text-slate-400 border-t ${corClasses.border}`}>
                  Mostrando 50 de {secao.itens.length}. Filtre em Animais para ver todos.
                </div>
              )}
            </section>
          );
        })}
      </div>

      {podeVerAnimais && totalPendencias > 0 && (
        <div className="mt-6">
          <Link
            to="/animais"
            title="Ver todos os animais"
            className={`${getPrimaryButtonClass(primaryColor)} w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-white shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]`}
          >
            <Icons.Cow className="w-5 h-5" />
            <span className="hidden sm:inline">Ver todos os animais</span>
            <Icons.ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
