import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  colors: {
    bg: string;
    card: string;
    textPrimary: string;
    textSecondary: string;
    green: string;
    red: string;
    orange: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_PALETTE = {
  light: {
    bg: '#FAFAFB',
    card: '#FFFFFF',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    green: '#22A45D',
    red: '#EF4444',
    orange: '#F59E0B',
  },
  dark: {
    bg: '#0D1214',
    card: '#172021',
    textPrimary: '#F5F7F7',
    textSecondary: '#A9B1B1',
    green: '#39D47A',
    red: '#FF4D55',
    orange: '#FF9F1C',
  },
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Padrão para novos usuários: 'system'
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('meu_financeiro_theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved as ThemeMode;
      }
    }
    return 'system';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Escuta mudanças de prefers-color-scheme em tempo real
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme, systemPrefersDark]);

  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('meu_financeiro_theme', theme);

    // Update meta theme-color to match current mode
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0D1214' : '#22A45D');
    }
  }, [theme, isDark]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const currentResolved = prev === 'system' ? (systemPrefersDark ? 'dark' : 'light') : prev;
      return currentResolved === 'light' ? 'dark' : 'light';
    });
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
  };

  const colors = THEME_PALETTE[resolvedTheme];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        isDark,
        toggleTheme,
        setTheme,
        colors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
