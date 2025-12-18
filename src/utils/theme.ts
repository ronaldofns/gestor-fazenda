export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'gestor-fazenda-theme';

export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === 'dark' || value === 'light' ? value : null;
}

export function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function getInitialTheme(): Theme {
  return getStoredTheme() ?? getPreferredTheme();
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}


