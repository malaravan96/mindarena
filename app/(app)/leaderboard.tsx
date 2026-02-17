import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { todayKey } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';

type TimeFilter = 'today' | 'week' | 'all';

type Row = {
  user_id: string;
  ms_taken: number;
  created_at: string;
  profiles: { username: string | null; display_name: string | null } | null;
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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [userRankInfo, setUserRankInfo] = useState<{ rank: number; time: number } | null>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [dayKey, timeFilter]);

  async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data.user?.id ?? null);
  }

  async function loadLeaderboard() {
    setLoading(true);
    try {
      if (timeFilter === 'today') {
        await loadTodayLeaderboard();
      } else if (timeFilter === 'week') {
        await loadWeekLeaderboard();
      } else {
        await loadAllTimeLeaderboard();
      }
    } catch (e: any) {
      console.error('Leaderboard error:', e?.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadTodayLeaderboard() {
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
      .select('user_id, ms_taken, created_at')
      .eq('puzzle_id', puzzle.id)
      .eq('is_correct', true)
      .order('ms_taken', { ascending: true })
      .limit(100);

    if (error) throw error;
    const normalized = await attachProfiles(data ?? []);
    setRows(normalized);
    computeUserRank(normalized);
  }

  async function loadWeekLeaderboard() {
    setPuzzleId('week');
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    const { data, error } = await supabase
      .from('attempts')
      .select('user_id, ms_taken, created_at')
      .eq('is_correct', true)
      .gte('created_at', weekAgoStr)
      .order('ms_taken', { ascending: true })
      .limit(100);

    if (error) throw error;

    // Deduplicate: keep best time per user
    const bestByUser = deduplicateBest(data ?? []);
    const normalized = await attachProfiles(bestByUser);
    setRows(normalized);
    computeUserRank(normalized);
  }

  async function loadAllTimeLeaderboard() {
    setPuzzleId('all');

    const { data, error } = await supabase
      .from('attempts')
      .select('user_id, ms_taken, created_at')
      .eq('is_correct', true)
      .order('ms_taken', { ascending: true })
      .limit(200);

    if (error) throw error;

    const bestByUser = deduplicateBest(data ?? []);
    const normalized = await attachProfiles(bestByUser);
    setRows(normalized);
    computeUserRank(normalized);
  }

  function deduplicateBest(attempts: any[]): any[] {
    const best: Record<string, any> = {};
    for (const a of attempts) {
      if (!best[a.user_id] || a.ms_taken < best[a.user_id].ms_taken) {
        best[a.user_id] = a;
      }
    }
    return Object.values(best).sort((a, b) => a.ms_taken - b.ms_taken);
  }

  async function attachProfiles(attempts: any[]): Promise<Row[]> {
    const userIds = [...new Set(attempts.map((a: any) => a.user_id))];
    let profilesMap: Record<string, { username: string | null; display_name: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', userIds);

      for (const p of profilesData ?? []) {
        profilesMap[p.id] = { username: p.username, display_name: p.display_name };
      }
    }

    return attempts.map((a: any) => ({
      ...a,
      profiles: profilesMap[a.user_id] ?? null,
    }));
  }

  function computeUserRank(data: Row[]) {
    if (!currentUserId) {
      setUserRankInfo(null);
      return;
    }
    const idx = data.findIndex((r) => r.user_id === currentUserId);
    if (idx >= 0) {
      setUserRankInfo({ rank: idx + 1, time: data[idx].ms_taken });
    } else {
      setUserRankInfo(null);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  }

  const getRankDisplay = (rank: number) => {
    switch (rank) {
      case 1: return { emoji: '🥇', color: '#f59e0b' };
      case 2: return { emoji: '🥈', color: '#94a3b8' };
      case 3: return { emoji: '🥉', color: '#cd7f32' };
      default: return { emoji: null, color: colors.textSecondary };
    }
  };

  const filterLabels: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Leaderboard</Text>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterRow, { backgroundColor: colors.surface }]}>
        {filterLabels.map((f) => (
          <Pressable
            key={f.key}
            style={[
              styles.filterTab,
              {
                backgroundColor: timeFilter === f.key ? colors.primary : 'transparent',
                borderColor: timeFilter === f.key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setTimeFilter(f.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: timeFilter === f.key ? '#fff' : colors.textSecondary },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading leaderboard...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* User Rank Card */}
          {userRankInfo && (
            <Card style={styles.userRankCard} padding="lg">
              <Text style={[styles.userRankLabel, { color: colors.textSecondary }]}>Your Position</Text>
              <View style={styles.userRankRow}>
                <Text style={[styles.userRankValue, { color: colors.primary }]}>#{userRankInfo.rank}</Text>
                <View style={[styles.userRankDivider, { backgroundColor: colors.border }]} />
                <Text style={[styles.userRankTime, { color: colors.success }]}>
                  {(userRankInfo.time / 1000).toFixed(2)}s
                </Text>
              </View>
            </Card>
          )}

          {!puzzleId ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Puzzle Today</Text>
              <Text style={[styles.emptyMsg, { color: colors.textSecondary }]}>
                Check back soon for today's puzzle!
              </Text>
            </Card>
          ) : rows.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🏆</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Be the First!</Text>
              <Text style={[styles.emptyMsg, { color: colors.textSecondary }]}>
                No one has solved {timeFilter === 'today' ? "today's puzzle" : 'any puzzles'} yet. Claim the top spot!
              </Text>
            </Card>
          ) : (
            <>
              {/* Stats */}
              <Card style={styles.statsCard}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, { color: colors.primary }]}>{rows.length}</Text>
                    <Text style={[styles.statLbl, { color: colors.textSecondary }]}>Solvers</Text>
                  </View>
                  <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, { color: colors.success }]}>
                      {(rows[0]?.ms_taken / 1000).toFixed(1)}s
                    </Text>
                    <Text style={[styles.statLbl, { color: colors.textSecondary }]}>Fastest</Text>
                  </View>
                  <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, { color: colors.secondary }]}>
                      {(rows.reduce((s, r) => s + r.ms_taken, 0) / rows.length / 1000).toFixed(1)}s
                    </Text>
                    <Text style={[styles.statLbl, { color: colors.textSecondary }]}>Average</Text>
                  </View>
                </View>
              </Card>

              {/* Rows */}
              <Card style={styles.boardCard}>
                <Text style={[styles.boardTitle, { color: colors.text }]}>Top Performers</Text>

                {rows.map((row, idx) => {
                  const rank = idx + 1;
                  const name =
                    row.profiles?.display_name ||
                    row.profiles?.username ||
                    `User ${row.user_id.slice(0, 6)}`;
                  const time = (row.ms_taken / 1000).toFixed(2);
                  const isMe = row.user_id === currentUserId;
                  const rd = getRankDisplay(rank);

                  return (
                    <View
                      key={`${row.user_id}-${idx}`}
                      style={[
                        styles.row,
                        {
                          backgroundColor: isMe
                            ? `${colors.primary}10`
                            : idx % 2 === 0
                            ? colors.background
                            : colors.surfaceVariant,
                          borderLeftWidth: isMe ? 3 : 0,
                          borderLeftColor: colors.primary,
                        },
                      ]}
                    >
                      <View style={styles.rankWrap}>
                        {rd.emoji ? (
                          <Text style={styles.rankEmoji}>{rd.emoji}</Text>
                        ) : (
                          <View style={[styles.rankCircle, { backgroundColor: colors.surfaceVariant }]}>
                            <Text style={[styles.rankNum, { color: rd.color }]}>#{rank}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.userCol}>
                        <Text
                          style={[
                            styles.userName,
                            { color: colors.text, fontWeight: isMe ? fontWeight.black : fontWeight.semibold },
                          ]}
                          numberOfLines={1}
                        >
                          {name}{isMe ? ' (You)' : ''}
                        </Text>
                      </View>
                      <Text style={[styles.timeVal, { color: rank <= 3 ? rd.color : colors.text }]}>
                        {time}s
                      </Text>
                    </View>
                  );
                })}
              </Card>

              {currentUserId && !rows.some((r) => r.user_id === currentUserId) && (
                <View style={[styles.notInList, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.notInListText, { color: colors.textSecondary }]}>
                    You haven't solved {timeFilter === 'today' ? "today's puzzle" : 'any puzzles in this period'} yet.
                  </Text>
                  {timeFilter === 'today' && (
                    <Button
                      title="Solve Now"
                      onPress={() => router.push('/')}
                      variant="outline"
                      size="sm"
                      fullWidth
                      style={{ marginTop: spacing.sm }}
                    />
                  )}
                </View>
              )}
            </>
          )}

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSize.base, fontWeight: fontWeight.medium },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterTabText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },

  // User Rank Card
  userRankCard: { marginBottom: spacing.md, alignItems: 'center' },
  userRankLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.xs },
  userRankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  userRankValue: { fontSize: fontSize['3xl'], fontWeight: fontWeight.black },
  userRankDivider: { width: 1, height: 28 },
  userRankTime: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },

  statsCard: { marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  statLbl: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, marginTop: spacing.xs },
  statDiv: { width: 1, height: 36 },

  boardCard: { marginBottom: spacing.md },
  boardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: 2,
  },
  rankWrap: { width: 44, alignItems: 'center' },
  rankEmoji: { fontSize: fontSize.xl },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNum: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  userCol: { flex: 1, marginLeft: spacing.sm },
  userName: { fontSize: fontSize.base },
  timeVal: { fontSize: fontSize.base, fontWeight: fontWeight.black, marginLeft: spacing.sm },

  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyEmoji: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, marginBottom: spacing.sm, textAlign: 'center' },
  emptyMsg: { fontSize: fontSize.base, textAlign: 'center', maxWidth: 300 },

  notInList: { padding: spacing.md, borderRadius: borderRadius.md, marginBottom: spacing.md },
  notInListText: { fontSize: fontSize.sm, textAlign: 'center' },
});
