'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export type ThemeMode = 'system' | 'dark' | 'light';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: 'dark' | 'light';
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeModuleProvider');
  }
  return context;
};

const STORAGE_KEY = 'remises_theme_preference';

interface ThemeModuleProviderProps {
  children: React.ReactNode;
}

export const ThemeModuleProvider: React.FC<ThemeModuleProviderProps> = ({ children }) => {
  const pathname = usePathname();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [systemIsDark, setSystemIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // Determinar si la ruta actual pertenece a chofer o cliente
  const isAllowedModule = useCallback((path?: string | null) => {
    if (!path) return true;
    return path.startsWith('/chofer') || path.startsWith('/cliente');
  }, []);

  // Inicializar preferencia y detector de sistema
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        setThemeModeState(saved);
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setSystemIsDark(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        setSystemIsDark(e.matches);
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      } else if ((mediaQuery as any).addListener) {
        (mediaQuery as any).addListener(handleChange);
        return () => (mediaQuery as any).removeListener(handleChange);
      }
    }
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const resolvedTheme: 'dark' | 'light' =
    themeMode === 'system' ? (systemIsDark ? 'dark' : 'light') : themeMode;

  const isDark = resolvedTheme === 'dark';

  // Aplicar clase .dark en <html> solo cuando estemos en chofer o cliente
  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;

    const allowed = isAllowedModule(pathname);
    const root = document.documentElement;

    if (allowed && isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    return () => {
      // Limpieza preventiva al desmontar o cambiar de ruta
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    };
  }, [mounted, pathname, isDark, isAllowedModule]);

  const toggleTheme = useCallback(() => {
    // Si está en sistema, pasa a oscuro; si está en oscuro, pasa a claro; si está en claro, pasa a sistema
    setThemeModeState((prev) => {
      let next: ThemeMode = 'system';
      if (prev === 'system') next = 'dark';
      else if (prev === 'dark') next = 'light';
      else next = 'system';

      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        isDark,
        setThemeMode,
        toggleTheme,
      }}
    >
      <div className={`theme-module-wrapper ${isDark ? 'dark' : ''} min-h-screen flex flex-col`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};
