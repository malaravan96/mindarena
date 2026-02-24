import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  category: string;
  icon: IconName;
  level: number;
  progress: number;
  puzzlesCompleted: number;
  maxLevel?: number;
};

const LEVEL_COLORS = ['#6b7280', '#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444'];

export function CategoryMasteryCard({ category, icon, level, progress, puzzlesCompleted, maxLevel = 5 }: Props) {
  const { colors } = useTheme();
  const levelColor = LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)];
  const isMastered = level >= maxLevel;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: `${levelColor}30` }]}>
      <View style={[styles.iconWrap, { backgroundColor: `${levelColor}15` }]}>
        <Ionicons name={icon} size={20} color={levelColor} />
      </View>
      <Text style={[styles.category, { color: colors.text }]}>{category}</Text>
      <View style={styles.levelRow}>
        <Text style={[styles.levelLabel, { color: colors.textSecondary }]}>Lv.</Text>
        <Text style={[styles.levelValue, { color: levelColor }]}>{level}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: `${levelColor}12` }]}>
        <View style={[styles.fill, { width: `${Math.max(progress * 100, 4)}%`, backgroundColor: levelColor }]} />
      </View>
      <Text style={[styles.count, { color: colors.textTertiary }]}>
        {isMastered ? 'Mastered!' : `${puzzlesCompleted} solved`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%' as any,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  category: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  levelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  levelLabel: { fontSize: fontSize.xs },
  levelValue: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  track: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  count: { fontSize: 10, fontWeight: fontWeight.medium },
});
