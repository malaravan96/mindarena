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

export const colors = {
  // Light theme
  light: {
    primary: '#6366f1',
    primaryDark: '#4f46e5',
    primaryLight: '#818cf8',
    secondary: '#8b5cf6',
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

    // Status colors
    correct: '#10b981',
    wrong: '#ef4444',

    // Gradient colors
    gradientStart: '#6366f1',
    gradientEnd: '#8b5cf6',
  },
  // Dark theme
  dark: {
    primary: '#818cf8',
    primaryDark: '#6366f1',
    primaryLight: '#a5b4fc',
    secondary: '#a78bfa',
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

    // Status colors
    correct: '#34d399',
    wrong: '#f87171',

    // Gradient colors
    gradientStart: '#6366f1',
    gradientEnd: '#8b5cf6',
  },
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
