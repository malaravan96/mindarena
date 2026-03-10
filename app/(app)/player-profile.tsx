import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getPlayerProfile } from '@/lib/playerSearch';
import type { PlayerProfile as PlayerProfileType } from '@/lib/playerSearch';
import { getUserAchievements } from '@/lib/achievements';
import { getCurrentLevelProgress } from '@/lib/xp';
import { getConnectionStatus } from '@/lib/connections';
import { getConnectionCount, getWinRate, getMutualConnectionCount, getUserActivity } from '@/lib/profileStats';
import { showAlert } from '@/lib/alert';
import { ProfileHeroCard } from '@/components/profile/ProfileHeroCard';
import { ProfileTabBar } from '@/components/profile/ProfileTabBar';
import { ProfilePlayerActions } from '@/components/profile/ProfilePlayerActions';
import { ProfileStatsSection } from '@/components/profile/ProfileStatsSection';
import { ProfileAchievementsSection } from '@/components/profile/ProfileAchievementsSection';
import { ProfileActivitySection } from '@/components/profile/ProfileActivitySection';
import { ProfileShareButton } from '@/components/profile/ProfileShareButton';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, isDesktop } from '@/constants/theme';
import type { AvailableBadge, LevelInfo, UserStats, PuzzleAttempt, ActivityFeedItem } from '@/lib/types';

const PLAYER_TABS = [
  { key: 'overview', label: 'Overview', icon: 'person-outline' as const },
  { key: 'activity', label: 'Activity', icon: 'time-outline' as const },
];

export default function PlayerProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();

  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');
  const loadedTabs = useRef(new Set<string>(['overview']));

  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<PlayerProfileType | null>(null);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [badges, setBadges] = useState<AvailableBadge[]>([]);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [connCount, setConnCount] = useState(0);
  const [playerWinRate, setPlayerWinRate] = useState(0);
  const [mutualCount, setMutualCount] = useState(0);
  const [stats, setStats] = useState<UserStats>({
    total_attempts: 0, correct_attempts: 0, avg_time: 0, best_time: 0, streak: 0, total_points: 0,
  });
  const [recentAttempts, setRecentAttempts] = useState<PuzzleAttempt[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const profile = await getPlayerProfile(id!);
      setPlayer(profile);
      if (!profile) return;

      const { data: userData } = await supabase.auth.getUser();
      const viewerId = userData.user?.id;

      const [earned, lvl, pConnCount, pWinRate] = await Promise.all([
        getUserAchievements(id!),
        getCurrentLevelProgress(id!),
        getConnectionCount(id!),
        getWinRate(id!),
      ]);

      setBadges(earned.map((e) => e.badge));
      setEarnedIds(new Set(earned.map((e) => e.badge_id)));
      setLevelInfo(lvl);
      setConnCount(pConnCount);
      setPlayerWinRate(pWinRate);

      // Load attempts for stats
      const { data: attemptsData } = await supabase
        .from('attempts')
        .select('id, ms_taken, is_correct, created_at, puzzle_id')
        .eq('user_id', id!)
        .order('created_at', { ascending: false })
        .limit(20);

      const allAttempts = attemptsData ?? [];
      const correctAttempts = allAttempts.filter((a) => a.is_correct);
      const avgTime = correctAttempts.length > 0
        ? correctAttempts.reduce((sum, a) => sum + a.ms_taken, 0) / correctAttempts.length : 0;
      const bestTime = correctAttempts.length > 0
        ? Math.min(...correctAttempts.map((a) => a.ms_taken)) : 0;

      setStats({
        total_attempts: allAttempts.length,
        correct_attempts: correctAttempts.length,
        avg_time: avgTime,
        best_time: bestTime,
        streak: profile.streak_count,
        total_points: profile.total_points,
      });

      if (allAttempts.length > 0) {
        const puzzleIds = [...new Set(allAttempts.map((a) => a.puzzle_id))];
        const { data: puzzlesData } = await supabase
          .from('puzzles')
          .select('id, title, type')
          .in('id', puzzleIds);
        const puzzleMap: Record<string, { title: string; type: string }> = {};
        for (const p of puzzlesData ?? []) puzzleMap[p.id] = { title: p.title, type: p.type };
        setRecentAttempts(allAttempts.slice(0, 10).map((a) => ({
          id: a.id,
          is_correct: a.is_correct,
          ms_taken: a.ms_taken,
          created_at: a.created_at,
          puzzle_title: puzzleMap[a.puzzle_id]?.title ?? 'Puzzle',
          puzzle_type: puzzleMap[a.puzzle_id]?.type ?? 'unknown',
        })));
      }

      if (viewerId) {
        const [connStatus, mutual] = await Promise.all([
          getConnectionStatus(viewerId, id!),
          getMutualConnectionCount(viewerId, id!),
        ]);
        setMutualCount(mutual);
        if (connStatus) {
          setConnectionStatus(connStatus.status === 'accepted' ? 'accepted' : 'pending');
        }
      }
    } catch (e) {
      console.error('Player profile error:', e);
    } finally {
      setLoading(false);
    }
  }

  const handleTabChange = useCallback(async (tab: string) => {
    const key = tab as 'overview' | 'activity';
    setActiveTab(key);
    if (!loadedTabs.current.has(key)) {
      loadedTabs.current.add(key);
      if (key === 'activity' && id) {
        try {
          const feed = await getUserActivity(id);
          setActivityFeed(feed);
        } catch (e) {
          console.error('Activity load error:', e);
        }
      }
    }
  }, [id]);

  async function handleConnect() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid || !id) return;

      const { error } = await supabase.from('user_connections').insert({
        requester_id: uid,
        target_id: id,
        status: 'pending',
      });

      if (error) {
        if (error.code === '23505') {
          showAlert('Already sent', 'Connection request already sent');
        } else {
          throw error;
        }
      } else {
        setConnectionStatus('pending');
        showAlert('Request sent!', 'Connection request has been sent');
      }
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to send request');
    }
  }

  function handleChallenge() {
    if (!id) return;
    const targetName = player?.display_name || player?.username || 'Player';
    router.push({ pathname: '/pvp', params: { challengePlayerId: id, challengePlayerName: targetName } });
  }

  function handleMessage() {
    if (!id) return;
    router.push({ pathname: '/chat-thread', params: { peerId: id } });
  }

  const playerName = player?.display_name || player?.username || 'Player';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Player Profile</Text>
        <View style={{ flex: 1 }} />
        {player && levelInfo && (
          <ProfileShareButton
            displayName={playerName}
            username={player.username ?? null}
            level={levelInfo.level}
            totalPoints={player.total_points}
          />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !player ? (
        <View style={styles.loadingWrap}>
          <Text style={[styles.errorText, { color: colors.error }]}>Player not found</Text>
        </View>
      ) : (
        <>
          <ProfileHeroCard
            avatarUrl={player.avatar_url ?? null}
            displayName={player.display_name ?? ''}
            username={player.username ?? null}
            bio={player.bio}
            isOnline={player.is_online}
            levelInfo={levelInfo}
            userTitle={levelInfo?.title ?? null}
            stats={{ totalPoints: player.total_points, streak: player.streak_count }}
            team={null}
            isOwnProfile={false}
          />

          {mutualCount > 0 && (
            <View style={styles.mutualRow}>
              <View style={[styles.mutualPill, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
                <Ionicons name="people-outline" size={14} color={colors.primary} />
                <Text style={[styles.mutualText, { color: colors.primary }]}>
                  {mutualCount} mutual connection{mutualCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          <ProfileTabBar tabs={PLAYER_TABS} activeTab={activeTab} onTabChange={handleTabChange} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'overview' && (
              <>
                <ProfilePlayerActions
                  connectionStatus={connectionStatus}
                  onConnect={handleConnect}
                  onChallenge={handleChallenge}
                  onMessage={handleMessage}
                />
                <ProfileStatsSection
                  stats={stats}
                  connectionCount={connCount}
                  winRate={playerWinRate}
                  isOwnProfile={false}
                />
                <ProfileAchievementsSection
                  badges={badges}
                  earnedIds={earnedIds}
                  isOwnProfile={false}
                />
              </>
            )}

            {activeTab === 'activity' && (
              <ProfileActivitySection
                recentAttempts={recentAttempts}
                activityFeed={activityFeed}
                isOwnProfile={false}
              />
            )}

            <View style={{ height: spacing.xxl + 70 }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  mutualRow: { paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  mutualPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  mutualText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
});
