import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type ModeConfig = {
  key: string;
  label: string;
  icon: IconName;
  description: string;
  color?: string;
};

const MODES: ModeConfig[] = [
  { key: 'timed-challenge', label: 'Timed', icon: 'timer-outline', description: 'Race the clock' },
  { key: 'puzzle-streak', label: 'Streak', icon: 'trending-up-outline', description: 'Chain puzzles' },
  { key: 'category-mastery', label: 'Mastery', icon: 'school-outline', description: 'Master each type' },
  { key: 'practice', label: 'Practice', icon: 'book-outline', description: 'Learn freely' },
  { key: 'weekly-challenge', label: 'Weekly', icon: 'calendar-outline', description: '1.5x points' },
  { key: 'tournaments', label: 'Tournaments', icon: 'trophy-outline', description: 'Compete live' },
];

type Props = {
  compact?: boolean;
};

export function ModeSelector({ compact }: Props) {
  const router = useRouter();
  const { colors } = useTheme();

  if (compact) {
    return (
      <View style={styles.compactRow}>
        {MODES.slice(0, 4).map((mode) => (
          <Pressable
            key={mode.key}
            onPress={() => router.push(`/${mode.key}` as any)}
            style={[styles.compactChip, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}25` }]}
          >
            <Ionicons name={mode.icon} size={14} color={colors.primary} />
            <Text style={[styles.compactLabel, { color: colors.primary }]}>{mode.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {MODES.map((mode) => (
        <Pressable
          key={mode.key}
          onPress={() => router.push(`/${mode.key}` as any)}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}12` }]}>
            <Ionicons name={mode.icon} size={20} color={colors.primary} />
          </View>
          <Text style={[styles.label, { color: colors.text }]}>{mode.label}</Text>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>{mode.description}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    width: '47%' as any,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  desc: { fontSize: fontSize.xs },
  compactRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  compactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  compactLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
});
