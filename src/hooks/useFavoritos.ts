import { useState, useEffect, useCallback } from 'react';

type TipoFavorito = 'fazenda' | 'raca';

interface FavoritosState {
  fazendas: string[]; // IDs das fazendas favoritas
  racas: string[]; // Nomes das raças favoritas
}

const STORAGE_KEY = 'gestor-fazenda-favoritos';

const getFavoritosFromStorage = (): FavoritosState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Erro ao ler favoritos do localStorage:', error);
  }
  return { fazendas: [], racas: [] };
};

const saveFavoritosToStorage = (favoritos: FavoritosState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favoritos));
  } catch (error) {
    console.error('Erro ao salvar favoritos no localStorage:', error);
  }
};

export function useFavoritos() {
  const [favoritos, setFavoritos] = useState<FavoritosState>(() => getFavoritosFromStorage());

  // Carregar favoritos do localStorage na inicialização
  useEffect(() => {
    const stored = getFavoritosFromStorage();
    setFavoritos(stored);
  }, []);

  const adicionarFavorito = useCallback((tipo: TipoFavorito, id: string) => {
    setFavoritos((prev) => {
      const novo = { ...prev };
      if (tipo === 'fazenda') {
        if (!novo.fazendas.includes(id)) {
          novo.fazendas = [...novo.fazendas, id];
        }
      } else if (tipo === 'raca') {
        if (!novo.racas.includes(id)) {
          novo.racas = [...novo.racas, id];
        }
      }
      saveFavoritosToStorage(novo);
      return novo;
    });
  }, []);

  const removerFavorito = useCallback((tipo: TipoFavorito, id: string) => {
    setFavoritos((prev) => {
      const novo = { ...prev };
      if (tipo === 'fazenda') {
        novo.fazendas = novo.fazendas.filter((f) => f !== id);
      } else if (tipo === 'raca') {
        novo.racas = novo.racas.filter((r) => r !== id);
      }
      saveFavoritosToStorage(novo);
      return novo;
    });
  }, []);

  const toggleFavorito = useCallback((tipo: TipoFavorito, id: string) => {
    setFavoritos((prev) => {
      const novo = { ...prev };
      if (tipo === 'fazenda') {
        if (novo.fazendas.includes(id)) {
          novo.fazendas = novo.fazendas.filter((f) => f !== id);
        } else {
          novo.fazendas = [...novo.fazendas, id];
        }
      } else if (tipo === 'raca') {
        if (novo.racas.includes(id)) {
          novo.racas = novo.racas.filter((r) => r !== id);
        } else {
          novo.racas = [...novo.racas, id];
        }
      }
      saveFavoritosToStorage(novo);
      return novo;
    });
  }, []);

  const isFavorito = useCallback((tipo: TipoFavorito, id: string): boolean => {
    if (tipo === 'fazenda') {
      return favoritos.fazendas.includes(id);
    } else if (tipo === 'raca') {
      return favoritos.racas.includes(id);
    }
    return false;
  }, [favoritos]);

  return {
    favoritos,
    adicionarFavorito,
    removerFavorito,
    toggleFavorito,
    isFavorito
  };
}

