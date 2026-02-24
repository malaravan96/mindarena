import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

type Props = {
  level: number;
  xp: number;
  xpForCurrent: number;
  xpForNext: number;
  progress: number;
  title: string;
  compact?: boolean;
};

export function XPProgressBar({ level, xp, xpForNext, progress, title, compact }: Props) {
  const { colors } = useTheme();
  const xpRemaining = xpForNext - xp;

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <View style={[styles.levelBadge, { backgroundColor: `${colors.primary}20` }]}>
          <Text style={[styles.levelText, { color: colors.primary }]}>{level}</Text>
        </View>
        <View style={styles.compactBarWrap}>
          <View style={[styles.barTrack, { backgroundColor: `${colors.primary}15` }]}>
            <View style={[styles.barFill, { width: `${Math.max(progress * 100, 2)}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.levelRow}>
          <View style={[styles.levelBadgeLg, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="shield-half-outline" size={14} color={colors.primary} />
            <Text style={[styles.levelTextLg, { color: colors.primary }]}>Lv. {level}</Text>
          </View>
          <Text style={[styles.titleText, { color: colors.textSecondary }]}>{title}</Text>
        </View>
        <Text style={[styles.xpText, { color: colors.textSecondary }]}>
          {xpRemaining > 0 ? `${xpRemaining} XP to next` : 'MAX'}
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: `${colors.primary}12` }]}>
        <View style={[styles.barFill, { width: `${Math.max(progress * 100, 2)}%`, backgroundColor: colors.primary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  levelBadgeLg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  levelTextLg: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  titleText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  xpText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  compactWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  levelBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: { fontSize: 10, fontWeight: fontWeight.black },
  compactBarWrap: { flex: 1 },
});
