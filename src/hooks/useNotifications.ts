import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { useAlertSettings } from './useAlertSettings';
import { useFazendaContext } from './useFazendaContext';
import { chaveDesmama, chaveMortalidade, chaveDadosIncompletos, chaveMatrizSemCadastro, chavePesoForaPadrao, chaveVacina } from '../utils/notificacoesLidas';

interface NotificacaoDesmama {
  id: string;
  matrizId: string;
  brinco?: string;
  fazenda: string;
  meses: number;
  dataNascimento?: string;
}

interface NotificacaoMortalidade {
  fazendaId: string;
  fazenda: string;
  taxa: number;
  mortos: number;
  total: number;
}

interface NotificacaoDadosIncompletos {
  id: string;
  matrizId: string;
  brinco?: string;
  fazenda: string;
  problemas: string[]; // Ex: ['Sem raça', 'Sem data de nascimento']
}

interface NotificacaoMatrizSemCadastro {
  matrizId: string;
  fazendaId: string;
  fazenda: string;
  totalNascimentos: number;
}

interface NotificacaoPesoForaPadrao {
  id: string;
  nascimentoId: string;
  brinco?: string;
  fazenda: string;
  pesoAtual: number;
  pesoMedioEsperado: number;
  diferencaPercentual: number;
  idadeDias: number;
  ultimaPesagem: string;
}

interface NotificacaoVacina {
  id: string;
  nascimentoId: string;
  brinco?: string;
  fazenda: string;
  vacina: string;
  dataAplicacao: string;
  dataVencimento: string;
  status: 'vencida' | 'vence_em_breve';
  diasParaVencer: number;
}

export interface Notificacoes {
  desmamaAtrasada: NotificacaoDesmama[];
  mortalidadeAlta: NotificacaoMortalidade[];
  dadosIncompletos: NotificacaoDadosIncompletos[];
  matrizesSemCadastro: NotificacaoMatrizSemCadastro[];
  pesoForaPadrao: NotificacaoPesoForaPadrao[];
  vacinasVencidas: NotificacaoVacina[];
  vacinasVencendo: NotificacaoVacina[];
  total: number;
}

function parseDate(value?: string) {
  if (!value) return null;
  if (value.includes('/')) {
    const [dia, mes, ano] = value.split('/');
    if (dia && mes && ano) {
      const iso = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d;
    }
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function diffMeses(a: Date, b: Date) {
  const anos = b.getFullYear() - a.getFullYear();
  const meses = b.getMonth() - a.getMonth();
  return anos * 12 + meses;
}

export function useNotifications(): Notificacoes {
  const { fazendaAtivaId } = useFazendaContext();
  const nascimentosTodosRaw = useLiveQuery(() => db.nascimentos.toArray(), []) || [];
  const desmamas = useLiveQuery(() => db.desmamas.toArray(), []) || [];
  const pesagens = useLiveQuery(() => db.pesagens.toArray(), []) || [];
  const vacinacoes = useLiveQuery(() => db.vacinacoes.toArray(), []) || [];
  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const matrizesRaw = useLiveQuery(() => db.matrizes.toArray(), []) || [];
  const notificacoesLidasRaw = useLiveQuery(() => db.notificacoesLidas.toArray(), []) || [];
  const { alertSettings } = useAlertSettings();

  const fazendaMap = useMemo(() => {
    const map = new Map<string, string>();
    fazendasRaw.forEach((f) => {
      if (f.id) map.set(f.id, f.nome || '');
    });
    return map;
  }, [fazendasRaw]);

  // Mapa de matrizes por ID (UUID) para buscar identificador
  const matrizMap = useMemo(() => {
    const map = new Map<string, string>(); // ID -> identificador
    matrizesRaw.forEach((m) => {
      if (m.id && m.identificador) {
        map.set(m.id, m.identificador);
      }
    });
    return map;
  }, [matrizesRaw]);

  const matrizSet = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(matrizesRaw)) {
      matrizesRaw.forEach((m) => {
        if (m.identificador) {
          // Criar chave composta: identificador + fazendaId
          set.add(`${m.identificador}|${m.fazendaId}`);
        }
        // Também adicionar o ID da matriz (UUID) caso o nascimento use o ID em vez do identificador
        if (m.id && m.fazendaId) {
          set.add(`${m.id}|${m.fazendaId}`);
        }
      });
    }
    return set;
  }, [matrizesRaw]);

  const matrizesEmNascimentos = useMemo(() => {
    const map = new Map<string, { fazendaId: string; count: number }>();
    nascimentosTodosRaw.forEach((n) => {
      if (!n.matrizId) return;
      const key = `${n.matrizId}|${n.fazendaId}`;
      const existing = map.get(key) || { fazendaId: n.fazendaId, count: 0 };
      existing.count += 1;
      map.set(key, existing);
    });
    return map;
  }, [nascimentosTodosRaw]);

  const desmamaSet = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(desmamas)) {
      desmamas.forEach((d) => {
        if (d.nascimentoId) set.add(d.nascimentoId);
      });
    }
    return set;
  }, [desmamas]);

  const notificacoesLidasSet = useMemo(() => {
    return new Set(notificacoesLidasRaw.map(n => n.id));
  }, [notificacoesLidasRaw]);

  const notificacoes = useMemo<Notificacoes>(() => {
    const agora = new Date();
    agora.setHours(0, 0, 0, 0);
    const { limiteMesesDesmama, janelaMesesMortalidade, limiarMortalidade } = alertSettings;

    // Filtrar nascimentos por fazenda ativa
    const nascimentosFiltrados = fazendaAtivaId
      ? nascimentosTodosRaw.filter(n => n.fazendaId === fazendaAtivaId)
      : nascimentosTodosRaw;

    const desmamaAtrasada = nascimentosFiltrados
      .filter((n) => {
        if (n.morto) return false;
        const dataNasc = parseDate(n.dataNascimento);
        if (!dataNasc) return false;
        const meses = diffMeses(dataNasc, agora);
        const semDesmama = !desmamaSet.has(n.id);
        const naoLida = !notificacoesLidasSet.has(chaveDesmama(n.id));
        return semDesmama && meses >= limiteMesesDesmama && naoLida;
      })
      .map((n) => {
        const dataNasc = parseDate(n.dataNascimento)!;
        const meses = diffMeses(dataNasc, agora);
        const matrizIdentificador = matrizMap.get(n.matrizId) || n.matrizId;
        return {
          id: n.id,
          matrizId: matrizIdentificador,
          brinco: n.brincoNumero,
          fazenda: fazendaMap.get(n.fazendaId) || 'Sem fazenda',
          meses,
          dataNascimento: n.dataNascimento
        };
      })
      .sort((a, b) => b.meses - a.meses);

    const dataLimite = new Date(agora.getFullYear(), agora.getMonth() - (janelaMesesMortalidade - 1), 1);
    const estatisticas = new Map<string, { vivos: number; mortos: number; nome: string }>();

    nascimentosFiltrados.forEach((n) => {
      const dataRef = parseDate(n.dataNascimento) || parseDate(n.createdAt);
      if (!dataRef) return;
      if (dataRef < dataLimite) return;
      const entry = estatisticas.get(n.fazendaId) || { vivos: 0, mortos: 0, nome: fazendaMap.get(n.fazendaId) || 'Sem fazenda' };
      if (n.morto) entry.mortos += 1;
      else entry.vivos += 1;
      estatisticas.set(n.fazendaId, entry);
    });

    const mortalidadeAlta = Array.from(estatisticas.entries())
      .map(([fazendaId, dados]) => {
        const total = dados.vivos + dados.mortos;
        const taxa = total > 0 ? (dados.mortos / total) * 100 : 0;
        return {
          fazendaId,
          fazenda: dados.nome,
          taxa: Number(taxa.toFixed(2)),
          mortos: dados.mortos,
          total
        };
      })
      .filter((f) => f.total >= 5 && f.taxa >= limiarMortalidade && !notificacoesLidasSet.has(chaveMortalidade(f.fazendaId)))
      .sort((a, b) => b.taxa - a.taxa);

    // Dados incompletos: nascimentos sem informações importantes
    const dadosIncompletos = nascimentosFiltrados
      .filter((n) => {
        if (n.morto) return false; // Ignorar mortos
        const problemas: string[] = [];
        if (!n.raca || n.raca.trim() === '') problemas.push('Sem raça');
        if (!n.dataNascimento || n.dataNascimento.trim() === '') problemas.push('Sem data de nascimento');
        // if (!n.brincoNumero || n.brincoNumero.trim() === '') problemas.push('Sem brinco');
        const temProblemas = problemas.length > 0;
        const naoLida = !notificacoesLidasSet.has(chaveDadosIncompletos(n.id));
        return temProblemas && naoLida;
      })
      .map((n) => {
        const problemas: string[] = [];
        if (!n.raca || n.raca.trim() === '') problemas.push('Sem raça');
        if (!n.dataNascimento || n.dataNascimento.trim() === '') problemas.push('Sem data de nascimento');
        // if (!n.brincoNumero || n.brincoNumero.trim() === '') problemas.push('Sem brinco');
        const matrizIdentificador = matrizMap.get(n.matrizId) || n.matrizId;
        return {
          id: n.id,
          matrizId: matrizIdentificador,
          brinco: n.brincoNumero,
          fazenda: fazendaMap.get(n.fazendaId) || 'Sem fazenda',
          problemas
        };
      })
      .sort((a, b) => b.problemas.length - a.problemas.length);

    // Matrizes sem cadastro completo: matrizes que aparecem em nascimentos mas não têm cadastro
    const matrizesSemCadastro = Array.from(matrizesEmNascimentos.entries())
      .filter(([key]) => !matrizSet.has(key))
      .map(([key, dados]) => {
        const [matrizIdRaw] = key.split('|');
        // Tentar buscar o identificador da matriz, senão usar o próprio valor
        const matrizIdentificador = matrizMap.get(matrizIdRaw) || matrizIdRaw;
        return {
          matrizId: matrizIdentificador,
          fazendaId: dados.fazendaId,
          fazenda: fazendaMap.get(dados.fazendaId) || 'Sem fazenda',
          totalNascimentos: dados.count
        };
      })
      .filter((m) => !notificacoesLidasSet.has(chaveMatrizSemCadastro(m.matrizId, m.fazendaId)))
      .sort((a, b) => b.totalNascimentos - a.totalNascimentos)
      .slice(0, 20); // Limitar a 20 para não sobrecarregar

    // Peso fora do padrão: animais com peso abaixo da média esperada
    // Calcular média de peso por idade (em dias) e raça
    const pesoMedioPorIdadeERaca = (() => {
      const map = new Map<string, { soma: number; count: number }>(); // chave: "idadeDias|raca"
      
      pesagens.forEach((pesagem) => {
        const nascimento = nascimentosFiltrados.find(n => n.id === pesagem.nascimentoId);
        if (!nascimento || !nascimento.dataNascimento) return;
        
        const dataNasc = parseDate(nascimento.dataNascimento);
        const dataPesagem = parseDate(pesagem.dataPesagem);
        if (!dataNasc || !dataPesagem) return;
        
        const idadeDias = Math.floor((dataPesagem.getTime() - dataNasc.getTime()) / (1000 * 60 * 60 * 24));
        if (idadeDias < 0) return;
        
        const raca = nascimento.raca || 'Sem raça';
        const chave = `${Math.floor(idadeDias / 30)}|${raca}`; // Agrupar por mês e raça
        const existing = map.get(chave) || { soma: 0, count: 0 };
        existing.soma += pesagem.peso;
        existing.count += 1;
        map.set(chave, existing);
      });
      
      const medias = new Map<string, number>();
      map.forEach((value, key) => {
        medias.set(key, value.soma / value.count);
      });
      
      return medias;
    })();

    const pesoForaPadrao = nascimentosFiltrados
      .filter((n) => {
        if (n.morto) return false;
        if (!n.dataNascimento) return false;
        
        // Buscar última pesagem do animal
        const pesagensAnimal = pesagens
          .filter(p => p.nascimentoId === n.id)
          .sort((a, b) => {
            const dataA = parseDate(a.dataPesagem);
            const dataB = parseDate(b.dataPesagem);
            if (!dataA || !dataB) return 0;
            return dataB.getTime() - dataA.getTime();
          });
        
        if (pesagensAnimal.length === 0) return false;
        
        const ultimaPesagem = pesagensAnimal[0];
        const dataNasc = parseDate(n.dataNascimento);
        const dataPesagem = parseDate(ultimaPesagem.dataPesagem);
        if (!dataNasc || !dataPesagem) return false;
        
        const idadeDias = Math.floor((dataPesagem.getTime() - dataNasc.getTime()) / (1000 * 60 * 60 * 24));
        if (idadeDias < 30) return false; // Só alertar para animais com mais de 30 dias
        
        const raca = n.raca || 'Sem raça';
        const chave = `${Math.floor(idadeDias / 30)}|${raca}`;
        const pesoMedioEsperado = pesoMedioPorIdadeERaca.get(chave);
        
        if (!pesoMedioEsperado) return false;
        
        // Considerar fora do padrão se estiver 15% abaixo da média
        const diferencaPercentual = ((ultimaPesagem.peso - pesoMedioEsperado) / pesoMedioEsperado) * 100;
        const foraPadrao = diferencaPercentual < -15;
        const naoLida = !notificacoesLidasSet.has(chavePesoForaPadrao(n.id));
        
        return foraPadrao && naoLida;
      })
      .map((n) => {
        const pesagensAnimal = pesagens
          .filter(p => p.nascimentoId === n.id)
          .sort((a, b) => {
            const dataA = parseDate(a.dataPesagem);
            const dataB = parseDate(b.dataPesagem);
            if (!dataA || !dataB) return 0;
            return dataB.getTime() - dataA.getTime();
          });
        
        const ultimaPesagem = pesagensAnimal[0];
        const dataNasc = parseDate(n.dataNascimento)!;
        const dataPesagem = parseDate(ultimaPesagem.dataPesagem)!;
        const idadeDias = Math.floor((dataPesagem.getTime() - dataNasc.getTime()) / (1000 * 60 * 60 * 24));
        const raca = n.raca || 'Sem raça';
        const chave = `${Math.floor(idadeDias / 30)}|${raca}`;
        const pesoMedioEsperado = pesoMedioPorIdadeERaca.get(chave) || 0;
        const diferencaPercentual = ((ultimaPesagem.peso - pesoMedioEsperado) / pesoMedioEsperado) * 100;
        
        return {
          id: ultimaPesagem.id,
          nascimentoId: n.id,
          brinco: n.brincoNumero,
          fazenda: fazendaMap.get(n.fazendaId) || 'Sem fazenda',
          pesoAtual: ultimaPesagem.peso,
          pesoMedioEsperado: Math.round(pesoMedioEsperado * 100) / 100,
          diferencaPercentual: Math.round(diferencaPercentual * 100) / 100,
          idadeDias,
          ultimaPesagem: ultimaPesagem.dataPesagem
        };
      })
      .sort((a, b) => a.diferencaPercentual - b.diferencaPercentual); // Mais críticos primeiro

    // Vacinas vencidas e vencendo (até 30 dias)
    const vacinas = Array.isArray(vacinacoes) ? vacinacoes : [];
    const vacinasComVencimento = vacinas.filter(v => v.dataVencimento && v.dataAplicacao);
    const vacinasVencidas: NotificacaoVacina[] = [];
    const vacinasVencendo: NotificacaoVacina[] = [];

    vacinasComVencimento.forEach((vacina) => {
      const dataVencimento = parseDate(vacina.dataVencimento);
      if (!dataVencimento) return;
      dataVencimento.setHours(0, 0, 0, 0);
      const diffTime = dataVencimento.getTime() - agora.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const nascimento = nascimentosTodosRaw.find(n => n.id === vacina.nascimentoId);
      if (!nascimento) return;
      const fazenda = fazendaMap.get(nascimento.fazendaId) || 'Sem fazenda';
      const brinco = nascimento.brincoNumero;
      const base: NotificacaoVacina = {
        id: vacina.id,
        nascimentoId: vacina.nascimentoId,
        brinco,
        fazenda,
        vacina: vacina.vacina || 'Vacina',
        dataAplicacao: vacina.dataAplicacao,
        dataVencimento: vacina.dataVencimento || '',
        status: diffDays < 0 ? 'vencida' : 'vence_em_breve',
        diasParaVencer: diffDays
      };

      if (notificacoesLidasSet.has(chaveVacina(vacina.id))) return;

      if (diffDays < 0) {
        vacinasVencidas.push(base);
      } else if (diffDays <= 30) {
        vacinasVencendo.push(base);
      }
    });

    vacinasVencidas.sort((a, b) => a.diasParaVencer - b.diasParaVencer);
    vacinasVencendo.sort((a, b) => a.diasParaVencer - b.diasParaVencer);

    return {
      desmamaAtrasada,
      mortalidadeAlta,
      dadosIncompletos,
      matrizesSemCadastro,
      pesoForaPadrao,
      vacinasVencidas,
      vacinasVencendo,
      total:
        desmamaAtrasada.length +
        mortalidadeAlta.length +
        dadosIncompletos.length +
        matrizesSemCadastro.length +
        pesoForaPadrao.length +
        vacinasVencidas.length +
        vacinasVencendo.length
    };
  }, [alertSettings, desmamaSet, fazendaMap, nascimentosTodosRaw, pesagens, vacinacoes, matrizSet, matrizesEmNascimentos, matrizMap, notificacoesLidasSet, fazendaAtivaId]);

  return notificacoes;
}

