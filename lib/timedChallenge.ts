import { supabase } from '@/lib/supabase';
import { grantXP } from '@/lib/xp';
import type { TimedChallengeSession } from '@/lib/types';
import { offlinePuzzles, type Puzzle } from '@/lib/puzzles';

type Duration = 180 | 300 | 600;

export async function startTimedSession(userId: string, duration: Duration): Promise<string> {
  const { data, error } = await supabase
    .from('timed_challenge_sessions')
    .insert({ user_id: userId, duration_seconds: duration })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error || !data) throw new Error('Failed to start timed session');
  return data.id;
}

export async function endTimedSession(sessionId: string, puzzlesSolved: number, totalScore: number): Promise<void> {
  await supabase
    .from('timed_challenge_sessions')
    .update({
      puzzles_solved: puzzlesSolved,
      total_score: totalScore,
      ended_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

export async function getTimedPuzzle(): Promise<Puzzle> {
  // Try to get random puzzles from the pool
  const { data } = await supabase
    .from('puzzles')
    .select('id, date_key, title, prompt, type, options, answer_index')
    .order('created_at', { ascending: false })
    .limit(50);

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

  // Fallback to offline puzzles
  return offlinePuzzles[Math.floor(Math.random() * offlinePuzzles.length)];
}

export async function getUserBestTimedScores(userId: string): Promise<TimedChallengeSession[]> {
  const { data } = await supabase
    .from('timed_challenge_sessions')
    .select('*')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('total_score', { ascending: false })
    .limit(10);

  return (data ?? []) as TimedChallengeSession[];
}

export async function grantTimedXP(userId: string, puzzlesSolved: number): Promise<void> {
  const xp = puzzlesSolved * 15; // 15 XP per puzzle solved
  if (xp > 0) await grantXP(userId, xp, 'timed_challenge');
}
