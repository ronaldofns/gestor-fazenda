import { useMemo, useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { Nascimento, Desmama, Pesagem, Vacina, Matriz, Fazenda, Raca, Categoria } from '../db/models';

/**
 * Hooks otimizados para queries no IndexedDB com memoização
 * Evitam re-renders desnecessários e melhoram a performance
 */

// Hook otimizado para buscar nascimentos por fazenda
export function useOptimizedNascimentos(fazendaId?: string) {
  const nascimentosRaw = useLiveQuery(
    async () => {
      if (fazendaId) {
        // Usar índice composto para melhor performance
        return await db.nascimentos
          .where('[fazendaId+synced]')
          .between([fazendaId, 0], [fazendaId, 1])
          .toArray();
      }
      return await db.nascimentos.toArray();
    },
    [fazendaId],
    []
  );

  // Remover duplicados e ordenar
  const nascimentos = useMemo(() => {
    if (!nascimentosRaw || nascimentosRaw.length === 0) return [];

    const uniqueMap = new Map<string, Nascimento>();
    
    for (const n of nascimentosRaw) {
      const existing = uniqueMap.get(n.id);
      if (!existing || (n.updatedAt && existing.updatedAt && new Date(n.updatedAt) > new Date(existing.updatedAt))) {
        uniqueMap.set(n.id, n);
      }
    }

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const dateA = new Date(a.dataNascimento || a.createdAt);
      const dateB = new Date(b.dataNascimento || b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  }, [nascimentosRaw]);

  return nascimentos;
}

// Hook otimizado para buscar desmamas por nascimento
export function useOptimizedDesmamas(nascimentoId?: string) {
  const desmamas = useLiveQuery(
    async () => {
      if (nascimentoId) {
        return await db.desmamas
          .where('nascimentoId')
          .equals(nascimentoId)
          .toArray();
      }
      return await db.desmamas.toArray();
    },
    [nascimentoId],
    []
  );

  return desmamas || [];
}

// Hook otimizado para buscar pesagens por nascimento
export function useOptimizedPesagens(nascimentoId?: string) {
  const pesagens = useLiveQuery(
    async () => {
      if (nascimentoId) {
        return await db.pesagens
          .where('nascimentoId')
          .equals(nascimentoId)
          .toArray();
      }
      return await db.pesagens.toArray();
    },
    [nascimentoId],
    []
  );

  // Ordenar por data
  const pesagensOrdenadas = useMemo(() => {
    if (!pesagens || pesagens.length === 0) return [];
    return [...pesagens].sort((a, b) => {
      const dateA = new Date(a.dataPesagem);
      const dateB = new Date(b.dataPesagem);
      return dateA.getTime() - dateB.getTime();
    });
  }, [pesagens]);

  return pesagensOrdenadas;
}

// Hook otimizado para buscar vacinações por nascimento
export function useOptimizedVacinacoes(nascimentoId?: string) {
  const vacinacoes = useLiveQuery(
    async () => {
      if (nascimentoId) {
        return await db.vacinacoes
          .where('nascimentoId')
          .equals(nascimentoId)
          .toArray();
      }
      return await db.vacinacoes.toArray();
    },
    [nascimentoId],
    []
  );

  // Ordenar por data de aplicação
  const vacinacoesOrdenadas = useMemo(() => {
    if (!vacinacoes || vacinacoes.length === 0) return [];
    return [...vacinacoes].sort((a, b) => {
      const dateA = new Date(a.dataAplicacao);
      const dateB = new Date(b.dataAplicacao);
      return dateB.getTime() - dateA.getTime();
    });
  }, [vacinacoes]);

  return vacinacoesOrdenadas;
}

// Hook otimizado para buscar matrizes por fazenda
export function useOptimizedMatrizes(fazendaId?: string) {
  const matrizes = useLiveQuery(
    async () => {
      if (fazendaId) {
        return await db.matrizes
          .where('[fazendaId+ativo]')
          .between([fazendaId, 0], [fazendaId, 1])
          .toArray();
      }
      return await db.matrizes.toArray();
    },
    [fazendaId],
    []
  );

  // Ordenar por identificador
  const matrizesOrdenadas = useMemo(() => {
    if (!matrizes || matrizes.length === 0) return [];
    return [...matrizes].sort((a, b) => 
      (a.identificador || '').localeCompare(b.identificador || '')
    );
  }, [matrizes]);

  return matrizesOrdenadas;
}

// Hook otimizado para buscar fazendas
export function useOptimizedFazendas() {
  const fazendas = useLiveQuery(() => db.fazendas.toArray(), [], []);

  const fazendasOrdenadas = useMemo(() => {
    if (!fazendas || fazendas.length === 0) return [];
    return [...fazendas].sort((a, b) => 
      (a.nome || '').localeCompare(b.nome || '')
    );
  }, [fazendas]);

  return fazendasOrdenadas;
}

// Hook otimizado para buscar raças
export function useOptimizedRacas() {
  const racas = useLiveQuery(() => db.racas.toArray(), [], []);

  const racasOrdenadas = useMemo(() => {
    if (!racas || racas.length === 0) return [];
    return [...racas].sort((a, b) => 
      (a.nome || '').localeCompare(b.nome || '')
    );
  }, [racas]);

  return racasOrdenadas;
}

// Hook otimizado para buscar categorias
export function useOptimizedCategorias() {
  const categorias = useLiveQuery(() => db.categorias.toArray(), [], []);

  const categoriasOrdenadas = useMemo(() => {
    if (!categorias || categorias.length === 0) return [];
    return [...categorias].sort((a, b) => 
      (a.nome || '').localeCompare(b.nome || '')
    );
  }, [categorias]);

  return categoriasOrdenadas;
}

// Hook otimizado para contar registros pendentes de sincronização
export function useOptimizedPendingSyncCount() {
  const count = useLiveQuery(async () => {
    const [
      nascimentosPending,
      desmamasPending,
      pesagensPending,
      vacinacoesPending,
      matrizespending,
      fazendasPending,
      racasPending,
      categoriasPending,
      deletedPending
    ] = await Promise.all([
      db.nascimentos.where('synced').equals(0).count(),
      db.desmamas.where('synced').equals(0).count(),
      db.pesagens.where('synced').equals(0).count(),
      db.vacinacoes.where('synced').equals(0).count(),
      db.matrizes.where('synced').equals(0).count(),
      db.fazendas.where('synced').equals(0).count(),
      db.racas.where('synced').equals(0).count(),
      db.categorias.where('synced').equals(0).count(),
      db.deletedRecords.where('synced').equals(0).count()
    ]);

    return (
      nascimentosPending +
      desmamasPending +
      pesagensPending +
      vacinacoesPending +
      matrizespending +
      fazendasPending +
      racasPending +
      categoriasPending +
      deletedPending
    );
  }, [], 0);

  return count || 0;
}

// Hook para buscar uma matriz específica (com cache)
export function useOptimizedMatriz(matrizId?: string) {
  const matriz = useLiveQuery(
    async () => {
      if (!matrizId) return null;
      return await db.matrizes.get(matrizId);
    },
    [matrizId],
    null
  );

  return matriz;
}

// Hook para buscar dados completos de um animal (nascimento + desmama + pesagens + vacinas)
export function useOptimizedAnimalCompleto(nascimentoId?: string) {
  const nascimento = useLiveQuery(
    async () => {
      if (!nascimentoId) return null;
      return await db.nascimentos.get(nascimentoId);
    },
    [nascimentoId],
    null
  );

  const desmama = useLiveQuery(
    async () => {
      if (!nascimentoId) return null;
      const desmamas = await db.desmamas
        .where('nascimentoId')
        .equals(nascimentoId)
        .toArray();
      return desmamas[0] || null;
    },
    [nascimentoId],
    null
  );

  const pesagens = useOptimizedPesagens(nascimentoId);
  const vacinacoes = useOptimizedVacinacoes(nascimentoId);

  return useMemo(
    () => ({
      nascimento,
      desmama,
      pesagens,
      vacinacoes
    }),
    [nascimento, desmama, pesagens, vacinacoes]
  );
}

// Hook para criar funções de CRUD otimizadas com useCallback
export function useOptimizedCrud<T extends { id: string }>(tableName: keyof typeof db) {
  const create = useCallback(
    async (data: T) => {
      const table = db[tableName] as any;
      await table.add(data);
    },
    [tableName]
  );

  const update = useCallback(
    async (id: string, data: Partial<T>) => {
      const table = db[tableName] as any;
      await table.update(id, data);
    },
    [tableName]
  );

  const remove = useCallback(
    async (id: string) => {
      const table = db[tableName] as any;
      await table.delete(id);
    },
    [tableName]
  );

  const get = useCallback(
    async (id: string): Promise<T | undefined> => {
      const table = db[tableName] as any;
      return await table.get(id);
    },
    [tableName]
  );

  return useMemo(
    () => ({
      create,
      update,
      remove,
      get
    }),
    [create, update, remove, get]
  );
}

// Hook para filtros otimizados
export function useOptimizedFilter<T>(
  items: T[],
  filterFn: (item: T) => boolean
) {
  return useMemo(() => {
    if (!items || items.length === 0) return [];
    return items.filter(filterFn);
  }, [items, filterFn]);
}

// Hook para ordenação otimizada
export function useOptimizedSort<T>(
  items: T[],
  sortFn: (a: T, b: T) => number
) {
  return useMemo(() => {
    if (!items || items.length === 0) return [];
    return [...items].sort(sortFn);
  }, [items, sortFn]);
}

// Hook para paginação otimizada
export function useOptimizedPagination<T>(items: T[], pageSize: number) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(() => {
    return Math.ceil((items?.length || 0) / pageSize);
  }, [items, pageSize]);

  const paginatedItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return items.slice(start, end);
  }, [items, currentPage, pageSize]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  return useMemo(
    () => ({
      items: paginatedItems,
      currentPage,
      totalPages,
      goToPage,
      nextPage,
      prevPage,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    }),
    [paginatedItems, currentPage, totalPages, goToPage, nextPage, prevPage]
  );
}
