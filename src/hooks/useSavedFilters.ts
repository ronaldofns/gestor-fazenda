import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Sistema de filtros salvos persistente no localStorage
 * Permite criar, salvar e reutilizar filtros complexos
 */

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between' | 'in' | 'notIn';
  value: any;
  label?: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  conditions: FilterCondition[];
  createdAt: string;
  lastUsedAt?: string;
  useCount: number;
  favorite: boolean;
}

const STORAGE_KEY = 'gf-saved-filters';

export function useSavedFilters(scope: string = 'global') {
  const storageKey = `${STORAGE_KEY}-${scope}`;
  
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erro ao carregar filtros salvos:', error);
      return [];
    }
  });

  // Salvar no localStorage sempre que mudar
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(savedFilters));
    } catch (error) {
      console.error('Erro ao salvar filtros:', error);
    }
  }, [savedFilters, storageKey]);

  // Criar novo filtro
  const saveFilter = useCallback((
    name: string,
    conditions: FilterCondition[],
    description?: string
  ): SavedFilter => {
    const newFilter: SavedFilter = {
      id: crypto.randomUUID(),
      name,
      description,
      conditions,
      createdAt: new Date().toISOString(),
      useCount: 0,
      favorite: false
    };

    setSavedFilters(prev => [...prev, newFilter]);
    return newFilter;
  }, []);

  // Atualizar filtro existente
  const updateFilter = useCallback((
    id: string,
    updates: Partial<Omit<SavedFilter, 'id' | 'createdAt'>>
  ) => {
    setSavedFilters(prev =>
      prev.map(filter =>
        filter.id === id ? { ...filter, ...updates } : filter
      )
    );
  }, []);

  // Deletar filtro
  const deleteFilter = useCallback((id: string) => {
    setSavedFilters(prev => prev.filter(filter => filter.id !== id));
  }, []);

  // Marcar filtro como usado (incrementa contador e atualiza lastUsedAt)
  const markFilterAsUsed = useCallback((id: string) => {
    setSavedFilters(prev =>
      prev.map(filter =>
        filter.id === id
          ? {
              ...filter,
              useCount: filter.useCount + 1,
              lastUsedAt: new Date().toISOString()
            }
          : filter
      )
    );
  }, []);

  // Alternar favorito
  const toggleFavorite = useCallback((id: string) => {
    setSavedFilters(prev =>
      prev.map(filter =>
        filter.id === id ? { ...filter, favorite: !filter.favorite } : filter
      )
    );
  }, []);

  // Duplicar filtro
  const duplicateFilter = useCallback((id: string) => {
    const original = savedFilters.find(f => f.id === id);
    if (!original) return;

    const duplicate: SavedFilter = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (cópia)`,
      createdAt: new Date().toISOString(),
      lastUsedAt: undefined,
      useCount: 0,
      favorite: false
    };

    setSavedFilters(prev => [...prev, duplicate]);
  }, [savedFilters]);

  // Obter filtros favoritos
  const favoriteFilters = useMemo(() => {
    return savedFilters.filter(f => f.favorite);
  }, [savedFilters]);

  // Obter filtros mais usados
  const mostUsedFilters = useMemo(() => {
    return [...savedFilters]
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 5);
  }, [savedFilters]);

  // Obter filtros recentes
  const recentFilters = useMemo(() => {
    return [...savedFilters]
      .filter(f => f.lastUsedAt)
      .sort((a, b) => {
        const dateA = new Date(a.lastUsedAt || 0).getTime();
        const dateB = new Date(b.lastUsedAt || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [savedFilters]);

  // Buscar filtros por nome
  const searchFilters = useCallback((query: string) => {
    const lowerQuery = query.toLowerCase();
    return savedFilters.filter(
      f =>
        f.name.toLowerCase().includes(lowerQuery) ||
        f.description?.toLowerCase().includes(lowerQuery)
    );
  }, [savedFilters]);

  // Limpar todos os filtros
  const clearAllFilters = useCallback(() => {
    if (window.confirm('Tem certeza que deseja excluir todos os filtros salvos?')) {
      setSavedFilters([]);
    }
  }, []);

  // Exportar filtros
  const exportFilters = useCallback(() => {
    const dataStr = JSON.stringify(savedFilters, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `filtros-${scope}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [savedFilters, scope]);

  // Importar filtros
  const importFilters = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const imported = JSON.parse(content) as SavedFilter[];
          
          // Validar estrutura básica
          if (!Array.isArray(imported)) {
            throw new Error('Formato inválido');
          }

          // Gerar novos IDs para evitar conflitos
          const newFilters = imported.map(f => ({
            ...f,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            lastUsedAt: undefined,
            useCount: 0
          }));

          setSavedFilters(prev => [...prev, ...newFilters]);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }, []);

  return {
    savedFilters,
    favoriteFilters,
    mostUsedFilters,
    recentFilters,
    saveFilter,
    updateFilter,
    deleteFilter,
    markFilterAsUsed,
    toggleFavorite,
    duplicateFilter,
    searchFilters,
    clearAllFilters,
    exportFilters,
    importFilters
  };
}

// Hook para aplicar filtros em dados
export function useApplyFilters<T>(
  data: T[],
  conditions: FilterCondition[]
): T[] {
  return useMemo(() => {
    if (!data || data.length === 0 || conditions.length === 0) {
      return data || [];
    }

    return data.filter(item => {
      // Todas as condições devem ser satisfeitas (AND lógico)
      return conditions.every(condition => {
        const value = (item as any)[condition.field];
        const conditionValue = condition.value;

        switch (condition.operator) {
          case 'equals':
            return value === conditionValue;

          case 'contains':
            return String(value || '')
              .toLowerCase()
              .includes(String(conditionValue).toLowerCase());

          case 'startsWith':
            return String(value || '')
              .toLowerCase()
              .startsWith(String(conditionValue).toLowerCase());

          case 'endsWith':
            return String(value || '')
              .toLowerCase()
              .endsWith(String(conditionValue).toLowerCase());

          case 'greaterThan':
            return Number(value) > Number(conditionValue);

          case 'lessThan':
            return Number(value) < Number(conditionValue);

          case 'between':
            if (Array.isArray(conditionValue) && conditionValue.length === 2) {
              const numValue = Number(value);
              return numValue >= Number(conditionValue[0]) && numValue <= Number(conditionValue[1]);
            }
            return false;

          case 'in':
            if (Array.isArray(conditionValue)) {
              return conditionValue.includes(value);
            }
            return false;

          case 'notIn':
            if (Array.isArray(conditionValue)) {
              return !conditionValue.includes(value);
            }
            return true;

          default:
            return true;
        }
      });
    });
  }, [data, conditions]);
}

// Hook para histórico de buscas/filtros recentes
export function useSearchHistory(scope: string = 'global', maxItems: number = 10) {
  const storageKey = `gf-search-history-${scope}`;
  
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      return [];
    }
  });

  // Salvar no localStorage sempre que mudar
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  }, [history, storageKey]);

  // Adicionar ao histórico
  const addToHistory = useCallback((query: string) => {
    if (!query || query.trim().length === 0) return;

    setHistory(prev => {
      // Remover duplicados e adicionar no topo
      const filtered = prev.filter(item => item !== query);
      return [query, ...filtered].slice(0, maxItems);
    });
  }, [maxItems]);

  // Remover do histórico
  const removeFromHistory = useCallback((query: string) => {
    setHistory(prev => prev.filter(item => item !== query));
  }, []);

  // Limpar histórico
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory
  };
}
