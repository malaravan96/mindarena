import { supabase } from '@/lib/supabase';
import { grantXP } from '@/lib/xp';
import type { DailyReward } from '@/lib/types';

const DAILY_XP_REWARDS = [10, 15, 20, 25, 30, 40, 75]; // Day 1-7

export async function getDailyRewardStatus(userId: string) {
  const today = new Date().toISOString().split('T')[0];

  // Get this week's claims
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: claims } = await supabase
    .from('daily_login_rewards')
    .select('reward_date, day_number, xp_reward, claimed_at')
    .eq('user_id', userId)
    .gte('reward_date', weekAgo.toISOString().split('T')[0])
    .order('reward_date', { ascending: true });

  const { data: profile } = await supabase
    .from('profiles')
    .select('login_streak, last_login_date')
    .eq('id', userId)
    .maybeSingle<{ login_streak: number; last_login_date: string | null }>();

  const claimedDates = new Set((claims ?? []).map((c) => c.reward_date));
  const todayClaimed = claimedDates.has(today);
  const loginStreak = profile?.login_streak ?? 0;

  // Calculate current day in the 7-day cycle
  const dayNumber = (loginStreak % 7) + 1;
  const todayReward = DAILY_XP_REWARDS[dayNumber - 1] ?? 10;

  // Build 7-day calendar
  const calendar = DAILY_XP_REWARDS.map((xp, i) => ({
    day: i + 1,
    xp,
    claimed: i < dayNumber - 1 || (i === dayNumber - 1 && todayClaimed),
    isToday: i === dayNumber - 1,
    locked: i > dayNumber - 1,
  }));

  return {
    todayClaimed,
    loginStreak,
    dayNumber,
    todayReward,
    calendar,
  };
}

export async function claimDailyReward(userId: string): Promise<{ xpEarned: number; newStreak: number } | null> {
  const today = new Date().toISOString().split('T')[0];

  // Check if already claimed
  const { data: existing } = await supabase
    .from('daily_login_rewards')
    .select('id')
    .eq('user_id', userId)
    .eq('reward_date', today)
    .maybeSingle<{ id: string }>();

  if (existing) return null;

  // Get profile to calculate streak
  const { data: profile } = await supabase
    .from('profiles')
    .select('login_streak, last_login_date')
    .eq('id', userId)
    .maybeSingle<{ login_streak: number; last_login_date: string | null }>();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const lastLogin = profile?.last_login_date;
  const isConsecutive = lastLogin === yesterdayStr;
  const newStreak = isConsecutive ? (profile?.login_streak ?? 0) + 1 : 1;
  const dayNumber = ((newStreak - 1) % 7) + 1;
  const xpReward = DAILY_XP_REWARDS[dayNumber - 1] ?? 10;

  // Insert claim
  const { error } = await supabase.from('daily_login_rewards').insert({
    user_id: userId,
    reward_date: today,
    day_number: dayNumber,
    xp_reward: xpReward,
  });

  if (error) return null;

  // Update profile streak
  await supabase
    .from('profiles')
    .update({ login_streak: newStreak, last_login_date: today })
    .eq('id', userId);

  // Grant XP
  await grantXP(userId, xpReward, 'daily_login');

  return { xpEarned: xpReward, newStreak };
}
