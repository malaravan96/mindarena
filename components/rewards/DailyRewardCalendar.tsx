import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

type DayInfo = {
  day: number;
  xp: number;
  claimed: boolean;
  isToday: boolean;
  locked: boolean;
};

type Props = {
  calendar: DayInfo[];
  onClaim: () => void;
  claimable: boolean;
};

export function DailyRewardCalendar({ calendar, onClaim, claimable }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="gift-outline" size={18} color={colors.primary} />
        <Text style={[styles.headerText, { color: colors.text }]}>Daily Rewards</Text>
      </View>
      <View style={styles.grid}>
        {calendar.map((day) => (
          <Pressable
            key={day.day}
            onPress={day.isToday && claimable ? onClaim : undefined}
            style={[
              styles.dayCell,
              {
                backgroundColor: day.claimed
                  ? `${colors.correct}12`
                  : day.isToday
                    ? `${colors.primary}12`
                    : colors.surfaceVariant,
                borderColor: day.isToday
                  ? colors.primary
                  : day.claimed
                    ? `${colors.correct}40`
                    : colors.border,
                opacity: day.locked ? 0.5 : 1,
              },
            ]}
          >
            <Text style={[styles.dayLabel, { color: day.claimed ? colors.correct : day.isToday ? colors.primary : colors.textSecondary }]}>
              Day {day.day}
            </Text>
            {day.claimed ? (
              <Ionicons name="checkmark-circle" size={20} color={colors.correct} />
            ) : (
              <Text style={[styles.xpText, { color: day.isToday ? colors.primary : colors.textSecondary }]}>
                +{day.xp}
              </Text>
            )}
            {day.isToday && !day.claimed && (
              <Text style={[styles.claimHint, { color: colors.primary }]}>Tap!</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerText: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  grid: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  dayCell: {
    flex: 1,
    minWidth: 42,
    padding: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  dayLabel: { fontSize: 10, fontWeight: fontWeight.semibold },
  xpText: { fontSize: fontSize.xs, fontWeight: fontWeight.black },
  claimHint: { fontSize: 9, fontWeight: fontWeight.bold },
});
