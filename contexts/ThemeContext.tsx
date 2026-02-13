import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { buildColorPalette, ColorThemeId } from '@/constants/theme';
import { getItem, setItem } from '@/lib/storage';

type Theme = 'light' | 'dark' | 'auto';
type ColorScheme = 'light' | 'dark';

const THEME_KEY = 'mindarena_theme';
const COLOR_THEME_KEY = 'mindarena_color_theme';

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
  colors: ReturnType<typeof buildColorPalette>;
  colorTheme: ColorThemeId;
  setTheme: (theme: Theme) => void;
  setColorTheme: (id: ColorThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme() as ColorScheme;
  const [theme, setThemeState] = useState<Theme>('auto');
  const [colorTheme, setColorThemeState] = useState<ColorThemeId>('indigo-night');

  // Load persisted preferences on mount
  useEffect(() => {
    (async () => {
      const savedTheme = await getItem(THEME_KEY);
      if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto') {
        setThemeState(savedTheme);
      }
      const savedColor = await getItem(COLOR_THEME_KEY);
      if (savedColor) {
        setColorThemeState(savedColor as ColorThemeId);
      }
    })();
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    setItem(THEME_KEY, t);
  }

  function setColorTheme(id: ColorThemeId) {
    setColorThemeState(id);
    setItem(COLOR_THEME_KEY, id);
  }

  const colorScheme: ColorScheme = theme === 'auto' ? systemColorScheme || 'light' : theme;
  const themeColors = buildColorPalette(colorScheme, colorTheme);

  return (
    <ThemeContext.Provider
      value={{ theme, colorScheme, colors: themeColors, colorTheme, setTheme, setColorTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
