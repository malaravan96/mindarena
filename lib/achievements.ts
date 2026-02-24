import { supabase } from '@/lib/supabase';
import type { AvailableBadge, UserAchievement } from '@/lib/types';
import { grantXP } from '@/lib/xp';

export async function getUserAchievements(userId: string): Promise<(UserAchievement & { badge: AvailableBadge })[]> {
  const { data: earned } = await supabase
    .from('user_achievements')
    .select('id, user_id, badge_id, earned_at')
    .eq('user_id', userId);

  const { data: allBadges } = await supabase
    .from('available_badges')
    .select('*');

  const badges = (allBadges ?? []) as AvailableBadge[];
  const badgeMap = new Map(badges.map((b) => [b.id, b]));

  return (earned ?? []).map((a) => ({
    ...a,
    badge: badgeMap.get(a.badge_id) ?? {
      id: a.badge_id,
      title: a.badge_id,
      description: '',
      icon: 'ribbon-outline',
      rarity: 'common' as const,
      category: 'general',
      criteria: {},
      xp_reward: 0,
      created_at: a.earned_at,
    },
  }));
}

export async function getAllBadges(): Promise<AvailableBadge[]> {
  const { data } = await supabase
    .from('available_badges')
    .select('*')
    .order('rarity', { ascending: true });

  return (data ?? []) as AvailableBadge[];
}

export async function checkAndAwardAchievements(userId: string): Promise<string[]> {
  const [allBadges, earned, stats] = await Promise.all([
    getAllBadges(),
    getUserAchievements(userId),
    getUserStats(userId),
  ]);

  const earnedIds = new Set(earned.map((e) => e.badge_id));
  const newlyAwarded: string[] = [];

  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;

    const shouldAward = evaluateCriteria(badge.criteria, stats);
    if (!shouldAward) continue;

    const { error } = await supabase.from('user_achievements').insert({
      user_id: userId,
      badge_id: badge.id,
    });

    if (!error) {
      newlyAwarded.push(badge.id);
      if (badge.xp_reward > 0) {
        await grantXP(userId, badge.xp_reward, `badge:${badge.id}`);
      }
    }
  }

  return newlyAwarded;
}

export async function equipTitle(userId: string, title: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ title })
    .eq('id', userId);
}

export async function getUserTitles(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_titles')
    .select('title')
    .eq('user_id', userId);

  return (data ?? []).map((t) => t.title);
}

type UserStats = {
  correct_count: number;
  attempt_count: number;
  best_time: number;
  streak: number;
  level: number;
  total_xp: number;
  connection_count: number;
};

async function getUserStats(userId: string): Promise<UserStats> {
  const [profileRes, attemptsRes, connectionsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('streak_count, level, xp')
      .eq('id', userId)
      .maybeSingle<{ streak_count: number; level: number; xp: number }>(),
    supabase
      .from('attempts')
      .select('is_correct, ms_taken')
      .eq('user_id', userId),
    supabase
      .from('user_connections')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},target_id.eq.${userId}`),
  ]);

  const attempts = attemptsRes.data ?? [];
  const correctAttempts = attempts.filter((a) => a.is_correct);
  const bestTime = correctAttempts.length > 0
    ? Math.min(...correctAttempts.map((a) => a.ms_taken))
    : Infinity;

  return {
    correct_count: correctAttempts.length,
    attempt_count: attempts.length,
    best_time: bestTime,
    streak: profileRes.data?.streak_count ?? 0,
    level: profileRes.data?.level ?? 1,
    total_xp: profileRes.data?.xp ?? 0,
    connection_count: connectionsRes.count ?? 0,
  };
}

function evaluateCriteria(criteria: Record<string, any>, stats: UserStats): boolean {
  const type = criteria.type;
  const threshold = criteria.threshold;

  switch (type) {
    case 'correct_count':
      return stats.correct_count >= threshold;
    case 'attempt_count':
      return stats.attempt_count >= threshold;
    case 'streak':
      return stats.streak >= threshold;
    case 'best_time_under':
      return stats.best_time < threshold;
    case 'perfect_accuracy':
      return stats.attempt_count >= (criteria.min_attempts ?? 5) && stats.correct_count === stats.attempt_count;
    case 'level':
      return stats.level >= threshold;
    case 'total_xp':
      return stats.total_xp >= threshold;
    case 'connection_count':
      return stats.connection_count >= threshold;
    default:
      return false;
  }
}
