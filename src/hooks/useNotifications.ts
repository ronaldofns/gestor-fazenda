import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { useAlertSettings } from './useAlertSettings';
import { chaveDesmama, chaveMortalidade, chaveDadosIncompletos, chaveMatrizSemCadastro } from '../utils/notificacoesLidas';

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

export interface Notificacoes {
  desmamaAtrasada: NotificacaoDesmama[];
  mortalidadeAlta: NotificacaoMortalidade[];
  dadosIncompletos: NotificacaoDadosIncompletos[];
  matrizesSemCadastro: NotificacaoMatrizSemCadastro[];
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
  const nascimentosTodosRaw = useLiveQuery(() => db.nascimentos.toArray(), []) || [];
  const desmamas = useLiveQuery(() => db.desmamas.toArray(), []) || [];
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
    const { limiteMesesDesmama, janelaMesesMortalidade, limiarMortalidade } = alertSettings;

    const desmamaAtrasada = nascimentosTodosRaw
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

    nascimentosTodosRaw.forEach((n) => {
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
    const dadosIncompletos = nascimentosTodosRaw
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

    return {
      desmamaAtrasada,
      mortalidadeAlta,
      dadosIncompletos,
      matrizesSemCadastro,
      total: desmamaAtrasada.length + mortalidadeAlta.length + dadosIncompletos.length + matrizesSemCadastro.length
    };
  }, [alertSettings, desmamaSet, fazendaMap, nascimentosTodosRaw, matrizSet, matrizesEmNascimentos, matrizMap, notificacoesLidasSet]);

  return notificacoes;
}

