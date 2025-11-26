import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  isLight: boolean;
  systemTheme: ResolvedTheme;
}

interface ThemeActions {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLightTheme: () => void;
  setDarkTheme: () => void;
  setSystemTheme: () => void;
}

export type ThemeReturn = ThemeState & ThemeActions;

export function useTheme(): ThemeReturn {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as Theme) || 'system';
  });

  const [systemTheme, setSystemThemeState] = useState<ResolvedTheme>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;
  const isDark = resolvedTheme === 'dark';
  const isLight = resolvedTheme === 'light';

  // Update DOM and localStorage when theme changes
  useEffect(() => {
    const root = document.documentElement;
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentSystemTheme = isSystemDark ? 'dark' : 'light';
    
    setSystemThemeState(currentSystemTheme);
    
    // Remove all theme classes first
    root.classList.remove('light', 'dark');
    
    // Add the resolved theme class
    const finalTheme = theme === 'system' ? currentSystemTheme : theme;
    root.classList.add(finalTheme);
    
    // Update localStorage
    localStorage.setItem('theme', theme);
    
    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', finalTheme === 'dark' ? '#020617' : '#f8fafc');
    }
    
    // Update body class for theme-specific styles
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${finalTheme}`);
    
    // Dispatch custom theme change event for other components
    window.dispatchEvent(new CustomEvent('themechange', { 
      detail: { theme: finalTheme, systemTheme: currentSystemTheme } 
    }));
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemThemeState(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Theme action functions
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      if (prev === 'system') {
        return systemTheme === 'dark' ? 'light' : 'dark';
      }
      return prev === 'dark' ? 'light' : 'dark';
    });
  }, [systemTheme]);

  const setLightTheme = useCallback(() => {
    setThemeState('light');
  }, []);

  const setDarkTheme = useCallback(() => {
    setThemeState('dark');
  }, []);

  const setSystemTheme = useCallback(() => {
    setThemeState('system');
  }, []);

  return {
    theme,
    resolvedTheme,
    isDark,
    isLight,
    systemTheme,
    setTheme,
    toggleTheme,
    setLightTheme,
    setDarkTheme,
    setSystemTheme,
  };
}

// Utility hook for theme-aware components
export function useThemeAware() {
  const { resolvedTheme, isDark, isLight } = useTheme();
  
  return {
    theme: resolvedTheme,
    isDark,
    isLight,
    // Convenience functions for conditional styling
    ifDark: <T,>(darkValue: T, lightValue?: T): T | undefined => isDark ? darkValue : lightValue,
    ifLight: <T,>(lightValue: T, darkValue?: T): T | undefined => isLight ? lightValue : darkValue,
  };
}

// Utility function to get current theme without hook (for utility functions)
export function getCurrentTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  
  const savedTheme = localStorage.getItem('theme') as Theme;
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  
  if (savedTheme === 'system' || !savedTheme) {
    return systemTheme;
  }
  
  return savedTheme;
}

// Utility to preload theme (call this early in app initialization)
export function preloadTheme() {
  if (typeof window === 'undefined') return;
  
  const theme = localStorage.getItem('theme') as Theme || 'system';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const finalTheme = theme === 'system' ? systemTheme : theme;
  
  // Apply theme class immediately to prevent flash
  document.documentElement.classList.add(finalTheme);
  document.body.classList.add(`theme-${finalTheme}`);
  
  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', finalTheme === 'dark' ? '#020617' : '#f8fafc');
  }
}
