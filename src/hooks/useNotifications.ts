import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { useAlertSettings } from './useAlertSettings';

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

export interface Notificacoes {
  desmamaAtrasada: NotificacaoDesmama[];
  mortalidadeAlta: NotificacaoMortalidade[];
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
  const { alertSettings } = useAlertSettings();

  const fazendaMap = useMemo(() => {
    const map = new Map<string, string>();
    fazendasRaw.forEach((f) => {
      if (f.id) map.set(f.id, f.nome || '');
    });
    return map;
  }, [fazendasRaw]);

  const desmamaSet = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(desmamas)) {
      desmamas.forEach((d) => {
        if (d.nascimentoId) set.add(d.nascimentoId);
      });
    }
    return set;
  }, [desmamas]);

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
        return semDesmama && meses >= limiteMesesDesmama;
      })
      .map((n) => {
        const dataNasc = parseDate(n.dataNascimento)!;
        const meses = diffMeses(dataNasc, agora);
        return {
          id: n.id,
          matrizId: n.matrizId,
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
      .filter((f) => f.total >= 5 && f.taxa >= limiarMortalidade)
      .sort((a, b) => b.taxa - a.taxa);

    return {
      desmamaAtrasada,
      mortalidadeAlta,
      total: desmamaAtrasada.length + mortalidadeAlta.length
    };
  }, [alertSettings, desmamaSet, fazendaMap, nascimentosTodosRaw]);

  return notificacoes;
}

