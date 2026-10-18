import { createContext, useContext, useEffect, type ReactNode } from 'react';

interface ThemeContextValue {
  resolvedTheme: 'light';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const LIGHT_THEME: ThemeContextValue = { resolvedTheme: 'light' };

function applyLightTheme(): void {
  const root = document.documentElement;
  root.dataset.themeMode = 'light';
  root.dataset.theme = 'light';
  root.classList.remove('dark');
  root.style.colorScheme = 'light';
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = '#F1ECE5';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyLightTheme();
  }, []);

  return <ThemeContext.Provider value={LIGHT_THEME}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
