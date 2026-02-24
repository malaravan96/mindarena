import { supabase } from '@/lib/supabase';
import { grantXP } from '@/lib/xp';
import type { PuzzleStreakSession } from '@/lib/types';
import { offlinePuzzles, type Puzzle } from '@/lib/puzzles';

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

export async function startStreakSession(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('puzzle_streak_sessions')
    .insert({ user_id: userId })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error || !data) throw new Error('Failed to start streak session');
  return data.id;
}

export async function updateStreakSession(
  sessionId: string,
  streakLength: number,
  totalScore: number,
  ended: boolean,
): Promise<void> {
  const difficulty = getDifficultyForStreak(streakLength);
  await supabase
    .from('puzzle_streak_sessions')
    .update({
      streak_length: streakLength,
      max_difficulty_reached: difficulty,
      total_score: totalScore,
      ...(ended ? { ended_at: new Date().toISOString() } : {}),
    })
    .eq('id', sessionId);
}

export function getDifficultyForStreak(streakLength: number): string {
  if (streakLength < 5) return 'easy';
  if (streakLength < 10) return 'medium';
  return 'hard';
}

export async function getStreakPuzzle(streakLength: number): Promise<Puzzle> {
  const difficulty = getDifficultyForStreak(streakLength);

  const { data } = await supabase
    .from('puzzles')
    .select('id, date_key, title, prompt, type, options, answer_index')
    .eq('difficulty', difficulty)
    .order('created_at', { ascending: false })
    .limit(30);

  if (data && data.length > 0) {
    const random = data[Math.floor(Math.random() * data.length)];
    return {
      id: random.id,
      date_key: random.date_key,
      title: random.title,
      prompt: random.prompt,
      type: random.type as Puzzle['type'],
      options: random.options,
      answer_index: random.answer_index,
    };
  }

  return offlinePuzzles[Math.floor(Math.random() * offlinePuzzles.length)];
}

export async function getUserBestStreaks(userId: string): Promise<PuzzleStreakSession[]> {
  const { data } = await supabase
    .from('puzzle_streak_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('streak_length', { ascending: false })
    .limit(10);

  return (data ?? []) as PuzzleStreakSession[];
}

export async function grantStreakXP(userId: string, streakLength: number): Promise<void> {
  // Base XP + bonus for longer streaks
  const baseXP = streakLength * 10;
  const bonus = Math.floor(streakLength / 5) * 25; // +25 every 5 puzzles
  const totalXP = baseXP + bonus;
  if (totalXP > 0) await grantXP(userId, totalXP, 'puzzle_streak');
}
