import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

type Props = {
  timeLeft: number;
  score: number;
  solved: number;
  streak: number;
};

export function TimedChallengeHUD({ timeLeft, score, solved, streak }: Props) {
  const { colors } = useTheme();
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLow = timeLeft <= 30;

  return (
    <View style={[styles.hud, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.stat}>
        <Ionicons name="time-outline" size={16} color={isLow ? colors.wrong : colors.primary} />
        <Text style={[styles.statValue, { color: isLow ? colors.wrong : colors.primary }]}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </Text>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.stat}>
        <Ionicons name="checkmark-circle-outline" size={16} color={colors.correct} />
        <Text style={[styles.statValue, { color: colors.text }]}>{solved}</Text>
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.stat}>
        <Ionicons name="star-outline" size={16} color={colors.warning} />
        <Text style={[styles.statValue, { color: colors.text }]}>{score}</Text>
      </View>
      {streak > 1 && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={[styles.streakBadge, { backgroundColor: `${colors.warning}18` }]}>
            <Ionicons name="flame" size={14} color={colors.warning} />
            <Text style={[styles.streakText, { color: colors.warning }]}>x{streak}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' },
  statValue: { fontSize: fontSize.base, fontWeight: fontWeight.black },
  divider: { width: 1, height: 20 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  streakText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
});
