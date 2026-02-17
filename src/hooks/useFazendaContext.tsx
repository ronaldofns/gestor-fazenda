import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexieDB";
import { Fazenda } from "../db/models";

interface FazendaContextType {
  fazendaAtivaId: string | null;
  setFazendaAtiva: (fazendaId: string | null) => void;
  fazendaSelecionada: Fazenda | null;
}

const FazendaContext = createContext<FazendaContextType | undefined>(undefined);

export function FazendaContextProvider({ children }: { children: ReactNode }) {
  const [fazendaAtivaId, setFazendaAtivaId] = useState<string | null>(() => {
    return localStorage.getItem("gestor-fazenda-ativa-id");
  });

  useEffect(() => {
    if (fazendaAtivaId) {
      localStorage.setItem("gestor-fazenda-ativa-id", fazendaAtivaId);
    } else {
      localStorage.removeItem("gestor-fazenda-ativa-id");
    }
  }, [fazendaAtivaId]);

  const setFazendaAtiva = (fazendaId: string | null) => {
    setFazendaAtivaId(fazendaId);
  };

  const fazendaSelecionada =
    useLiveQuery(async () => {
      if (!fazendaAtivaId) return null;
      return await db.fazendas.get(fazendaAtivaId);
    }, [fazendaAtivaId]) ?? null;

  const value = { fazendaAtivaId, setFazendaAtiva, fazendaSelecionada };

  return (
    <FazendaContext.Provider value={value}>{children}</FazendaContext.Provider>
  );
}

export function useFazendaContext() {
  const context = useContext(FazendaContext);
  if (!context) {
    throw new Error(
      "useFazendaContext deve ser usado dentro de FazendaContextProvider",
    );
  }
  return context;
}
