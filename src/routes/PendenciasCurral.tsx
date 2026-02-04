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
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
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

          return (
            <section
              key={secao.id}
              className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-3 bg-gray-50 dark:bg-slate-800/80">
                <Icon className="w-5 h-5 text-gray-600 dark:text-slate-400" />
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-slate-100">
                    {secao.titulo}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{secao.descricao}</p>
                </div>
                <span className="ml-auto rounded-full bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-slate-200 text-sm font-medium px-2.5 py-0.5">
                  {num} {num === 1 ? 'animal' : 'animais'}
                </span>
              </div>
              <ul className="divide-y divide-gray-200 dark:divide-slate-700">
                {secao.itens.slice(0, 50).map((item: { id: string; brinco?: string; nome?: string }) => (
                  <li key={item.id}>
                    {podeVerAnimais ? (
                      <Link
                        to={`/animais?animalId=${item.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
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
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className="font-mono font-medium">{item.brinco ?? '—'}</span>
                        {item.nome && <span className="text-gray-600 dark:text-slate-400 truncate">{item.nome}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {secao.itens.length > 50 && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800/80 text-sm text-gray-500 dark:text-slate-400">
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
            className={getPrimaryButtonClass(primaryColor) + ' inline-flex items-center gap-2 px-4 py-2 rounded-lg'}
          >
            <Icons.Cow className="w-4 h-4" />
            Ver todos os animais
          </Link>
        </div>
      )}
    </div>
  );
}
