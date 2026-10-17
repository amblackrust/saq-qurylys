import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = 'saq_theme';
let resolvedThemeSnapshot: 'light' | 'dark' = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
const resolvedThemeListeners = new Set<() => void>();

function subscribeResolvedTheme(listener: () => void) {
  resolvedThemeListeners.add(listener);
  return () => resolvedThemeListeners.delete(listener);
}

function getResolvedTheme() {
  return resolvedThemeSnapshot;
}

function publishResolvedTheme(theme: 'light' | 'dark') {
  if (resolvedThemeSnapshot === theme) return;
  resolvedThemeSnapshot = theme;
  resolvedThemeListeners.forEach((listener) => listener());
}

function storedMode(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
}

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyTheme(mode: ThemeMode): 'light' | 'dark' {
  const resolved = mode === 'system' ? (prefersDark() ? 'dark' : 'light') : mode;
  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = resolved === 'dark' ? '#0c0f15' : '#f5f5f7';
  publishResolvedTheme(resolved);
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(storedMode);
  const resolvedTheme = useSyncExternalStore(subscribeResolvedTheme, getResolvedTheme, getResolvedTheme);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    applyTheme(nextMode);
    try {
      localStorage.setItem(THEME_KEY, nextMode);
    } catch {
      // The theme still applies for this session when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    applyTheme(mode);
    if (mode !== 'system') return;

    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme('system');
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [mode]);

  useEffect(() => {
    const syncTab = (event: StorageEvent) => {
      if (event.key !== THEME_KEY) return;
      const value = event.newValue;
      const nextMode = value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
      setModeState(nextMode);
      applyTheme(nextMode);
    };
    window.addEventListener('storage', syncTab);
    return () => window.removeEventListener('storage', syncTab);
  }, []);

  const value = useMemo(() => ({ mode, resolvedTheme, setMode }), [mode, resolvedTheme, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
