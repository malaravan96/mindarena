import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { todayKey } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';

type Row = {
  user_id: string;
  ms_taken: number;
  created_at: string;
  profiles?: { display_name: string | null } | null;
};

export default function Leaderboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const dayKey = useMemo(() => todayKey(), []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
    getCurrentUser();
  }, [dayKey]);

  async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data.user?.id ?? null);
  }

  async function loadLeaderboard() {
    setLoading(true);
    try {
      const { data: puzzle, error: pErr } = await supabase
        .from('puzzles')
        .select('id')
        .eq('date_key', dayKey)
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (pErr) throw pErr;
      if (!puzzle) {
        setPuzzleId(null);
        setRows([]);
        return;
      }
      setPuzzleId(puzzle.id);

      const { data, error } = await supabase
        .from('attempts')
        .select('user_id, ms_taken, created_at, profiles(display_name)')
        .eq('puzzle_id', puzzle.id)
        .eq('is_correct', true)
        .order('ms_taken', { ascending: true })
        .limit(100);

      if (error) throw error;
      setRows((data as any) ?? []);
    } catch (e: any) {
      console.error('Leaderboard error:', e?.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  }

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return null;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return '#f59e0b';
      case 2:
        return '#94a3b8';
      case 3:
        return '#cd7f32';
      default:
        return colors.textSecondary;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Leaderboard</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading leaderboard...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Leaderboard</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 800 : undefined }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Date Badge */}
        <View style={styles.dateBadgeContainer}>
          <View style={[styles.dateBadge, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.dateBadgeText, { color: colors.textSecondary }]}>
              🗓️ {dayKey}
            </Text>
          </View>
        </View>

        {!puzzleId ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🎯</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Puzzle Today</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              There's no puzzle available for today yet. Check back soon!
            </Text>
            <Button
              title="Go Back"
              onPress={() => router.back()}
              variant="outline"
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : rows.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Be the First!</Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              No one has solved today's puzzle yet. Solve it now and claim the top spot!
            </Text>
            <Button
              title="Solve Puzzle"
              onPress={() => router.back()}
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : (
          <>
            {/* Stats Card */}
            <Card style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{rows.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Solvers</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.success }]}>
                    {(rows[0]?.ms_taken / 1000).toFixed(1)}s
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Fastest</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.secondary }]}>
                    {(
                      rows.reduce((sum, r) => sum + r.ms_taken, 0) /
                      rows.length /
                      1000
                    ).toFixed(1)}
                    s
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Average</Text>
                </View>
              </View>
            </Card>

            {/* Leaderboard */}
            <Card style={styles.leaderboardCard}>
              <Text style={[styles.leaderboardTitle, { color: colors.text }]}>Top Performers</Text>

              {rows.map((row, idx) => {
                const rank = idx + 1;
                const name = row.profiles?.display_name || `User ${row.user_id.slice(0, 6)}`;
                const time = (row.ms_taken / 1000).toFixed(2);
                const isCurrentUser = row.user_id === currentUserId;
                const rankEmoji = getRankEmoji(rank);
                const rankColor = getRankColor(rank);

                return (
                  <View
                    key={idx}
                    style={[
                      styles.leaderboardRow,
                      {
                        backgroundColor: isCurrentUser
                          ? `${colors.primary}10`
                          : idx % 2 === 0
                          ? colors.background
                          : colors.surfaceVariant,
                        borderLeftWidth: isCurrentUser ? 3 : 0,
                        borderLeftColor: colors.primary,
                      },
                    ]}
                  >
                    <View style={styles.rankContainer}>
                      {rankEmoji ? (
                        <Text style={styles.rankEmoji}>{rankEmoji}</Text>
                      ) : (
                        <View style={[styles.rankBadge, { backgroundColor: colors.surfaceVariant }]}>
                          <Text style={[styles.rankText, { color: rankColor }]}>#{rank}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.userInfo}>
                      <Text
                        style={[
                          styles.userName,
                          {
                            color: colors.text,
                            fontWeight: isCurrentUser ? fontWeight.black : fontWeight.bold,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {name}
                        {isCurrentUser && ' (You)'}
                      </Text>
                      <Text style={[styles.userTime, { color: colors.textTertiary }]}>
                        {new Date(row.created_at).toLocaleTimeString()}
                      </Text>
                    </View>

                    <View style={styles.timeContainer}>
                      <Text
                        style={[
                          styles.timeValue,
                          {
                            color: rank <= 3 ? rankColor : colors.text,
                            fontWeight: fontWeight.black,
                          },
                        ]}
                      >
                        {time}s
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>

            {/* User's Position (if not in top 100) */}
            {currentUserId && !rows.some((r) => r.user_id === currentUserId) && (
              <Card style={styles.yourPositionCard}>
                <View style={{ backgroundColor: colors.surfaceVariant, padding: spacing.md, borderRadius: borderRadius.md }}>
                  <Text style={[styles.yourPositionText, { color: colors.textSecondary }]}>
                    You haven't solved today's puzzle yet or you're not in the top 100.
                  </Text>
                  <Button
                    title="Solve Now"
                    onPress={() => router.back()}
                    variant="outline"
                    size="sm"
                    fullWidth
                    style={{ marginTop: spacing.sm }}
                  />
                </View>
              </Card>
            )}
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: fontSize['2xl'],
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    alignSelf: 'center',
    width: '100%',
  },
  dateBadgeContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  dateBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  statsCard: {
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.black,
  },
  statLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  leaderboardCard: {
    marginBottom: spacing.md,
  },
  leaderboardTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
    marginBottom: spacing.md,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: fontSize['2xl'],
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  userName: {
    fontSize: fontSize.base,
    marginBottom: 2,
  },
  userTime: {
    fontSize: fontSize.xs,
  },
  timeContainer: {
    marginLeft: spacing.sm,
  },
  timeValue: {
    fontSize: fontSize.lg,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.black,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: fontSize.base,
    textAlign: 'center',
    maxWidth: 300,
  },
  yourPositionCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  yourPositionText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
