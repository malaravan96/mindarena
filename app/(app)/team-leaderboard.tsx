import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { getTopTeams, getUserTeam } from '@/lib/teams';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { Team } from '@/lib/types';

export default function TeamLeaderboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;

      const topTeams = await getTopTeams(50);
      setTeams(topTeams);

      if (uid) {
        const team = await getUserTeam(uid);
        setMyTeam(team);
        if (team) {
          const rank = topTeams.findIndex((t) => t.id === team.id);
          setMyRank(rank >= 0 ? rank + 1 : null);
        }
      }
    } catch (e) {
      console.error('Team leaderboard error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
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

  const topThree = teams.slice(0, 3);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Team Rankings</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Global team leaderboard</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroGlow} />
            <Text style={styles.heroEyebrow}>Teams</Text>
            <Text style={styles.heroTitle}>Top Teams</Text>
            <Text style={styles.heroSubtitle}>
              {teams.length} teams competing for the top spot
            </Text>
          </LinearGradient>

          {myTeam && myRank && (
            <Card style={styles.myRankCard} padding="md">
              <View style={styles.myRankRow}>
                <View>
                  <Text style={[styles.myRankLabel, { color: colors.textSecondary }]}>Your team's rank</Text>
                  <Text style={[styles.myRankValue, { color: colors.text }]}>#{myRank}</Text>
                </View>
                <View>
                  <Text style={[styles.myTeamName, { color: colors.text }]}>{myTeam.name}</Text>
                  <Text style={[styles.myTeamPoints, { color: colors.primary }]}>
                    {myTeam.total_points} pts
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {topThree.length > 0 && (
            <Card style={styles.podiumCard} padding="lg">
              <Text style={[styles.cardTitle, { color: colors.text }]}>Top Teams</Text>
              {topThree.map((team, idx) => {
                const rank = idx + 1;
                const isMe = myTeam?.id === team.id;
                return (
                  <Pressable
                    key={team.id}
                    onPress={() => router.push({ pathname: '/team-detail', params: { id: team.id } })}
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
                    <View style={styles.teamInfoWrap}>
                      <Text style={[styles.teamName, { color: colors.text }]}>
                        {team.name}{isMe ? ' (You)' : ''}
                      </Text>
                      <Text style={[styles.teamMeta, { color: colors.textSecondary }]}>
                        {team.member_count} members
                      </Text>
                    </View>
                    <Text style={[styles.teamPoints, { color: getRankColor(rank) }]}>
                      {team.total_points} pts
                    </Text>
                  </Pressable>
                );
              })}
            </Card>
          )}

          <Card style={styles.boardCard} padding="lg">
            <Text style={[styles.cardTitle, { color: colors.text }]}>Full Rankings</Text>
            {teams.map((team, idx) => {
              const rank = idx + 1;
              const isMe = myTeam?.id === team.id;
              const emphasize = rank <= 3;

              return (
                <Pressable
                  key={team.id}
                  onPress={() => router.push({ pathname: '/team-detail', params: { id: team.id } })}
                  style={[
                    styles.listRow,
                    {
                      backgroundColor: isMe
                        ? `${colors.primary}12`
                        : idx % 2 === 0
                          ? colors.surface
                          : colors.surfaceVariant,
                      borderColor: emphasize ? `${colors.primary}20` : colors.borderLight,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rankPill,
                      { backgroundColor: emphasize ? `${colors.primary}18` : colors.surfaceVariant },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankPillText,
                        { color: emphasize ? colors.primary : colors.textSecondary },
                      ]}
                    >
                      #{rank}
                    </Text>
                  </View>
                  <View style={styles.teamInfoWrap}>
                    <Text style={[styles.teamName, { color: colors.text }]}>
                      {team.name}{isMe ? ' (You)' : ''}
                    </Text>
                    <Text style={[styles.teamMeta, { color: colors.textSecondary }]}>
                      {team.member_count} members
                    </Text>
                  </View>
                  <Text style={[styles.teamPoints, { color: colors.text }]}>{team.total_points}</Text>
                </Pressable>
              );
            })}
          </Card>

          <View style={{ height: spacing.xxl + 70 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
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
  },
  myRankCard: { marginBottom: spacing.md },
  myRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  myRankLabel: { fontSize: fontSize.sm },
  myRankValue: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, marginTop: 2 },
  myTeamName: { fontSize: fontSize.base, fontWeight: fontWeight.bold, textAlign: 'right' },
  myTeamPoints: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'right', marginTop: 2 },
  podiumCard: { marginBottom: spacing.md },
  boardCard: { marginBottom: spacing.md },
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
  teamInfoWrap: { flex: 1, minWidth: 0 },
  teamName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  teamMeta: { fontSize: fontSize.xs, marginTop: 2 },
  teamPoints: { fontSize: fontSize.base, fontWeight: fontWeight.black, marginLeft: spacing.sm },
});
