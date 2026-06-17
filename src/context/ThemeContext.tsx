/**
 * ThemeContext — user-selectable color themes.
 *
 * Applies the chosen theme to <html> via a `data-theme` attribute (the actual
 * palettes live in index.css as token overrides) and persists the choice to
 * localStorage. Also toggles the `.dark` class and `color-scheme` so native
 * controls (scrollbars, <select> popups) render with correct contrast.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'dark' | 'light' | 'noir' | 'claude';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  hint: string;
  dark: boolean;
  swatch: [string, string]; // [background, accent] for the switcher preview
}

export const THEMES: ThemeMeta[] = [
  { id: 'dark', label: 'Emerald Dark', hint: 'Default', dark: true, swatch: ['#0a0c11', '#10b981'] },
  { id: 'light', label: 'Light', hint: 'Bright & clean', dark: false, swatch: ['#f7f8fa', '#0e9f6e'] },
  { id: 'noir', label: 'Noir', hint: 'Black & white', dark: true, swatch: ['#000000', '#fafafa'] },
  { id: 'claude', label: 'Claude', hint: 'Warm clay', dark: false, swatch: ['#f0eee6', '#c96442'] },
];

const STORAGE_KEY = 'nl2sql_theme';

function applyTheme(theme: ThemeId): void {
  const meta = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', meta.dark);
  root.style.colorScheme = meta.dark ? 'dark' : 'light';
}

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themes: ThemeMeta[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as ThemeId | null;
    return stored && THEMES.some((t) => t.id === stored) ? stored : 'dark';
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
