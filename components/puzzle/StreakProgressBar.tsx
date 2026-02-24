import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

type Props = {
  streakLength: number;
  difficulty: string;
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#10b981',
  medium: '#f59e0b',
  hard: '#ef4444',
};

export function StreakProgressBar({ streakLength, difficulty }: Props) {
  const { colors } = useTheme();
  const diffColor = DIFFICULTY_COLORS[difficulty] ?? colors.primary;
  // Progress within difficulty tier: easy(0-4), medium(5-9), hard(10+)
  const tierStart = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 5 : 10;
  const tierSize = difficulty === 'hard' ? 10 : 5;
  const progress = Math.min((streakLength - tierStart) / tierSize, 1);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <View style={styles.streakInfo}>
          <Ionicons name="flame" size={18} color={diffColor} />
          <Text style={[styles.streakCount, { color: colors.text }]}>{streakLength}</Text>
          <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>puzzle streak</Text>
        </View>
        <View style={[styles.diffBadge, { backgroundColor: `${diffColor}18` }]}>
          <Text style={[styles.diffText, { color: diffColor }]}>
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
          </Text>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: `${diffColor}12` }]}>
        <View style={[styles.fill, { width: `${Math.max(progress * 100, 4)}%`, backgroundColor: diffColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  streakCount: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  streakLabel: { fontSize: fontSize.sm },
  diffBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  diffText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
