import create from 'zustand';

interface AppState {
  logoUrl?: string;
  setLogo: (url?: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  logoUrl: undefined,
  setLogo: (url) => set({ logoUrl: url }),
}));
