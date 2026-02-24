import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTournamentCountdown } from '@/hooks/useTournamentCountdown';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

type Props = {
  targetDate: string;
  label?: string;
};

export function CountdownTimer({ targetDate, label }: Props) {
  const { colors } = useTheme();
  const { days, hours, minutes, seconds, isExpired } = useTournamentCountdown(targetDate);

  if (isExpired) {
    return (
      <View style={[styles.container, { backgroundColor: `${colors.wrong}12` }]}>
        <Text style={[styles.label, { color: colors.wrong }]}>{label ?? 'Ended'}</Text>
      </View>
    );
  }

  const units = [
    { value: days, label: 'D' },
    { value: hours, label: 'H' },
    { value: minutes, label: 'M' },
    { value: seconds, label: 'S' },
  ].filter((u, i) => days > 0 || i > 0); // Hide days if 0

  return (
    <View style={[styles.container, { backgroundColor: `${colors.primary}10` }]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <View style={styles.unitsRow}>
        {units.map((u) => (
          <View key={u.label} style={[styles.unit, { backgroundColor: `${colors.primary}15` }]}>
            <Text style={[styles.unitValue, { color: colors.primary }]}>
              {String(u.value).padStart(2, '0')}
            </Text>
            <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>{u.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  unitsRow: { flexDirection: 'row', gap: spacing.xs },
  unit: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  unitValue: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  unitLabel: { fontSize: 10, fontWeight: fontWeight.medium },
});
