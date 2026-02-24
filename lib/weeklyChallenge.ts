import { supabase } from '@/lib/supabase';
import { grantXP } from '@/lib/xp';
import type { WeeklyChallenge } from '@/lib/types';
import { offlinePuzzles, type Puzzle } from '@/lib/puzzles';

export async function getCurrentWeeklyChallenge(): Promise<WeeklyChallenge | null> {
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('weekly_challenges')
    .select('*')
    .lte('starts_at', now)
    .gte('ends_at', now)
    .maybeSingle<WeeklyChallenge>();

  return data ?? null;
}

export async function getWeeklyChallengeHistory(): Promise<WeeklyChallenge[]> {
  const { data } = await supabase
    .from('weekly_challenges')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(10);

  return (data ?? []) as WeeklyChallenge[];
}

export async function getWeeklyPuzzles(theme: string): Promise<Puzzle[]> {
  // Get puzzles matching the weekly theme (category)
  const { data } = await supabase
    .from('puzzles')
    .select('id, date_key, title, prompt, type, options, answer_index')
    .eq('type', theme)
    .order('created_at', { ascending: false })
    .limit(20);

  if (data && data.length > 0) {
    return data.map((p) => ({
      id: p.id,
      date_key: p.date_key,
      title: p.title,
      prompt: p.prompt,
      type: p.type as Puzzle['type'],
      options: p.options,
      answer_index: p.answer_index,
    }));
  }

  // Fallback
  return offlinePuzzles.filter((p) => p.type === theme);
}

export async function grantWeeklyXP(userId: string, basePoints: number, multiplier: number): Promise<void> {
  const xp = Math.floor(basePoints * multiplier);
  if (xp > 0) await grantXP(userId, xp, 'weekly_challenge');
}
