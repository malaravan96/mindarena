import { supabase } from '@/lib/supabase';
import { getAcceptedPeerIds } from '@/lib/connections';
import { getUserAchievements } from '@/lib/achievements';
import { getCurrentLevelProgress } from '@/lib/xp';
import { getUserTeam } from '@/lib/teams';
import type {
  AvailableBadge,
  Team,
  UserStats,
  PuzzleAttempt,
  LevelInfo,
  ActivityFeedItem,
} from '@/lib/types';

export interface OwnProfileData {
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  stats: UserStats;
  recentAttempts: PuzzleAttempt[];
  badges: AvailableBadge[];
  earnedIds: Set<string>;
  levelInfo: LevelInfo | null;
  userTitle: string | null;
  team: Team | null;
  connectionCount: number;
  winRate: number;
}

export async function loadOwnProfileData(userId: string, email: string): Promise<OwnProfileData> {
  const [profileRes, attemptsRes, earned, lvlInfo, team, connCount] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, display_name, total_points, streak_count, avatar_url, bio')
      .eq('id', userId)
      .maybeSingle<{
        username: string | null;
        display_name: string | null;
        total_points: number;
        streak_count: number;
        avatar_url: string | null;
        bio: string | null;
      }>(),
    supabase
      .from('attempts')
      .select('id, ms_taken, is_correct, created_at, puzzle_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    getUserAchievements(userId),
    getCurrentLevelProgress(userId),
    getUserTeam(userId),
    getConnectionCount(userId),
  ]);

  const profileData = profileRes.data;
  const allAttempts = attemptsRes.data ?? [];
  const correctAttempts = allAttempts.filter((a) => a.is_correct);
  const avgTime =
    correctAttempts.length > 0
      ? correctAttempts.reduce((sum, a) => sum + a.ms_taken, 0) / correctAttempts.length
      : 0;
  const bestTime =
    correctAttempts.length > 0 ? Math.min(...correctAttempts.map((a) => a.ms_taken)) : 0;

  const stats: UserStats = {
    total_attempts: allAttempts.length,
    correct_attempts: correctAttempts.length,
    avg_time: avgTime,
    best_time: bestTime,
    streak: profileData?.streak_count ?? 0,
    total_points: profileData?.total_points ?? 0,
  };

  const winRate =
    allAttempts.length > 0
      ? Math.round((correctAttempts.length / allAttempts.length) * 100)
      : 0;

  let recentAttempts: PuzzleAttempt[] = [];
  if (allAttempts.length > 0) {
    const puzzleIds = [...new Set(allAttempts.map((a) => a.puzzle_id))];
    const { data: puzzlesData } = await supabase
      .from('puzzles')
      .select('id, title, type')
      .in('id', puzzleIds);

    const puzzleMap: Record<string, { title: string; type: string }> = {};
    for (const p of puzzlesData ?? []) {
      puzzleMap[p.id] = { title: p.title, type: p.type };
    }

    recentAttempts = allAttempts.slice(0, 10).map((a) => ({
      id: a.id,
      is_correct: a.is_correct,
      ms_taken: a.ms_taken,
      created_at: a.created_at,
      puzzle_title: puzzleMap[a.puzzle_id]?.title ?? 'Puzzle',
      puzzle_type: puzzleMap[a.puzzle_id]?.type ?? 'unknown',
    }));
  }

  return {
    email,
    username: profileData?.username ?? '',
    displayName: profileData?.display_name ?? '',
    bio: profileData?.bio ?? '',
    avatarUrl: profileData?.avatar_url ?? null,
    stats,
    recentAttempts,
    badges: earned.map((e) => e.badge),
    earnedIds: new Set(earned.map((e) => e.badge_id)),
    levelInfo: lvlInfo,
    userTitle: lvlInfo.title,
    team,
    connectionCount: connCount,
    winRate,
  };
}

export async function getConnectionCount(userId: string): Promise<number> {
  const peers = await getAcceptedPeerIds(userId);
  return peers.size;
}

export async function getWinRate(userId: string): Promise<number> {
  const { count: total } = await supabase
    .from('attempts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!total) return 0;

  const { count: correct } = await supabase
    .from('attempts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_correct', true);

  return Math.round(((correct ?? 0) / total) * 100);
}

export async function getMutualConnectionCount(
  viewerId: string,
  targetId: string,
): Promise<number> {
  const [viewerPeers, targetPeers] = await Promise.all([
    getAcceptedPeerIds(viewerId),
    getAcceptedPeerIds(targetId),
  ]);
  let count = 0;
  for (const id of viewerPeers) {
    if (targetPeers.has(id)) count++;
  }
  return count;
}

export async function getUserActivity(
  userId: string,
  limit = 15,
): Promise<ActivityFeedItem[]> {
  const { data } = await supabase
    .from('activity_feed')
    .select('id, user_id, event_type, metadata, visibility, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data?.length) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', userId)
    .limit(1);

  const profile = profiles?.[0] ?? undefined;

  return data.map((e) => ({
    ...e,
    profile,
  })) as ActivityFeedItem[];
}
