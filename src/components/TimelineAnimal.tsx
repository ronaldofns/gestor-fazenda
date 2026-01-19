import React, { useMemo, memo } from 'react';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses, getPrimaryBadgeClass, getPrimaryActionButtonLightClass } from '../utils/themeHelpers';
import { Nascimento, Desmama, Pesagem, Vacina } from '../db/models';

interface TimelineAnimalProps {
  nascimento: Nascimento;
  desmama?: Desmama;
  pesagens: Pesagem[];
  vacinacoes: Vacina[];
  onEditNascimento?: (nascimentoId: string) => void;
  onAddPesagem?: (nascimentoId: string) => void;
  onEditPesagem?: (pesagem: Pesagem) => void;
  onAddVacina?: (nascimentoId: string) => void;
  onEditVacina?: (vacina: Vacina) => void;
}

interface TimelineEvent {
  id: string;
  tipo: 'nascimento' | 'desmama' | 'pesagem' | 'vacina';
  data: string;
  titulo: string;
  descricao?: string;
  observacao?: string;
  meta?: Array<{ label: string; value: string }>;
  dados?: any;
}

// Memoizar o componente para evitar re-renders desnecessários
const TimelineAnimal = memo(function TimelineAnimal({
  nascimento,
  desmama,
  pesagens,
  vacinacoes,
  onEditNascimento,
  onAddPesagem,
  onEditPesagem,
  onAddVacina,
  onEditVacina
}: TimelineAnimalProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;

  // Função para converter data para Date
  const parseDate = (dataStr: string): Date | null => {
    if (!dataStr) return null;
    // Se está em formato DD/MM/YYYY
    if (dataStr.includes('/')) {
      const partes = dataStr.split('/');
      if (partes.length === 3) {
        return new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
      }
    }
    // Se está em formato YYYY-MM-DD
    if (dataStr.includes('-')) {
      return new Date(dataStr);
    }
    return null;
  };

  // Função para formatar data
  const formatarData = (data: string): string => {
    if (!data) return '';
    if (data.includes('/')) return data;
    if (data.includes('-')) {
      const partes = data.split('-');
      if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
    }
    return data;
  };

  // Criar eventos da timeline
  const eventos = useMemo<TimelineEvent[]>(() => {
    const lista: TimelineEvent[] = [];

    // Evento: Nascimento
    if (nascimento.dataNascimento) {
      lista.push({
        id: `nascimento-${nascimento.id}`,
        tipo: 'nascimento',
        data: nascimento.dataNascimento,
        titulo: 'Nascimento',
        descricao: 'Animal nascido',
        observacao: nascimento.obs || undefined,
        meta: [
          nascimento.brincoNumero ? { label: 'Brinco', value: nascimento.brincoNumero } : null,
          nascimento.sexo ? { label: 'Sexo', value: nascimento.sexo } : null,
          nascimento.raca ? { label: 'Raça', value: nascimento.raca } : null
        ].filter(Boolean) as Array<{ label: string; value: string }>,
        dados: nascimento
      });
    }

    // Evento: Desmama
    if (desmama?.dataDesmama) {
      lista.push({
        id: `desmama-${desmama.id}`,
        tipo: 'desmama',
        data: desmama.dataDesmama,
        titulo: 'Desmama',
        descricao: 'Desmama registrada',
        meta: desmama.pesoDesmama ? [{ label: 'Peso', value: `${desmama.pesoDesmama} kg` }] : [],
        dados: desmama
      });
    }

    // Eventos: Pesagens
    if (Array.isArray(pesagens)) {
      pesagens.forEach(pesagem => {
        if (pesagem && pesagem.id && pesagem.dataPesagem && typeof pesagem.peso === 'number') {
          lista.push({
            id: `pesagem-${pesagem.id}`,
            tipo: 'pesagem',
            data: pesagem.dataPesagem,
            titulo: 'Pesagem',
            descricao: `Peso: ${pesagem.peso.toFixed(2)} kg`,
            observacao: pesagem.observacao || undefined,
            meta: [],
            dados: pesagem
          });
        }
      });
    }

    // Eventos: Vacinações
    if (Array.isArray(vacinacoes)) {
      vacinacoes.forEach(vacina => {
        if (!vacina || !vacina.id || !vacina.dataAplicacao) return;
        
        const vencida = vacina.dataVencimento && parseDate(vacina.dataVencimento) 
          ? parseDate(vacina.dataVencimento)! < new Date() 
          : false;
        const proximaVencimento = vacina.dataVencimento && parseDate(vacina.dataVencimento)
          ? (() => {
              const hoje = new Date();
              hoje.setHours(0, 0, 0, 0);
              const vencimento = parseDate(vacina.dataVencimento)!;
              vencimento.setHours(0, 0, 0, 0);
              const diffTime = vencimento.getTime() - hoje.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays >= 0 && diffDays <= 30;
            })()
          : false;

        let descricao = vacina.vacina || 'Vacinação';
        const meta: Array<{ label: string; value: string }> = [];
        if (vacina.dataVencimento) {
          meta.push({ label: 'Vencimento', value: formatarData(vacina.dataVencimento) });
        }
        if (vacina.lote) meta.push({ label: 'Lote', value: vacina.lote });
        if (vacina.responsavel) meta.push({ label: 'Responsável', value: vacina.responsavel });

        lista.push({
          id: `vacina-${vacina.id}`,
          tipo: 'vacina',
          data: vacina.dataAplicacao,
          titulo: 'Vacinação',
          descricao,
          observacao: vacina.observacao || undefined,
          meta,
          dados: { ...vacina, vencida, proximaVencimento }
        });
      });
    }

    // Ordenar por data (mais antigo primeiro)
    return lista.sort((a, b) => {
      const dataA = parseDate(a.data) || new Date(0);
      const dataB = parseDate(b.data) || new Date(0);
      return dataA.getTime() - dataB.getTime();
    });
  }, [nascimento, desmama, pesagens, vacinacoes]);

  const getIcon = (tipo: TimelineEvent['tipo']) => {
    switch (tipo) {
      case 'nascimento':
        return Icons.Baby;
      case 'desmama':
        return Icons.Scale;
      case 'pesagem':
        return Icons.Scale;
      case 'vacina':
        return Icons.Injection;
      default:
        return Icons.Calendar;
    }
  };

  const getColor = (tipo: TimelineEvent['tipo']) => {
    switch (tipo) {
      case 'nascimento':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
      case 'desmama':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800';
      case 'pesagem':
        return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800';
      case 'vacina':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800';
    }
  };

  if (eventos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Icons.Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum evento registrado para este animal.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Linha vertical da timeline */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-gray-300 via-gray-300 to-transparent dark:from-gray-600 dark:via-gray-600"></div>

      <div className="space-y-5">
        {eventos.map((evento, index) => {
          const Icon = getIcon(evento.tipo);
          const colorClasses = getColor(evento.tipo);
          const isLast = index === eventos.length - 1;

          return (
            <div key={evento.id} className="relative flex items-start gap-5">
              {/* Círculo da timeline */}
              <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 shadow-md ${colorClasses} bg-white dark:bg-slate-900 transition-transform hover:scale-110`}>
                <Icon className="w-5 h-5" />
              </div>

              {/* Conteúdo do evento */}
              <div className={`flex-1 pb-5 min-w-0 ${!isLast ? 'border-b border-gray-200 dark:border-gray-700' : ''}`}>
                <div className={`p-4 rounded-xl border-2 shadow-sm hover:shadow-md transition-all ${colorClasses}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="font-bold text-base text-gray-900 dark:text-gray-100">
                          {evento.titulo}
                        </h4>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {formatarData(evento.data)}
                        </span>
                        {evento.tipo === 'vacina' && evento.dados?.vencida && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-red-600 text-white font-semibold">
                            Vencida
                          </span>
                        )}
                        {evento.tipo === 'vacina' && evento.dados?.proximaVencimento && !evento.dados?.vencida && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500 text-white font-semibold">
                            Vence em breve
                          </span>
                        )}
                      </div>
                      {evento.descricao && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {evento.descricao}
                        </p>
                      )}
                      {evento.meta && evento.meta.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {evento.meta.map((item, idx) => (
                            <span
                              key={`${evento.id}-meta-${idx}`}
                              className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-white/70 dark:bg-slate-800/70 px-2.5 py-1 rounded-lg border border-gray-200/70 dark:border-slate-700/70"
                            >
                              {item.label}: {item.value}
                            </span>
                          ))}
                        </div>
                      )}
                      {evento.observacao && (
                        <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 bg-white/70 dark:bg-slate-800/70 rounded-lg px-3 py-2 border border-gray-200/70 dark:border-slate-700/70">
                          <span className="font-semibold text-gray-700 dark:text-gray-200">Observação:</span>{' '}
                          {evento.observacao}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {evento.tipo === 'nascimento' && onEditNascimento && (
                        <button
                          onClick={() => onEditNascimento(nascimento.id)}
                          className={`p-2 ${getPrimaryActionButtonLightClass(primaryColor)} rounded-lg transition-all hover:scale-110`}
                          title="Editar nascimento"
                        >
                          <Icons.Edit className="w-4 h-4" />
                        </button>
                      )}
                      {evento.tipo === 'pesagem' && onEditPesagem && (
                        <button
                          onClick={() => onEditPesagem(evento.dados as Pesagem)}
                          className={`p-2 ${getPrimaryActionButtonLightClass(primaryColor)} rounded-lg transition-all hover:scale-110`}
                          title="Editar pesagem"
                        >
                          <Icons.Edit className="w-4 h-4" />
                        </button>
                      )}
                      {evento.tipo === 'vacina' && onEditVacina && (
                        <button
                          onClick={() => onEditVacina(evento.dados as Vacina)}
                          className={`p-2 ${getPrimaryActionButtonLightClass(primaryColor)} rounded-lg transition-all hover:scale-110`}
                          title="Editar vacinação"
                        >
                          <Icons.Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botões de ação rápida */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-3 flex-wrap">
        {onAddPesagem && (
          <button
            onClick={() => onAddPesagem(nascimento.id)}
            className={`flex items-center gap-2 px-5 py-2.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded-lg transition-all hover:scale-105 font-medium shadow-sm`}
            title="Adicionar pesagem"
          >
            <Icons.Plus className="w-4 h-4" />
            <span className="text-sm">Adicionar Pesagem</span>
          </button>
        )}
        {onAddVacina && (
          <button
            onClick={() => onAddVacina(nascimento.id)}
            className={`flex items-center gap-2 px-5 py-2.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded-lg transition-all hover:scale-105 font-medium shadow-sm`}
            title="Adicionar vacinação"
          >
            <Icons.Plus className="w-4 h-4" />
            <span className="text-sm">Adicionar Vacinação</span>
          </button>
        )}
      </div>
    </div>
  );
});

export default TimelineAnimal;
