import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { formatDuration } from '@/lib/gameModes/jigsaw';
import type { GameModeLeaderboardEntry } from '@/lib/gameModes/records';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';

type Props = {
  title: string;
  entries: GameModeLeaderboardEntry[];
};

export function GameModeLeaderboard({ title, entries }: Props) {
  const { colors } = useTheme();

  return (
    <Card padding="lg" style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}14` }]}>
          <Ionicons name="trophy-outline" size={16} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>

      {entries.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          No completions yet. Be the first to set the pace.
        </Text>
      ) : (
        <View style={styles.rows}>
          {entries.map((entry) => (
            <View
              key={`${entry.userId}-${entry.rank}`}
              style={[styles.row, { borderBottomColor: colors.borderLight }]}
            >
              <View style={styles.player}>
                <View style={[styles.rankBubble, { backgroundColor: `${colors.secondary}14` }]}>
                  <Text style={[styles.rankText, { color: colors.secondary }]}>#{entry.rank}</Text>
                </View>
                {entry.avatarUrl ? (
                  <Image source={{ uri: entry.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: `${colors.primary}18` }]}>
                    <Ionicons name="person-outline" size={16} color={colors.primary} />
                  </View>
                )}
                <View style={styles.nameWrap}>
                  <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
                    {entry.displayName || entry.username}
                  </Text>
                  <Text numberOfLines={1} style={[styles.meta, { color: colors.textSecondary }]}>
                    {entry.bestMoves} moves
                  </Text>
                </View>
              </View>
              <Text style={[styles.time, { color: colors.text }]}>{formatDuration(entry.bestMs)}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black,
  },
  empty: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.45,
  },
  rows: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  rankBubble: {
    minWidth: 38,
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  rankText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  meta: {
    marginTop: 2,
    fontSize: fontSize.xs,
  },
  time: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.black,
    marginLeft: spacing.sm,
  },
});
