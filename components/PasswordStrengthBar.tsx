import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';

function getStrength(password: string): { level: number; label: string } {
  if (!password) return { level: 0, label: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak' };
  if (score === 2) return { level: 2, label: 'Fair' };
  if (score === 3) return { level: 3, label: 'Good' };
  return { level: 4, label: 'Strong' };
}

const BAR_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];

interface PasswordStrengthBarProps {
  password: string;
}

export function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  const { colors } = useTheme();
  const { level, label } = getStrength(password);

  if (!password) return null;

  const activeColor = BAR_COLORS[level - 1] ?? colors.border;

  return (
    <View style={styles.container}>
      <View style={styles.barRow}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                backgroundColor: i <= level ? activeColor : colors.borderLight,
                borderRadius: borderRadius.xs,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: activeColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  barRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 4,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    minWidth: 48,
    textAlign: 'right',
  },
});
