import { create } from 'zustand';

interface BalancaState {
  /** Peso em kg lido da balança conectada (null se não conectada ou sem leitura) */
  pesoKg: number | null;
  setPesoKg: (peso: number | null) => void;
}

export const useBalancaStore = create<BalancaState>((set) => ({
  pesoKg: null,
  setPesoKg: (pesoKg) => set({ pesoKg })
}));
