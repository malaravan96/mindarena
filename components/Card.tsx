import React, { ReactNode } from 'react';
import { StyleSheet, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, shadows, spacing } from '@/constants/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  padding?: keyof typeof spacing;
}

export function Card({ children, style, elevated = true, padding = 'md' }: CardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.lg,
          padding: spacing[padding],
        },
        elevated && shadows.md,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
