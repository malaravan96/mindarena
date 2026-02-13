import { Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

// Breakpoints for responsive design
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
};

export const isTablet = width >= BREAKPOINTS.tablet;
export const isDesktop = width >= BREAKPOINTS.desktop;
export const isMobile = width < BREAKPOINTS.tablet;

// Responsive scaling
export const scale = (size: number) => {
  if (isDesktop) return size * 1.2;
  if (isTablet) return size * 1.1;
  return size;
};

// ── Color Theme System ──────────────────────────────────────────────

export type ColorThemeId =
  | 'indigo-night'
  | 'ocean-breeze'
  | 'sunset-glow'
  | 'forest-green'
  | 'rose-garden'
  | 'midnight-blue'
  | 'lavender-dream'
  | 'crimson-fire'
  | 'golden-amber'
  | 'arctic-frost';

interface ColorThemeAccents {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  gradientStart: string;
  gradientEnd: string;
}

export interface ColorThemeMeta {
  id: ColorThemeId;
  label: string;
  light: ColorThemeAccents;
  dark: ColorThemeAccents;
}

export const colorThemeList: ColorThemeMeta[] = [
  {
    id: 'indigo-night',
    label: 'Indigo Night',
    light: { primary: '#6366f1', primaryDark: '#4f46e5', primaryLight: '#818cf8', secondary: '#8b5cf6', gradientStart: '#6366f1', gradientEnd: '#8b5cf6' },
    dark:  { primary: '#818cf8', primaryDark: '#6366f1', primaryLight: '#a5b4fc', secondary: '#a78bfa', gradientStart: '#6366f1', gradientEnd: '#8b5cf6' },
  },
  {
    id: 'ocean-breeze',
    label: 'Ocean Breeze',
    light: { primary: '#0ea5e9', primaryDark: '#0284c7', primaryLight: '#38bdf8', secondary: '#06b6d4', gradientStart: '#0ea5e9', gradientEnd: '#06b6d4' },
    dark:  { primary: '#38bdf8', primaryDark: '#0ea5e9', primaryLight: '#7dd3fc', secondary: '#22d3ee', gradientStart: '#0ea5e9', gradientEnd: '#06b6d4' },
  },
  {
    id: 'sunset-glow',
    label: 'Sunset Glow',
    light: { primary: '#f97316', primaryDark: '#ea580c', primaryLight: '#fb923c', secondary: '#f43f5e', gradientStart: '#f97316', gradientEnd: '#f43f5e' },
    dark:  { primary: '#fb923c', primaryDark: '#f97316', primaryLight: '#fdba74', secondary: '#fb7185', gradientStart: '#f97316', gradientEnd: '#f43f5e' },
  },
  {
    id: 'forest-green',
    label: 'Forest Green',
    light: { primary: '#10b981', primaryDark: '#059669', primaryLight: '#34d399', secondary: '#14b8a6', gradientStart: '#10b981', gradientEnd: '#14b8a6' },
    dark:  { primary: '#34d399', primaryDark: '#10b981', primaryLight: '#6ee7b7', secondary: '#2dd4bf', gradientStart: '#10b981', gradientEnd: '#14b8a6' },
  },
  {
    id: 'rose-garden',
    label: 'Rose Garden',
    light: { primary: '#ec4899', primaryDark: '#db2777', primaryLight: '#f472b6', secondary: '#a855f7', gradientStart: '#ec4899', gradientEnd: '#a855f7' },
    dark:  { primary: '#f472b6', primaryDark: '#ec4899', primaryLight: '#f9a8d4', secondary: '#c084fc', gradientStart: '#ec4899', gradientEnd: '#a855f7' },
  },
  {
    id: 'midnight-blue',
    label: 'Midnight Blue',
    light: { primary: '#3b82f6', primaryDark: '#2563eb', primaryLight: '#60a5fa', secondary: '#6366f1', gradientStart: '#3b82f6', gradientEnd: '#6366f1' },
    dark:  { primary: '#60a5fa', primaryDark: '#3b82f6', primaryLight: '#93bbfd', secondary: '#818cf8', gradientStart: '#3b82f6', gradientEnd: '#6366f1' },
  },
  {
    id: 'lavender-dream',
    label: 'Lavender Dream',
    light: { primary: '#a855f7', primaryDark: '#9333ea', primaryLight: '#c084fc', secondary: '#ec4899', gradientStart: '#a855f7', gradientEnd: '#ec4899' },
    dark:  { primary: '#c084fc', primaryDark: '#a855f7', primaryLight: '#d8b4fe', secondary: '#f472b6', gradientStart: '#a855f7', gradientEnd: '#ec4899' },
  },
  {
    id: 'crimson-fire',
    label: 'Crimson Fire',
    light: { primary: '#ef4444', primaryDark: '#dc2626', primaryLight: '#f87171', secondary: '#f97316', gradientStart: '#ef4444', gradientEnd: '#f97316' },
    dark:  { primary: '#f87171', primaryDark: '#ef4444', primaryLight: '#fca5a5', secondary: '#fb923c', gradientStart: '#ef4444', gradientEnd: '#f97316' },
  },
  {
    id: 'golden-amber',
    label: 'Golden Amber',
    light: { primary: '#f59e0b', primaryDark: '#d97706', primaryLight: '#fbbf24', secondary: '#f97316', gradientStart: '#f59e0b', gradientEnd: '#f97316' },
    dark:  { primary: '#fbbf24', primaryDark: '#f59e0b', primaryLight: '#fcd34d', secondary: '#fb923c', gradientStart: '#f59e0b', gradientEnd: '#f97316' },
  },
  {
    id: 'arctic-frost',
    label: 'Arctic Frost',
    light: { primary: '#06b6d4', primaryDark: '#0891b2', primaryLight: '#22d3ee', secondary: '#a855f7', gradientStart: '#06b6d4', gradientEnd: '#a855f7' },
    dark:  { primary: '#22d3ee', primaryDark: '#06b6d4', primaryLight: '#67e8f9', secondary: '#c084fc', gradientStart: '#06b6d4', gradientEnd: '#a855f7' },
  },
];

// ── Base structural colors (independent of color theme) ─────────────

const baseLightColors = {
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',

  background: '#ffffff',
  backgroundSecondary: '#f9fafb',
  surface: '#ffffff',
  surfaceVariant: '#f3f4f6',

  text: '#111827',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',

  border: '#e5e7eb',
  borderLight: '#f3f4f6',

  overlay: 'rgba(0, 0, 0, 0.5)',

  correct: '#10b981',
  wrong: '#ef4444',
};

const baseDarkColors = {
  success: '#34d399',
  error: '#f87171',
  warning: '#fbbf24',

  background: '#0f172a',
  backgroundSecondary: '#1e293b',
  surface: '#1e293b',
  surfaceVariant: '#334155',

  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',

  border: '#334155',
  borderLight: '#1e293b',

  overlay: 'rgba(0, 0, 0, 0.7)',

  correct: '#34d399',
  wrong: '#f87171',
};

export function buildColorPalette(
  colorScheme: 'light' | 'dark',
  themeId: ColorThemeId = 'indigo-night',
) {
  const themeMeta = colorThemeList.find((t) => t.id === themeId) ?? colorThemeList[0];
  const accents = themeMeta[colorScheme];
  const base = colorScheme === 'light' ? baseLightColors : baseDarkColors;
  return { ...base, ...accents };
}

// Keep the legacy `colors` export so existing code still compiles
export const colors = {
  light: buildColorPalette('light', 'indigo-night'),
  dark: buildColorPalette('dark', 'indigo-night'),
};

export const spacing = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(48),
};

export const borderRadius = {
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(24),
  full: 9999,
};

export const fontSize = {
  xs: scale(12),
  sm: scale(14),
  base: scale(16),
  lg: scale(18),
  xl: scale(20),
  '2xl': scale(24),
  '3xl': scale(30),
  '4xl': scale(36),
  '5xl': scale(48),
};

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

export const shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
    },
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    android: {
      elevation: 8,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
  }),
  xl: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
    },
    android: {
      elevation: 12,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
    },
  }),
};

export const layout = {
  maxWidth: isDesktop ? 1200 : isTablet ? 768 : width,
  contentPadding: isDesktop ? spacing.xxl : isTablet ? spacing.xl : spacing.md,
};
