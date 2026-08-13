import { useEffect, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';

export interface ThreeThemePalette {
  primary: string;
  chart2: string;
  chart3: string;
  foreground: string;
  background: string;
}

const FALLBACK: ThreeThemePalette = {
  primary: '#c8903f',
  chart2: '#4bab9e',
  chart3: '#6e93c9',
  foreground: '#e9e4d8',
  background: '#0b1119',
};

function readVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function readPalette(): ThreeThemePalette {
  return {
    primary: readVar('--primary', FALLBACK.primary),
    chart2: readVar('--chart-2', FALLBACK.chart2),
    chart3: readVar('--chart-3', FALLBACK.chart3),
    foreground: readVar('--foreground', FALLBACK.foreground),
    background: readVar('--background', FALLBACK.background),
  };
}

/**
 * Reads the active theme's CSS color tokens (--primary/--chart-2/--chart-3/...)
 * for use as Three.js material colors, so every 3D scene stays in sync with
 * the app's 4-theme system (dark/parchment/onyx/sienna) instead of a parallel
 * hardcoded palette. Re-reads on theme change via a rAF, since ThemeContext
 * applies the `data-theme` attribute in its own effect.
 */
export function useThreeThemePalette(): ThreeThemePalette {
  const { theme } = useTheme();
  const [palette, setPalette] = useState<ThreeThemePalette>(FALLBACK);

  useEffect(() => {
    setPalette(readPalette());
    const raf = requestAnimationFrame(() => setPalette(readPalette()));
    return () => cancelAnimationFrame(raf);
  }, [theme]);

  return palette;
}
