import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { useTournamentCountdown } from '@/hooks/useTournamentCountdown';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';
import type { Tournament } from '@/lib/types';

type Props = {
  tournament: Tournament;
  onPress: () => void;
};

const STATUS_CONFIG = {
  upcoming: { label: 'Upcoming', icon: 'time-outline' as const, colorKey: 'warning' as const },
  active: { label: 'Live', icon: 'radio-outline' as const, colorKey: 'correct' as const },
  completed: { label: 'Ended', icon: 'checkmark-circle-outline' as const, colorKey: 'textSecondary' as const },
};

export function TournamentCard({ tournament, onPress }: Props) {
  const { colors } = useTheme();
  const countdown = useTournamentCountdown(
    tournament.status === 'upcoming' ? tournament.starts_at : tournament.ends_at,
  );
  const config = STATUS_CONFIG[tournament.status];
  const statusColor = colors[config.colorKey];

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card} padding="md">
        <View style={styles.topRow}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <Ionicons name={config.icon} size={12} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{config.label}</Text>
          </View>
          {tournament.prize_xp > 0 && (
            <View style={[styles.prizeBadge, { backgroundColor: `${colors.warning}12` }]}>
              <Ionicons name="sparkles" size={12} color={colors.warning} />
              <Text style={[styles.prizeText, { color: colors.warning }]}>{tournament.prize_xp} XP</Text>
            </View>
          )}
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{tournament.title}</Text>
        {tournament.description ? (
          <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>{tournament.description}</Text>
        ) : null}
        <View style={styles.bottomRow}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              {tournament.participant_count}/{tournament.max_participants}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>{countdown.formatted}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.typeBadge, { color: colors.primary }]}>{tournament.type}</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm, borderRadius: borderRadius.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusText: { fontSize: 10, fontWeight: fontWeight.bold },
  prizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  prizeText: { fontSize: 10, fontWeight: fontWeight.bold },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 2 },
  desc: { fontSize: fontSize.sm, marginBottom: spacing.xs },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: fontSize.xs },
  typeBadge: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, textTransform: 'capitalize' },
});
