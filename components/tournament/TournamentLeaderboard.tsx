import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';
import type { TournamentParticipant } from '@/lib/types';

type ParticipantWithProfile = TournamentParticipant & { username?: string; display_name?: string };

type Props = {
  participants: ParticipantWithProfile[];
  currentUserId?: string;
};

export function TournamentLeaderboard({ participants, currentUserId }: Props) {
  const { colors } = useTheme();

  function getName(p: ParticipantWithProfile) {
    return p.display_name || p.username || `Player ${p.user_id.slice(0, 6)}`;
  }

  function getRankColor(rank: number) {
    if (rank === 1) return '#f59e0b';
    if (rank === 2) return '#94a3b8';
    if (rank === 3) return '#f97316';
    return colors.textTertiary;
  }

  return (
    <View style={styles.container}>
      {participants.map((p, idx) => {
        const rank = idx + 1;
        const isMe = p.user_id === currentUserId;
        const rankColor = getRankColor(rank);

        return (
          <View
            key={p.id}
            style={[
              styles.row,
              {
                backgroundColor: isMe ? `${colors.primary}08` : idx % 2 === 0 ? colors.surface : colors.surfaceVariant,
                borderColor: isMe ? `${colors.primary}30` : colors.borderLight,
              },
            ]}
          >
            <View style={[styles.rankBadge, { backgroundColor: `${rankColor}18` }]}>
              {rank <= 3 ? (
                <Ionicons name={rank === 1 ? 'trophy' : 'medal'} size={14} color={rankColor} />
              ) : (
                <Text style={[styles.rankText, { color: rankColor }]}>#{rank}</Text>
              )}
            </View>
            <View style={styles.nameWrap}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {getName(p)}{isMe ? ' (You)' : ''}
              </Text>
              <Text style={[styles.rounds, { color: colors.textTertiary }]}>
                {p.rounds_completed} rounds
              </Text>
            </View>
            <Text style={[styles.score, { color: rank <= 3 ? rankColor : colors.text }]}>{p.total_score}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  rounds: { fontSize: fontSize.xs, marginTop: 1 },
  score: { fontSize: fontSize.base, fontWeight: fontWeight.black },
});
