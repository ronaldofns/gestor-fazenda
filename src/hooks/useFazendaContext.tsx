import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FazendaContextType {
  fazendaAtivaId: string | null;
  setFazendaAtiva: (fazendaId: string | null) => void;
}

const FazendaContext = createContext<FazendaContextType | undefined>(undefined);

export function FazendaContextProvider({ children }: { children: ReactNode }) {
  const [fazendaAtivaId, setFazendaAtivaId] = useState<string | null>(() => {
    // Carregar do localStorage na inicialização
    return localStorage.getItem('gestor-fazenda-ativa-id');
  });

  useEffect(() => {
    // Salvar no localStorage quando mudar
    if (fazendaAtivaId) {
      localStorage.setItem('gestor-fazenda-ativa-id', fazendaAtivaId);
    } else {
      localStorage.removeItem('gestor-fazenda-ativa-id');
    }
  }, [fazendaAtivaId]);

  const setFazendaAtiva = (fazendaId: string | null) => {
    setFazendaAtivaId(fazendaId);
  };

  const value = { fazendaAtivaId, setFazendaAtiva };
  
  return (
    <FazendaContext.Provider value={value}>
      {children}
    </FazendaContext.Provider>
  );
}

export function useFazendaContext() {
  const context = useContext(FazendaContext);
  if (!context) {
    throw new Error('useFazendaContext deve ser usado dentro de FazendaContextProvider');
  }
  return context;
}
