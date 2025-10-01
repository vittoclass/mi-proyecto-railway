'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
// CORRECCIÓN: Se importa 'ThemeProviderProps' directamente desde 'next-themes', no desde la subcarpeta.
import { type ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

