import { useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { Nascimento, Desmama, Pesagem, Vacina, Matriz } from '../db/models';

/**
 * Hooks otimizados para queries frequentes com memoização eficiente
 */

// Query otimizada de nascimentos por fazenda
export function useNascimentosByFazenda(fazendaId: string | null) {
  const nascimentosRaw = useLiveQuery(
    async () => {
      if (!fazendaId) return db.nascimentos.toArray();
      // Usar índice composto [fazendaId+synced] para melhor performance
      return db.nascimentos.where('fazendaId').equals(fazendaId).toArray();
    },
    [fazendaId],
    []
  );

  // Remover duplicados e ordenar
  const nascimentos = useMemo(() => {
    if (!nascimentosRaw || !Array.isArray(nascimentosRaw) || nascimentosRaw.length === 0) {
      return [];
    }

    const uniqueByUuid = new Map<string, Nascimento>();
    const uniqueByRemoteId = new Map<number, Nascimento>();

    for (const n of nascimentosRaw) {
      if (!uniqueByUuid.has(n.id)) {
        uniqueByUuid.set(n.id, n);
      } else {
        const existing = uniqueByUuid.get(n.id)!;
        const shouldReplace =
          (n.remoteId && !existing.remoteId) ||
          (n.remoteId && existing.remoteId && n.remoteId === existing.remoteId &&
            n.updatedAt && existing.updatedAt && new Date(n.updatedAt) > new Date(existing.updatedAt)) ||
          (!n.remoteId && !existing.remoteId &&
            n.updatedAt && existing.updatedAt && new Date(n.updatedAt) > new Date(existing.updatedAt));

        if (shouldReplace) {
          uniqueByUuid.set(n.id, n);
        }
      }

      if (n.remoteId) {
        if (!uniqueByRemoteId.has(n.remoteId)) {
          uniqueByRemoteId.set(n.remoteId, n);
        } else {
          const existing = uniqueByRemoteId.get(n.remoteId)!;
          const shouldReplace =
            (n.updatedAt && existing.updatedAt && new Date(n.updatedAt) > new Date(existing.updatedAt));

          if (shouldReplace) {
            if (uniqueByUuid.has(existing.id)) {
              uniqueByUuid.delete(existing.id);
            }
            uniqueByRemoteId.set(n.remoteId, n);
            uniqueByUuid.set(n.id, n);
          }
        }
      }
    }

    return Array.from(uniqueByUuid.values());
  }, [nascimentosRaw]);

  return nascimentos;
}

// Query otimizada de desmamas por nascimento
export function useDesmamasByNascimento(nascimentoId: string | null) {
  return useLiveQuery(
    async () => {
      if (!nascimentoId) return [];
      return db.desmamas.where('nascimentoId').equals(nascimentoId).toArray();
    },
    [nascimentoId],
    []
  );
}

// Query otimizada de pesagens por nascimento
export function usePesagensByNascimento(nascimentoId: string | null) {
  return useLiveQuery(
    async () => {
      if (!nascimentoId) return [];
      // Usar índice composto [nascimentoId+dataPesagem] para ordenação eficiente
      return db.pesagens
        .where('[nascimentoId+dataPesagem]')
        .between([nascimentoId, ''], [nascimentoId, '\uffff'])
        .toArray();
    },
    [nascimentoId],
    []
  );
}

// Query otimizada de vacinações por nascimento
export function useVacinacoesByNascimento(nascimentoId: string | null) {
  return useLiveQuery(
    async () => {
      if (!nascimentoId) return [];
      // Usar índice composto [nascimentoId+dataAplicacao] para ordenação eficiente
      return db.vacinacoes
        .where('[nascimentoId+dataAplicacao]')
        .between([nascimentoId, ''], [nascimentoId, '\uffff'])
        .toArray();
    },
    [nascimentoId],
    []
  );
}

// Query otimizada de matrizes por fazenda
export function useMatrizesByFazenda(fazendaId: string | null) {
  return useLiveQuery(
    async () => {
      if (!fazendaId) return db.matrizes.toArray();
      // Usar índice composto [fazendaId+ativo] para filtrar matrizes ativas
      return db.matrizes.where('fazendaId').equals(fazendaId).toArray();
    },
    [fazendaId],
    []
  );
}

// Query otimizada de registros pendentes de sincronização
export function usePendingSyncRecords() {
  const pending = useLiveQuery(async () => {
    const [
      nascimentosPendentes,
      desmamasPendentes,
      pesagensPendentes,
      vacinacoesPendentes,
      deletedPendentes
    ] = await Promise.all([
      db.nascimentos.where('synced').equals(0).count(),
      db.desmamas.where('synced').equals(0).count(),
      db.pesagens.where('synced').equals(0).count(),
      db.vacinacoes.where('synced').equals(0).count(),
      db.deletedRecords.where('synced').equals(0).count()
    ]);

    return {
      nascimentos: nascimentosPendentes,
      desmamas: desmamasPendentes,
      pesagens: pesagensPendentes,
      vacinacoes: vacinacoesPendentes,
      deleted: deletedPendentes,
      total: nascimentosPendentes + desmamasPendentes + pesagensPendentes + vacinacoesPendentes + deletedPendentes
    };
  }, []);

  return pending || { nascimentos: 0, desmamas: 0, pesagens: 0, vacinacoes: 0, deleted: 0, total: 0 };
}

// Hook para buscar nascimento com todas as suas relações (otimizado)
export function useNascimentoCompleto(nascimentoId: string | null) {
  const nascimento = useLiveQuery(
    async () => {
      if (!nascimentoId) return null;
      return db.nascimentos.get(nascimentoId);
    },
    [nascimentoId],
    null
  );

  const desmamas = useDesmamasByNascimento(nascimentoId);
  const pesagens = usePesagensByNascimento(nascimentoId);
  const vacinacoes = useVacinacoesByNascimento(nascimentoId);

  return useMemo(() => {
    if (!nascimento) return null;
    return {
      nascimento,
      desmamas: desmamas || [],
      pesagens: pesagens || [],
      vacinacoes: vacinacoes || []
    };
  }, [nascimento, desmamas, pesagens, vacinacoes]);
}

// Hook para estatísticas otimizadas
export function useEstatisticasFazenda(fazendaId: string | null) {
  return useLiveQuery(async () => {
    if (!fazendaId) return null;

    const [nascimentos, matrizes, desmamas] = await Promise.all([
      db.nascimentos.where('fazendaId').equals(fazendaId).toArray(),
      db.matrizes.where('fazendaId').equals(fazendaId).toArray(),
      db.desmamas.toArray()
    ]);

    const totalNascimentos = nascimentos.length;
    const totalMatrizes = matrizes.filter(m => m.ativo).length;
    const totalMortos = nascimentos.filter(n => n.morto).length;
    const totalDesmamados = desmamas.filter(d => 
      nascimentos.some(n => n.id === d.nascimentoId)
    ).length;

    const taxaMortalidade = totalNascimentos > 0 
      ? ((totalMortos / totalNascimentos) * 100).toFixed(1)
      : '0.0';

    const taxaDesmame = totalNascimentos > 0
      ? ((totalDesmamados / totalNascimentos) * 100).toFixed(1)
      : '0.0';

    return {
      totalNascimentos,
      totalMatrizes,
      totalMortos,
      totalDesmamados,
      taxaMortalidade: parseFloat(taxaMortalidade),
      taxaDesmame: parseFloat(taxaDesmame)
    };
  }, [fazendaId]);
}

// Callbacks otimizados para operações comuns
export function useOptimizedActions() {
  const deletarNascimento = useCallback(async (id: string) => {
    const nascimento = await db.nascimentos.get(id);
    if (!nascimento) return;

    // Adicionar à tabela de deletados
    await db.deletedRecords.add({
      id: `del-nasc-${Date.now()}-${Math.random()}`,
      uuid: nascimento.id,
      remoteId: nascimento.remoteId || null,
      deletedAt: new Date().toISOString(),
      synced: false
    });

    // Remover do banco local
    await db.nascimentos.delete(id);
  }, []);

  const deletarDesmama = useCallback(async (id: string) => {
    const desmama = await db.desmamas.get(id);
    if (!desmama) return;

    await db.deletedRecords.add({
      id: `del-desm-${Date.now()}-${Math.random()}`,
      uuid: desmama.id,
      remoteId: desmama.remoteId || null,
      deletedAt: new Date().toISOString(),
      synced: false
    });

    await db.desmamas.delete(id);
  }, []);

  const deletarPesagem = useCallback(async (id: string) => {
    const pesagem = await db.pesagens.get(id);
    if (!pesagem) return;

    await db.deletedRecords.add({
      id: `del-pes-${Date.now()}-${Math.random()}`,
      uuid: pesagem.id,
      remoteId: pesagem.remoteId || null,
      deletedAt: new Date().toISOString(),
      synced: false
    });

    await db.pesagens.delete(id);
  }, []);

  const deletarVacina = useCallback(async (id: string) => {
    const vacina = await db.vacinacoes.get(id);
    if (!vacina) return;

    await db.deletedRecords.add({
      id: `del-vac-${Date.now()}-${Math.random()}`,
      uuid: vacina.id,
      remoteId: vacina.remoteId || null,
      deletedAt: new Date().toISOString(),
      synced: false
    });

    await db.vacinacoes.delete(id);
  }, []);

  return {
    deletarNascimento,
    deletarDesmama,
    deletarPesagem,
    deletarVacina
  };
}
