import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { Confinamento, ConfinamentoAnimal, ConfinamentoAlimentacao, Animal, Fazenda, ConfinamentoPesagem } from '../db/models';
import { Icons } from '../utils/iconMapping';
import { showToast } from '../utils/toast';
import ConfinamentoModal from '../components/ConfinamentoModal';
import ConfinamentoAnimalModal from '../components/ConfinamentoAnimalModal';
import ConfinamentoAlimentacaoModal from '../components/ConfinamentoAlimentacaoModal';
import ConfinamentoPesagemModal from '../components/ConfinamentoPesagemModal';
import ConfirmDialog from '../components/ConfirmDialog';
import Input from '../components/Input';
import { useAppSettings } from '../hooks/useAppSettings';
import { usePermissions } from '../hooks/usePermissions';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getTitleTextClass, getThemeClasses } from '../utils/themeHelpers';
import { formatDateBR } from '../utils/date';
import { converterDataParaFormatoBanco } from '../utils/dateInput';
import { calcularGMD, calcularGMDParcial } from '../utils/confinamentoRules';
import { createSyncEvent } from '../utils/syncEvents';
import { registrarAudit } from '../utils/audit';
import { useAuth } from '../hooks/useAuth';

type TabType = 'animais' | 'pesagens' | 'alimentacao' | 'indicadores' | 'historico';

export default function DetalheConfinamento() {
  const { confinamentoId } = useParams<{ confinamentoId: string }>();
  const navigate = useNavigate();
  const { appSettings } = useAppSettings();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const podeGerenciarConfinamentos = hasPermission('gerenciar_fazendas');

  const [activeTab, setActiveTab] = useState<TabType>('animais');
  const [modalConfinamentoOpen, setModalConfinamentoOpen] = useState(false);
  const [modalAnimalOpen, setModalAnimalOpen] = useState(false);
  const [vínculoEditando, setVínculoEditando] = useState<ConfinamentoAnimal | null>(null);
  const [vínculoAEncerrar, setVínculoAEncerrar] = useState<ConfinamentoAnimal | null>(null);
  const [modalAlimentacaoOpen, setModalAlimentacaoOpen] = useState(false);
  const [alimentacaoEditando, setAlimentacaoEditando] = useState<ConfinamentoAlimentacao | null>(null);
  const [alimentacaoAExcluir, setAlimentacaoAExcluir] = useState<ConfinamentoAlimentacao | null>(null);
  const [modalPesagemOpen, setModalPesagemOpen] = useState(false);
  const [buscaAnimaisPesagens, setBuscaAnimaisPesagens] = useState('');

  // Buscar confinamento
  const confinamento = useLiveQuery(() => 
    confinamentoId ? db.confinamentos.get(confinamentoId) : undefined,
    [confinamentoId]
  );

  // Buscar fazenda
  const fazenda = useLiveQuery(() => 
    confinamento?.fazendaId ? db.fazendas.get(confinamento.fazendaId) : undefined,
    [confinamento?.fazendaId]
  );

  // Buscar vínculos animal-confinamento
  const vínculosRaw = useLiveQuery(() => 
    confinamentoId ? db.confinamentoAnimais
      .where('confinamentoId')
      .equals(confinamentoId)
      .and(v => v.deletedAt == null)
      .toArray() : [],
    [confinamentoId]
  ) || [];

  // Buscar animais
  const animaisMap = useLiveQuery(async () => {
    const map = new Map<string, Animal>();
    if (vínculosRaw.length > 0) {
      const animaisIds = vínculosRaw.map(v => v.animalId);
      const animais = await db.animais.bulkGet(animaisIds.filter(Boolean) as string[]);
      animais.forEach(a => {
        if (a) map.set(a.id, a);
      });
    }
    return map;
  }, [vínculosRaw]) || new Map();

  // Buscar pesagens do confinamento
  const pesagensRaw = useLiveQuery(async () => {
    if (!confinamentoId || vínculosRaw.length === 0) return [];
    const vínculoIds = vínculosRaw.map(v => v.id);
    const pesagens = await db.confinamentoPesagens
      .where('confinamentoAnimalId')
      .anyOf(vínculoIds)
      .and(p => p.deletedAt == null)
      .toArray();
    return pesagens.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [confinamentoId, vínculosRaw]) || [];

  // Buscar registros de alimentação do confinamento
  const alimentacaoRaw = useLiveQuery(
    () =>
      confinamentoId
        ? db.confinamentoAlimentacao
            .where('confinamentoId')
            .equals(confinamentoId)
            .and((a: any) => a.deletedAt == null)
            .toArray()
        : Promise.resolve([]),
    [confinamentoId]
  ) || [];
  const alimentacaoOrdenada = useMemo(
    () => [...alimentacaoRaw].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
    [alimentacaoRaw]
  );

  // Buscar histórico (auditoria) do confinamento e dos vínculos
  const historicoRaw = useLiveQuery(async () => {
    if (!confinamentoId) return [];
    const vinculoIds = vínculosRaw.map(v => v.id);
    const auditsConfinamento = await db.audits
      .where('[entity+entityId]')
      .equals(['confinamento', confinamentoId])
      .toArray();
    const auditsAnimais =
      vinculoIds.length > 0
        ? await db.audits
            .where('entity')
            .equals('confinamentoAnimal')
            .and(a => vinculoIds.includes(a.entityId))
            .toArray()
        : [];
    const todos = [...auditsConfinamento, ...auditsAnimais];
    return todos.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [confinamentoId, vínculosRaw]) || [];

  const { vínculosAtivos, vínculosEncerrados } = useMemo(() => {
    const ativos = vínculosRaw.filter(v => v.dataSaida == null);
    const encerrados = vínculosRaw.filter(v => v.dataSaida != null);
    return { vínculosAtivos: ativos, vínculosEncerrados: encerrados };
  }, [vínculosRaw]);

  const vínculosAtivosFiltradosPesagens = useMemo(() => {
    const term = buscaAnimaisPesagens.trim().toLowerCase();
    if (!term) return vínculosAtivos;
    return vínculosAtivos.filter(v => {
      const animal = animaisMap.get(v.animalId);
      const brinco = animal?.brinco != null ? String(animal.brinco).toLowerCase() : '';
      const nome = (animal?.nome ?? '').toLowerCase();
      return brinco.includes(term) || nome.includes(term);
    });
  }, [vínculosAtivos, animaisMap, buscaAnimaisPesagens]);

  // Calcular indicadores do confinamento
  const indicadores = useMemo(() => {
    if (vínculosRaw.length === 0) {
      return {
        totalAnimais: 0,
        animaisAtivos: 0,
        pesoMedioEntrada: 0,
        pesoMedioSaida: 0,
        gmdMedio: 0,
        diasMedio: 0
      };
    }

    const entradas = vínculosRaw.map(v => v.pesoEntrada);
    const saidas = vínculosRaw.filter(v => v.pesoSaida).map(v => v.pesoSaida!);

    const pesoMedioEntrada = entradas.length > 0
      ? entradas.reduce((a, b) => a + b, 0) / entradas.length
      : 0;

    const pesoMedioSaida = saidas.length > 0
      ? saidas.reduce((a, b) => a + b, 0) / saidas.length
      : 0;

    // Última pesagem por vínculo (confinamento) para GMD parcial dos ativos
    const ultimaPesagemPorVinculo = new Map<string, { peso: number; data: string }>();
    for (const p of pesagensRaw) {
      const atual = ultimaPesagemPorVinculo.get(p.confinamentoAnimalId);
      if (!atual || new Date(p.data) > new Date(atual.data)) {
        ultimaPesagemPorVinculo.set(p.confinamentoAnimalId, { peso: p.peso, data: p.data });
      }
    }

    const gmdCalculados: Array<{ gmd: number; dias: number }> = [];
    for (const v of vínculosRaw) {
      if (v.pesoSaida && v.dataSaida) {
        const r = calcularGMD(v.pesoEntrada, v.pesoSaida, v.dataEntrada, v.dataSaida);
        if (r.gmd != null) gmdCalculados.push(r);
      } else {
        const pesagemConfinamento = ultimaPesagemPorVinculo.get(v.id);
        const animal = animaisMap.get(v.animalId);
        const pesoParaGMD = pesagemConfinamento?.peso ?? animal?.pesoAtual;
        if (pesoParaGMD != null) {
          const dataFim = pesagemConfinamento?.data;
          const r = dataFim
            ? calcularGMD(v.pesoEntrada, pesoParaGMD, v.dataEntrada, dataFim)
            : calcularGMDParcial(v.pesoEntrada, pesoParaGMD, v.dataEntrada);
          if (r.gmd != null) gmdCalculados.push(r);
        }
      }
    }

    const gmdMedio = gmdCalculados.length > 0
      ? gmdCalculados.reduce((a, b) => a + b.gmd, 0) / gmdCalculados.length
      : 0;

    // Tempo médio = duração média no confinamento (apenas animais já encerrados)
    const diasNoConfinamento = vínculosEncerrados
      .filter(v => v.dataSaida)
      .map(v => Math.max(1, Math.floor((new Date(v.dataSaida!).getTime() - new Date(v.dataEntrada).getTime()) / (1000 * 60 * 60 * 24))));
    const diasMedio = diasNoConfinamento.length > 0
      ? diasNoConfinamento.reduce((a, b) => a + b, 0) / diasNoConfinamento.length
      : 0;

    return {
      totalAnimais: vínculosRaw.length,
      animaisAtivos: vínculosAtivos.length,
      pesoMedioEntrada,
      pesoMedioSaida,
      gmdMedio,
      diasMedio
    };
  }, [vínculosRaw, vínculosAtivos, vínculosEncerrados, animaisMap, pesagensRaw]);

  if (!confinamentoId || !confinamento) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500 dark:text-slate-400">Confinamento não encontrado</p>
        <button
          onClick={() => navigate('/confinamentos')}
          className="mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400"
        >
          Voltar para lista
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'animais' as TabType, label: 'Animais', icon: Icons.Cow },
    { id: 'pesagens' as TabType, label: 'Pesagens', icon: Icons.Scale },
    { id: 'alimentacao' as TabType, label: 'Alimentação', icon: Icons.Settings }, // Usar Settings temporariamente
    { id: 'indicadores' as TabType, label: 'Indicadores', icon: Icons.BarChart },
    { id: 'historico' as TabType, label: 'Histórico', icon: Icons.History }
  ];

  const handleAdicionarAnimal = () => {
    setVínculoEditando(null);
    setModalAnimalOpen(true);
  };

  const handleEditarVínculo = (vínculo: ConfinamentoAnimal) => {
    setVínculoEditando(vínculo);
    setModalAnimalOpen(true);
  };

  const handleEncerrarVínculo = (vínculo: ConfinamentoAnimal) => {
    setVínculoAEncerrar(vínculo);
  };

  const handleAdicionarAlimentacao = () => {
    setAlimentacaoEditando(null);
    setModalAlimentacaoOpen(true);
  };

  const handleEditarAlimentacao = (item: ConfinamentoAlimentacao) => {
    setAlimentacaoEditando(item);
    setModalAlimentacaoOpen(true);
  };

  const handleExcluirAlimentacao = (item: ConfinamentoAlimentacao) => {
    setAlimentacaoAExcluir(item);
  };

  const confirmarExcluirAlimentacao = async () => {
    const item = alimentacaoAExcluir;
    setAlimentacaoAExcluir(null);
    if (!item) return;
    try {
      const now = new Date().toISOString();
      await db.confinamentoAlimentacao.update(item.id, { deletedAt: now, updatedAt: now, synced: false });
      const atual = await db.confinamentoAlimentacao.get(item.id);
      if (atual) await createSyncEvent('UPDATE', 'confinamentoAlimentacao', item.id, atual);
      showToast({ type: 'success', message: 'Registro de alimentação removido.' });
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Erro ao excluir' });
    }
  };

  const confirmarEncerrarVínculo = async () => {
    const vínculo = vínculoAEncerrar;
    setVínculoAEncerrar(null);
    if (!vínculo) return;

    const hoje = new Date().toISOString().split('T')[0];
    const animal = animaisMap.get(vínculo.animalId);
    const ultimoPeso = animal?.pesoAtual || vínculo.pesoEntrada;

    try {
      await db.confinamentoAnimais.update(vínculo.id, {
        dataSaida: hoje,
        pesoSaida: ultimoPeso,
        updatedAt: new Date().toISOString(),
        synced: false
      });

      const vínculoAtualizado = await db.confinamentoAnimais.get(vínculo.id);
      if (vínculoAtualizado) {
        await createSyncEvent('UPDATE', 'confinamentoAnimal', vínculo.id, vínculoAtualizado);
      }

      showToast({ type: 'success', message: 'Animal encerrado do confinamento' });
    } catch (error: any) {
      console.error('Erro ao encerrar vínculo:', error);
      showToast({ type: 'error', message: error.message || 'Erro ao encerrar vínculo' });
    }
  };

  return (
    <div className="p-2 sm:p-3 md:p-4 text-gray-900 dark:text-slate-100 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="mb-4 flex justify-between items-start">
        <div>
          <button
            onClick={() => navigate('/confinamentos')}
            className="mb-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
          >
            <Icons.ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <h1 className={getTitleTextClass(primaryColor)}>{confinamento.nome}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {fazenda?.nome} • Início: {formatDateBR(confinamento.dataInicio)}
            {confinamento.dataFimReal && ` • Fim: ${formatDateBR(confinamento.dataFimReal)}`}
          </p>
        </div>
        {podeGerenciarConfinamentos && (
          <button
            onClick={() => setModalConfinamentoOpen(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <Icons.Edit className="w-4 h-4 inline mr-2" />
            Editar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg overflow-hidden mb-4">
        <div className="flex flex-wrap border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? `${getThemeClasses(primaryColor, 'border')} ${getThemeClasses(primaryColor, 'text')}`
                  : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {/* Aba Animais */}
          {activeTab === 'animais' && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Animais no Confinamento</h2>
                {podeGerenciarConfinamentos && confinamento.status === 'ativo' && (
                  <button
                    onClick={handleAdicionarAnimal}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${getPrimaryButtonClass(primaryColor)} hover:opacity-90`}
                  >
                    <Icons.Plus className="w-4 h-4" />
                    Adicionar Animal
                  </button>
                )}
              </div>

              {vínculosRaw.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                  Nenhum animal adicionado ao confinamento ainda.
                </p>
              ) : (
                <div className="space-y-4">
                  {vínculosAtivos.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Animais Ativos ({vínculosAtivos.length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-gray-50 dark:bg-slate-800">
                            <tr>
                              <th className="px-4 py-2 text-left">Brinco</th>
                              <th className="px-4 py-2 text-left">Nome</th>
                              <th className="px-4 py-2 text-left">Entrada</th>
                              <th className="px-4 py-2 text-left">Peso Entrada</th>
                              <th className="px-4 py-2 text-left">Peso Atual</th>
                              <th className="px-4 py-2 text-left">GMD Parcial</th>
                              <th className="px-4 py-2 text-left">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                            {vínculosAtivos.map(vínculo => {
                              const animal = animaisMap.get(vínculo.animalId);
                              const gmdParcial = animal?.pesoAtual
                                ? calcularGMDParcial(vínculo.pesoEntrada, animal.pesoAtual, vínculo.dataEntrada)
                                : null;
                              return (
                                <tr key={vínculo.id}>
                                  <td className="px-4 py-2">{animal?.brinco || 'N/A'}</td>
                                  <td className="px-4 py-2">{animal?.nome || '-'}</td>
                                  <td className="px-4 py-2">{formatDateBR(vínculo.dataEntrada)}</td>
                                  <td className="px-4 py-2">{vínculo.pesoEntrada.toFixed(2)} kg</td>
                                  <td className="px-4 py-2">
                                    {animal?.pesoAtual ? `${animal.pesoAtual.toFixed(2)} kg` : '-'}
                                  </td>
                                  <td className="px-4 py-2">
                                    {gmdParcial?.gmd != null ? `${gmdParcial.gmd.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg/dia` : '-'}
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex gap-2">
                                      {podeGerenciarConfinamentos && (
                                        <>
                                          <button
                                            onClick={() => handleEncerrarVínculo(vínculo)}
                                            className="text-orange-600 hover:text-orange-800 dark:text-orange-400"
                                            title="Encerrar"
                                          >
                                            <Icons.XCircle className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleEditarVínculo(vínculo)}
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                            title="Editar"
                                          >
                                            <Icons.Edit className="w-4 h-4" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {vínculosEncerrados.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Animais Encerrados ({vínculosEncerrados.length})
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                          <thead className="bg-gray-50 dark:bg-slate-800">
                            <tr>
                              <th className="px-4 py-2 text-left">Brinco</th>
                              <th className="px-4 py-2 text-left">Nome</th>
                              <th className="px-4 py-2 text-left">Entrada</th>
                              <th className="px-4 py-2 text-left">Saída</th>
                              <th className="px-4 py-2 text-left">Peso Entrada</th>
                              <th className="px-4 py-2 text-left">Peso Saída</th>
                              <th className="px-4 py-2 text-left">GMD</th>
                              <th className="px-4 py-2 text-left">Motivo</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                            {vínculosEncerrados.map(vínculo => {
                              const animal = animaisMap.get(vínculo.animalId);
                              const gmd = vínculo.pesoSaida && vínculo.dataSaida
                                ? calcularGMD(vínculo.pesoEntrada, vínculo.pesoSaida, vínculo.dataEntrada, vínculo.dataSaida)
                                : null;
                              return (
                                <tr key={vínculo.id}>
                                  <td className="px-4 py-2">{animal?.brinco || 'N/A'}</td>
                                  <td className="px-4 py-2">{animal?.nome || '-'}</td>
                                  <td className="px-4 py-2">{formatDateBR(vínculo.dataEntrada)}</td>
                                  <td className="px-4 py-2">{vínculo.dataSaida ? formatDateBR(vínculo.dataSaida) : '-'}</td>
                                  <td className="px-4 py-2">{vínculo.pesoEntrada.toFixed(2)} kg</td>
                                  <td className="px-4 py-2">
                                    {vínculo.pesoSaida ? `${vínculo.pesoSaida.toFixed(2)} kg` : '-'}
                                  </td>
                                  <td className="px-4 py-2">
                                    {gmd?.gmd != null ? `${gmd.gmd.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg/dia (${gmd.dias} dias)` : '-'}
                                  </td>
                                  <td className="px-4 py-2">
                                    {vínculo.motivoSaida ? (
                                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-slate-800">
                                        {vínculo.motivoSaida}
                                      </span>
                                    ) : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Aba Pesagens */}
          {activeTab === 'pesagens' && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Pesagens do Confinamento</h2>
                {podeGerenciarConfinamentos && confinamento?.status === 'ativo' && vínculosAtivos.length > 0 && (
                  <button
                    onClick={() => setModalPesagemOpen(true)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm ${getPrimaryButtonClass(primaryColor)} hover:opacity-90`}
                  >
                    <Icons.Plus className="w-4 h-4" />
                    Registrar pesagem
                  </button>
                )}
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Animais no confinamento</h3>
                <input
                  type="text"
                  placeholder="Buscar por brinco ou nome (apenas animais deste confinamento)"
                  value={buscaAnimaisPesagens}
                  onChange={e => setBuscaAnimaisPesagens(e.target.value)}
                  className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 placeholder:text-gray-500"
                />
                {vínculosAtivos.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">Nenhum animal ativo no confinamento. Adicione animais na aba Animais.</p>
                ) : (
                  <div className="mt-2 overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
                      <thead className="bg-gray-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-3 py-2 text-left">Brinco</th>
                          <th className="px-3 py-2 text-left">Nome</th>
                          <th className="px-3 py-2 text-left">Entrada</th>
                          <th className="px-3 py-2 text-left">Peso entrada</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                        {vínculosAtivosFiltradosPesagens.map(vínculo => {
                          const animal = animaisMap.get(vínculo.animalId);
                          return (
                            <tr key={vínculo.id}>
                              <td className="px-3 py-2 font-medium">{animal?.brinco ?? 'N/A'}</td>
                              <td className="px-3 py-2">{animal?.nome ?? '-'}</td>
                              <td className="px-3 py-2">{formatDateBR(vínculo.dataEntrada)}</td>
                              <td className="px-3 py-2">{vínculo.pesoEntrada.toFixed(2)} kg</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {vínculosAtivosFiltradosPesagens.length === 0 && buscaAnimaisPesagens.trim() && (
                      <p className="px-3 py-4 text-sm text-gray-500 dark:text-slate-400 text-center">
                        Nenhum animal encontrado com &quot;{buscaAnimaisPesagens.trim()}&quot;
                      </p>
                    )}
                  </div>
                )}
              </div>

              <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Histórico de pesagens</h3>
              {pesagensRaw.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-6 border border-gray-200 dark:border-slate-700 rounded-lg">
                  Nenhuma pesagem registrada ainda. Use &quot;Registrar pesagem&quot; para adicionar.
                </p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-2 text-left">Data</th>
                        <th className="px-4 py-2 text-left">Animal</th>
                        <th className="px-4 py-2 text-left">Peso (kg)</th>
                        <th className="px-4 py-2 text-left">Observações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                      {pesagensRaw.map(pesagem => {
                        const vínculo = vínculosRaw.find(v => v.id === pesagem.confinamentoAnimalId);
                        const animal = vínculo ? animaisMap.get(vínculo.animalId) : null;
                        return (
                          <tr key={pesagem.id}>
                            <td className="px-4 py-2">{formatDateBR(pesagem.data)}</td>
                            <td className="px-4 py-2">{animal?.brinco || 'N/A'}</td>
                            <td className="px-4 py-2">{pesagem.peso.toFixed(2)}</td>
                            <td className="px-4 py-2">{pesagem.observacoes || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Aba Alimentação */}
          {activeTab === 'alimentacao' && (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold">Alimentação</h2>
                {podeGerenciarConfinamentos && confinamento?.status === 'ativo' && (
                  <button
                    onClick={handleAdicionarAlimentacao}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg shadow-sm ${getPrimaryButtonClass(primaryColor)} hover:opacity-90`}
                  >
                    <Icons.Plus className="w-4 h-4" />
                    Adicionar registro
                  </button>
                )}
              </div>
              {alimentacaoOrdenada.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                  Nenhum registro de alimentação ainda. Adicione para controlar dieta e custos.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-2 text-left">Data</th>
                        <th className="px-4 py-2 text-left">Tipo de dieta</th>
                        <th className="px-4 py-2 text-left">Custo total</th>
                        <th className="px-4 py-2 text-left">Observações</th>
                        {podeGerenciarConfinamentos && <th className="px-4 py-2 text-left">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                      {alimentacaoOrdenada.map(reg => (
                        <tr key={reg.id}>
                          <td className="px-4 py-2">{formatDateBR(reg.data)}</td>
                          <td className="px-4 py-2">{reg.tipoDieta || '-'}</td>
                          <td className="px-4 py-2">
                            {reg.custoTotal != null ? `R$ ${reg.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                          <td className="px-4 py-2 max-w-xs truncate" title={reg.observacoes || ''}>
                            {reg.observacoes || '-'}
                          </td>
                          {podeGerenciarConfinamentos && (
                            <td className="px-4 py-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditarAlimentacao(reg)}
                                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                                  title="Editar"
                                >
                                  <Icons.Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleExcluirAlimentacao(reg)}
                                  className="text-red-600 hover:text-red-800 dark:text-red-400"
                                  title="Excluir"
                                >
                                  <Icons.Trash className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Aba Indicadores */}
          {activeTab === 'indicadores' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Indicadores do Confinamento</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-slate-400">Total de Animais</p>
                  <p className="text-2xl font-bold">{indicadores.totalAnimais}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-slate-400">Animais Ativos</p>
                  <p className="text-2xl font-bold">{indicadores.animaisAtivos}</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-slate-400">Peso Médio Entrada</p>
                  <p className="text-2xl font-bold">{indicadores.pesoMedioEntrada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-slate-400">Peso Médio Saída</p>
                  <p className="text-2xl font-bold">
                    {indicadores.pesoMedioSaida > 0 ? `${indicadores.pesoMedioSaida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg` : '-'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-slate-400">GMD Médio</p>
                  <p className="text-2xl font-bold">
                    {indicadores.gmdMedio > 0 ? `${indicadores.gmdMedio.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg/dia` : '-'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Ganho médio diário em kg</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-slate-400">Duração média (encerrados)</p>
                  <p className="text-2xl font-bold">
                    {indicadores.diasMedio > 0 ? `${Math.round(indicadores.diasMedio)} dias` : '-'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">Tempo médio no confinamento de quem já saiu</p>
                </div>
              </div>
            </div>
          )}

          {/* Aba Histórico */}
          {activeTab === 'historico' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Histórico de alterações</h2>
              {historicoRaw.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                  Nenhum registro de alteração ainda para este confinamento.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-2 text-left">Data/Hora</th>
                        <th className="px-4 py-2 text-left">Usuário</th>
                        <th className="px-4 py-2 text-left">Contexto</th>
                        <th className="px-4 py-2 text-left">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                      {historicoRaw.map(audit => (
                        <tr key={audit.id}>
                          <td className="px-4 py-2 text-gray-600 dark:text-slate-400">
                            {formatDateBR(audit.timestamp.split('T')[0])} {audit.timestamp.split('T')[1]?.slice(0, 5)}
                          </td>
                          <td className="px-4 py-2">{audit.userNome || '-'}</td>
                          <td className="px-4 py-2">
                            {audit.entity === 'confinamento' ? 'Confinamento' : audit.entity === 'confinamentoAnimal' ? 'Animal no confinamento' : audit.entity}
                          </td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-700">
                              {audit.action === 'create' ? 'Criação' : audit.action === 'update' ? 'Edição' : audit.action === 'delete' ? 'Exclusão' : audit.action}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      <ConfinamentoModal
        open={modalConfinamentoOpen}
        mode="edit"
        initialData={confinamento}
        onClose={() => setModalConfinamentoOpen(false)}
        onSaved={() => {
          setModalConfinamentoOpen(false);
        }}
      />

      <ConfinamentoAnimalModal
        open={modalAnimalOpen}
        mode={vínculoEditando ? 'edit' : 'create'}
        confinamentoId={confinamentoId}
        initialData={vínculoEditando}
        onClose={() => {
          setModalAnimalOpen(false);
          setVínculoEditando(null);
        }}
        onSaved={() => {
          setModalAnimalOpen(false);
          setVínculoEditando(null);
        }}
      />

      <ConfinamentoAlimentacaoModal
        open={modalAlimentacaoOpen}
        mode={alimentacaoEditando ? 'edit' : 'create'}
        confinamentoId={confinamentoId!}
        initialData={alimentacaoEditando}
        onClose={() => {
          setModalAlimentacaoOpen(false);
          setAlimentacaoEditando(null);
        }}
        onSaved={() => {
          setModalAlimentacaoOpen(false);
          setAlimentacaoEditando(null);
        }}
      />

      <ConfinamentoPesagemModal
        open={modalPesagemOpen}
        confinamentoId={confinamentoId!}
        vinculosAtivos={vínculosAtivos}
        animaisMap={animaisMap}
        dataInicioConfinamento={confinamento?.dataInicio}
        onClose={() => setModalPesagemOpen(false)}
        onSaved={() => setModalPesagemOpen(false)}
      />

      <ConfirmDialog
        open={!!vínculoAEncerrar}
        title="Encerrar animal no confinamento"
        message={
          vínculoAEncerrar
            ? `Deseja realmente encerrar o animal ${animaisMap.get(vínculoAEncerrar.animalId)?.brinco ?? 'este'} no confinamento? O vínculo será marcado como encerrado com a data de hoje.`
            : ''
        }
        variant="warning"
        confirmText="Encerrar"
        cancelText="Cancelar"
        onConfirm={confirmarEncerrarVínculo}
        onCancel={() => setVínculoAEncerrar(null)}
      />

      <ConfirmDialog
        open={!!alimentacaoAExcluir}
        title="Excluir registro de alimentação"
        message={
          alimentacaoAExcluir
            ? `Deseja realmente excluir o registro de ${formatDateBR(alimentacaoAExcluir.data)}?`
            : ''
        }
        variant="danger"
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={confirmarExcluirAlimentacao}
        onCancel={() => setAlimentacaoAExcluir(null)}
      />
    </div>
  );
}
