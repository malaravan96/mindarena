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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { todayKey } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { getTopTeams } from '@/lib/teams';
import { listTournaments } from '@/lib/tournaments';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { Team, Tournament } from '@/lib/types';

type TimeFilter = 'today' | 'week' | 'all';
type BoardTab = 'players' | 'teams' | 'tournaments';

type Row = {
  user_id: string;
  ms_taken: number;
  created_at: string;
  profiles: { username: string | null; display_name: string | null } | null;
};

type Attempt = {
  user_id: string;
  ms_taken: number;
  created_at: string;
};

const filterLabels: { key: TimeFilter; label: string; hint: string }[] = [
  { key: 'today', label: 'Today', hint: 'Daily sprint' },
  { key: 'week', label: 'Week', hint: 'Last 7 days' },
  { key: 'all', label: 'All Time', hint: 'Hall of fame' },
];

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
  const [boardTab, setBoardTab] = useState<BoardTab>('players');
  const [topTeams, setTopTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const activeFilter = filterLabels.find((f) => f.key === timeFilter) ?? filterLabels[0];
  const topThree = rows.slice(0, 3);
  const others = rows.slice(3);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (boardTab === 'players') loadLeaderboard();
    else if (boardTab === 'teams') loadTeams();
    else if (boardTab === 'tournaments') loadTournaments();
  }, [dayKey, timeFilter, boardTab]);

  useEffect(() => {
    computeUserRank(rows);
  }, [rows, currentUserId]);

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
      setPuzzleId(timeFilter === 'today' ? null : timeFilter);
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

    setRows(await attachProfiles((data ?? []) as Attempt[]));
  }

  async function loadWeekLeaderboard() {
    setPuzzleId('week');
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('attempts')
      .select('user_id, ms_taken, created_at')
      .eq('is_correct', true)
      .gte('created_at', weekAgo.toISOString())
      .order('ms_taken', { ascending: true })
      .limit(140);

    if (error) throw error;

    setRows(await attachProfiles(deduplicateBest((data ?? []) as Attempt[])));
  }

  async function loadAllTimeLeaderboard() {
    setPuzzleId('all');

    const { data, error } = await supabase
      .from('attempts')
      .select('user_id, ms_taken, created_at')
      .eq('is_correct', true)
      .order('ms_taken', { ascending: true })
      .limit(220);

    if (error) throw error;

    setRows(await attachProfiles(deduplicateBest((data ?? []) as Attempt[])));
  }

  function deduplicateBest(attempts: Attempt[]): Attempt[] {
    const best: Record<string, Attempt> = {};

    for (const a of attempts) {
      if (!best[a.user_id] || a.ms_taken < best[a.user_id].ms_taken) {
        best[a.user_id] = a;
      }
    }

    return Object.values(best).sort((a, b) => a.ms_taken - b.ms_taken);
  }

  async function attachProfiles(attempts: Attempt[]): Promise<Row[]> {
    const userIds = [...new Set(attempts.map((a) => a.user_id))];
    const profilesMap: Record<string, { username: string | null; display_name: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', userIds);

      for (const p of profilesData ?? []) {
        profilesMap[p.id] = { username: p.username, display_name: p.display_name };
      }
    }

    return attempts.map((a) => ({
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
      return;
    }

    setUserRankInfo(null);
  }

  async function onRefresh() {
    setRefreshing(true);
    if (boardTab === 'players') await loadLeaderboard();
    else if (boardTab === 'teams') await loadTeams();
    else if (boardTab === 'tournaments') await loadTournaments();
    setRefreshing(false);
  }

  async function loadTeams() {
    setLoading(true);
    try {
      const teams = await getTopTeams(50);
      setTopTeams(teams);
    } catch (e) {
      console.error('Teams leaderboard error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadTournaments() {
    setLoading(true);
    try {
      const data = await listTournaments();
      setTournaments(data);
    } catch (e) {
      console.error('Tournaments error:', e);
    } finally {
      setLoading(false);
    }
  }

  function getDisplayName(row: Row) {
    return row.profiles?.display_name || row.profiles?.username || `User ${row.user_id.slice(0, 6)}`;
  }

  function getRankIcon(rank: number): React.ComponentProps<typeof Ionicons>['name'] {
    if (rank === 1) return 'trophy';
    if (rank === 2) return 'medal';
    if (rank === 3) return 'ribbon';
    return 'ellipse';
  }

  function getRankColor(rank: number) {
    if (rank === 1) return '#f59e0b';
    if (rank === 2) return '#94a3b8';
    if (rank === 3) return '#f97316';
    return colors.textTertiary;
  }

  const fastest = rows[0] ? `${(rows[0].ms_taken / 1000).toFixed(2)}s` : '-';
  const average = rows.length
    ? `${(rows.reduce((sum, item) => sum + item.ms_taken, 0) / rows.length / 1000).toFixed(2)}s`
    : '-';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.backgroundLayer} pointerEvents="none">
        <View style={[styles.bgOrbTop, { backgroundColor: `${colors.primary}18` }]} />
        <View style={[styles.bgOrbBottom, { backgroundColor: `${colors.secondary}14` }]} />
      </View>

      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Leaderboard</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Rankings update in real time</Text>
      </View>

      <View style={styles.boardTabRow}>
        {([
          { key: 'players' as BoardTab, label: 'Players', icon: 'person-outline' as const },
          { key: 'teams' as BoardTab, label: 'Teams', icon: 'people-outline' as const },
          { key: 'tournaments' as BoardTab, label: 'Tourneys', icon: 'trophy-outline' as const },
        ]).map((t) => {
          const active = boardTab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setBoardTab(t.key)}
              style={[
                styles.boardTabBtn,
                {
                  borderColor: active ? `${colors.primary}40` : colors.border,
                  backgroundColor: active ? `${colors.primary}15` : colors.surface,
                },
              ]}
            >
              <Ionicons name={t.icon} size={13} color={active ? colors.primary : colors.textSecondary} />
              <Text style={[styles.boardTabLabel, { color: active ? colors.primary : colors.text }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {boardTab === 'players' && (
        <View style={styles.filterRow}>
          {filterLabels.map((f) => {
            const active = timeFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setTimeFilter(f.key)}
                style={[
                  styles.filterTab,
                  {
                    borderColor: active ? `${colors.primary}40` : colors.border,
                    backgroundColor: active ? `${colors.primary}15` : colors.surface,
                  },
                ]}
              >
                <Text style={[styles.filterLabel, { color: active ? colors.primary : colors.text }]}>{f.label}</Text>
                <Text style={[styles.filterHint, { color: active ? colors.primary : colors.textSecondary }]}>
                  {f.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {boardTab === 'players' && (
            <>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroGlow} />
                <View style={styles.heroRow}>
                  <View>
                    <Text style={styles.heroEyebrow}>{activeFilter.label}</Text>
                    <Text style={styles.heroTitle}>Fastest Minds</Text>
                  </View>
                  <View style={styles.heroTag}>
                    <Ionicons name="sparkles-outline" size={14} color="#fff" />
                    <Text style={styles.heroTagText}>{rows.length} ranked</Text>
                  </View>
                </View>
                <Text style={styles.heroSubtitle}>Compete for speed, precision, and consistency.</Text>
                <View style={styles.heroStatsRow}>
                  <View style={styles.heroStatPill}>
                    <Text style={styles.heroStatValue}>{fastest}</Text>
                    <Text style={styles.heroStatLabel}>Best time</Text>
                  </View>
                  <View style={styles.heroStatPill}>
                    <Text style={styles.heroStatValue}>{average}</Text>
                    <Text style={styles.heroStatLabel}>Average</Text>
                  </View>
                </View>
              </LinearGradient>

              {userRankInfo && (
                <Card style={styles.myRankCard} padding="md">
                  <View style={styles.myRankRow}>
                    <View>
                      <Text style={[styles.myRankLabel, { color: colors.textSecondary }]}>Your current position</Text>
                      <Text style={[styles.myRankValue, { color: colors.text }]}>#{userRankInfo.rank}</Text>
                    </View>
                    <View style={[styles.myRankTimePill, { backgroundColor: `${colors.primary}15` }]}>
                      <Ionicons name="time-outline" size={14} color={colors.primary} />
                      <Text style={[styles.myRankTime, { color: colors.primary }]}>
                        {(userRankInfo.time / 1000).toFixed(2)}s
                      </Text>
                    </View>
                  </View>
                </Card>
              )}

              {!puzzleId ? (
                <Card style={styles.emptyCard}>
                  <View style={[styles.emptyIcon, { backgroundColor: `${colors.warning}18` }]}>
                    <Ionicons name="calendar-outline" size={28} color={colors.warning} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No puzzle available yet</Text>
                  <Text style={[styles.emptyMsg, { color: colors.textSecondary }]}>
                    Come back later today when the next challenge goes live.
                  </Text>
                </Card>
              ) : rows.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}18` }]}>
                    <Ionicons name="flag-outline" size={28} color={colors.primary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No scores yet</Text>
                  <Text style={[styles.emptyMsg, { color: colors.textSecondary }]}>Be the first to set the benchmark.</Text>
                  <Button title="Solve Now" onPress={() => router.push('/')} variant="gradient" fullWidth style={{ marginTop: spacing.md }} />
                </Card>
              ) : (
                <>
                  <View style={styles.kpiGrid}>
                    <Card style={styles.kpiCard} padding="md">
                      <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Participants</Text>
                      <Text style={[styles.kpiValue, { color: colors.text }]}>{rows.length}</Text>
                    </Card>
                    <Card style={styles.kpiCard} padding="md">
                      <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Fastest</Text>
                      <Text style={[styles.kpiValue, { color: colors.text }]}>{fastest}</Text>
                    </Card>
                    <Card style={styles.kpiCard} padding="md">
                      <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Average</Text>
                      <Text style={[styles.kpiValue, { color: colors.text }]}>{average}</Text>
                    </Card>
                  </View>

                  <Card style={styles.podiumCard} padding="lg">
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Top Performers</Text>
                    {topThree.map((row, idx) => {
                      const rank = idx + 1;
                      const isMe = row.user_id === currentUserId;
                      return (
                        <View
                          key={`top-${row.user_id}-${rank}`}
                          style={[
                            styles.podiumRow,
                            {
                              borderColor: rank === 1 ? `${getRankColor(rank)}60` : colors.border,
                              backgroundColor: rank === 1 ? `${getRankColor(rank)}14` : colors.surface,
                            },
                          ]}
                        >
                          <View style={[styles.rankIconWrap, { backgroundColor: `${getRankColor(rank)}18` }]}>
                            <Ionicons name={getRankIcon(rank)} size={16} color={getRankColor(rank)} />
                          </View>
                          <View style={styles.nameWrap}>
                            <Text style={[styles.rowName, { color: colors.text }]}>
                              {getDisplayName(row)}{isMe ? ' (You)' : ''}
                            </Text>
                            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>Rank #{rank}</Text>
                          </View>
                          <Text style={[styles.rowTime, { color: getRankColor(rank) }]}>{(row.ms_taken / 1000).toFixed(2)}s</Text>
                        </View>
                      );
                    })}
                  </Card>

                  <Card style={styles.boardCard} padding="lg">
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Full Ranking</Text>
                    {rows.map((row, idx) => {
                      const rank = idx + 1;
                      const isMe = row.user_id === currentUserId;
                      const emphasize = rank <= 3;

                      return (
                        <View
                          key={`${row.user_id}-${idx}`}
                          style={[
                            styles.listRow,
                            {
                              backgroundColor: emphasize ? `${colors.primary}08` : idx % 2 === 0 ? colors.surface : colors.surfaceVariant,
                              borderColor: emphasize ? `${colors.primary}20` : colors.borderLight,
                            },
                          ]}
                        >
                          <View style={[styles.rankPill, { backgroundColor: emphasize ? `${colors.primary}18` : colors.surfaceVariant }]}>
                            <Text style={[styles.rankPillText, { color: emphasize ? colors.primary : colors.textSecondary }]}>#{rank}</Text>
                          </View>
                          <View style={styles.nameWrap}>
                            <Text style={[styles.rowName, { color: colors.text }]}>
                              {getDisplayName(row)}{isMe ? ' (You)' : ''}
                            </Text>
                          </View>
                          <Text style={[styles.rowTime, { color: colors.text }]}>{(row.ms_taken / 1000).toFixed(2)}s</Text>
                        </View>
                      );
                    })}
                  </Card>

                  {currentUserId && !rows.some((r) => r.user_id === currentUserId) && (
                    <Card style={styles.ctaCard} padding="md">
                      <Text style={[styles.ctaText, { color: colors.textSecondary }]}>You are not on this board yet. Solve a puzzle to join the rankings.</Text>
                      {timeFilter === 'today' && (
                        <Button title="Open Today's Puzzle" onPress={() => router.push('/')} variant="outline" fullWidth style={{ marginTop: spacing.sm }} />
                      )}
                    </Card>
                  )}

                  {others.length > 0 && (
                    <Text style={[styles.footerHint, { color: colors.textTertiary }]}>Showing top {rows.length} results.</Text>
                  )}
                </>
              )}
            </>
          )}

          {boardTab === 'teams' && (
            <>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroGlow} />
                <Text style={styles.heroEyebrow}>Teams</Text>
                <Text style={styles.heroTitle}>Team Rankings</Text>
                <Text style={styles.heroSubtitle}>{topTeams.length} teams competing</Text>
              </LinearGradient>

              {topTeams.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}18` }]}>
                    <Ionicons name="people-outline" size={28} color={colors.primary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No teams yet</Text>
                  <Text style={[styles.emptyMsg, { color: colors.textSecondary }]}>Be the first to create a team!</Text>
                  <Button title="Create Team" onPress={() => router.push('/teams')} variant="gradient" fullWidth style={{ marginTop: spacing.md }} />
                </Card>
              ) : (
                <Card style={styles.boardCard} padding="lg">
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Top Teams</Text>
                  {topTeams.map((team, idx) => {
                    const rank = idx + 1;
                    const emphasize = rank <= 3;
                    return (
                      <Pressable
                        key={team.id}
                        onPress={() => router.push({ pathname: '/team-detail', params: { id: team.id } })}
                        style={[
                          styles.listRow,
                          {
                            backgroundColor: emphasize ? `${colors.primary}08` : idx % 2 === 0 ? colors.surface : colors.surfaceVariant,
                            borderColor: emphasize ? `${colors.primary}20` : colors.borderLight,
                          },
                        ]}
                      >
                        <View style={[styles.rankPill, { backgroundColor: emphasize ? `${colors.primary}18` : colors.surfaceVariant }]}>
                          <Text style={[styles.rankPillText, { color: emphasize ? colors.primary : colors.textSecondary }]}>#{rank}</Text>
                        </View>
                        <View style={styles.nameWrap}>
                          <Text style={[styles.rowName, { color: colors.text }]}>{team.name}</Text>
                          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{team.member_count} members</Text>
                        </View>
                        <Text style={[styles.rowTime, { color: colors.text }]}>{team.total_points} pts</Text>
                      </Pressable>
                    );
                  })}
                </Card>
              )}
            </>
          )}

          {boardTab === 'tournaments' && (
            <>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroGlow} />
                <Text style={styles.heroEyebrow}>Tournaments</Text>
                <Text style={styles.heroTitle}>Competitions</Text>
                <Text style={styles.heroSubtitle}>{tournaments.length} tournaments available</Text>
              </LinearGradient>

              {tournaments.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <View style={[styles.emptyIcon, { backgroundColor: `${colors.warning}18` }]}>
                    <Ionicons name="trophy-outline" size={28} color={colors.warning} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No tournaments</Text>
                  <Text style={[styles.emptyMsg, { color: colors.textSecondary }]}>Check back later for upcoming tournaments.</Text>
                </Card>
              ) : (
                <Card style={styles.boardCard} padding="lg">
                  <Text style={[styles.cardTitle, { color: colors.text }]}>All Tournaments</Text>
                  {tournaments.map((t) => {
                    const statusColor = t.status === 'active' ? colors.correct : t.status === 'upcoming' ? colors.warning : colors.textTertiary;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => router.push({ pathname: '/tournament-detail', params: { id: t.id } })}
                        style={[styles.listRow, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                      >
                        <View style={[styles.rankPill, { backgroundColor: `${statusColor}18` }]}>
                          <Text style={[styles.rankPillText, { color: statusColor }]}>
                            {t.status === 'active' ? 'LIVE' : t.status === 'upcoming' ? 'SOON' : 'END'}
                          </Text>
                        </View>
                        <View style={styles.nameWrap}>
                          <Text style={[styles.rowName, { color: colors.text }]}>{t.title}</Text>
                          <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                            {t.participant_count}/{t.max_participants} players - {t.prize_xp} XP prize
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                      </Pressable>
                    );
                  })}
                </Card>
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
  backgroundLayer: { ...StyleSheet.absoluteFillObject },
  bgOrbTop: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    top: -95,
    right: -70,
  },
  bgOrbBottom: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: 110,
    left: -90,
  },

  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  headerSubtitle: { fontSize: fontSize.sm, marginTop: 2 },

  boardTabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  boardTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  boardTabLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  filterTab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  filterLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  filterHint: { fontSize: fontSize.xs, marginTop: 2 },

  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSize.base, fontWeight: fontWeight.medium },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    alignSelf: 'center',
    width: '100%',
  },

  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    top: -70,
    right: -50,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#fff',
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.black,
    marginTop: 2,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  heroTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  heroTagText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  heroStatsRow: { flexDirection: 'row', gap: spacing.sm },
  heroStatPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  heroStatValue: { color: '#fff', fontSize: fontSize.lg, fontWeight: fontWeight.black },
  heroStatLabel: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.xs },

  myRankCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
  },
  myRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  myRankLabel: { fontSize: fontSize.sm },
  myRankValue: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, marginTop: 2 },
  myRankTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  myRankTime: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
    marginBottom: spacing.xs,
  },
  emptyMsg: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    maxWidth: 300,
  },

  kpiGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kpiCard: { flex: 1, borderRadius: borderRadius.lg },
  kpiLabel: { fontSize: fontSize.xs, marginBottom: 4 },
  kpiValue: { fontSize: fontSize.xl, fontWeight: fontWeight.black },

  podiumCard: { marginBottom: spacing.md, borderRadius: borderRadius.xl },
  boardCard: { marginBottom: spacing.md, borderRadius: borderRadius.xl },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: spacing.md },

  podiumRow: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  listRow: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  rankIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rankPill: {
    minWidth: 44,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rankPillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  nameWrap: { flex: 1, minWidth: 0 },
  rowName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  rowSub: { fontSize: fontSize.xs, marginTop: 2 },
  rowTime: { fontSize: fontSize.base, fontWeight: fontWeight.black, marginLeft: spacing.sm },

  ctaCard: { marginBottom: spacing.sm, borderRadius: borderRadius.lg },
  ctaText: { fontSize: fontSize.sm, textAlign: 'center' },

  footerHint: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});
