import { supabase } from '@/lib/supabase';
import { grantXP } from '@/lib/xp';
import type { PuzzleDuel } from '@/lib/types';

export async function challengeFriend(challengerId: string, opponentId: string, puzzleId: string): Promise<string> {
  const { data, error } = await supabase
    .from('puzzle_duels')
    .insert({
      challenger_id: challengerId,
      opponent_id: opponentId,
      puzzle_id: puzzleId,
      status: 'pending',
    })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error || !data) throw new Error('Failed to create duel');
  return data.id;
}

export async function acceptDuel(duelId: string): Promise<void> {
  await supabase
    .from('puzzle_duels')
    .update({ status: 'active' })
    .eq('id', duelId);
}

export async function declineDuel(duelId: string): Promise<void> {
  await supabase
    .from('puzzle_duels')
    .update({ status: 'declined' })
    .eq('id', duelId);
}

export async function submitDuelAttempt(
  duelId: string,
  userId: string,
  isCorrect: boolean,
  msTaken: number,
): Promise<void> {
  const { data: duel } = await supabase
    .from('puzzle_duels')
    .select('*')
    .eq('id', duelId)
    .maybeSingle<PuzzleDuel>();

  if (!duel) throw new Error('Duel not found');

  const isChallenger = duel.challenger_id === userId;
  const updateData: Record<string, any> = {};

  if (isChallenger) {
    updateData.challenger_ms = msTaken;
    updateData.challenger_correct = isCorrect;
  } else {
    updateData.opponent_ms = msTaken;
    updateData.opponent_correct = isCorrect;
  }

  // Check if both have answered
  const otherAnswered = isChallenger ? duel.opponent_ms != null : duel.challenger_ms != null;

  if (otherAnswered) {
    const challengerCorrect = isChallenger ? isCorrect : duel.challenger_correct!;
    const opponentCorrect = isChallenger ? duel.opponent_correct! : isCorrect;
    const challengerMs = isChallenger ? msTaken : duel.challenger_ms!;
    const opponentMs = isChallenger ? duel.opponent_ms! : msTaken;

    let winnerId: string | null = null;
    if (challengerCorrect && !opponentCorrect) winnerId = duel.challenger_id;
    else if (!challengerCorrect && opponentCorrect) winnerId = duel.opponent_id;
    else if (challengerCorrect && opponentCorrect) {
      winnerId = challengerMs <= opponentMs ? duel.challenger_id : duel.opponent_id;
    }

    updateData.status = 'completed';
    updateData.winner_id = winnerId;

    // Grant XP to winner
    if (winnerId) {
      await grantXP(winnerId, 50, `duel:${duelId}`);
    }
  }

  await supabase.from('puzzle_duels').update(updateData).eq('id', duelId);
}

export async function getDuelStatus(duelId: string): Promise<PuzzleDuel | null> {
  const { data } = await supabase
    .from('puzzle_duels')
    .select('*')
    .eq('id', duelId)
    .maybeSingle<PuzzleDuel>();

  return data ?? null;
}

export async function getPendingDuels(userId: string): Promise<PuzzleDuel[]> {
  const { data } = await supabase
    .from('puzzle_duels')
    .select('*')
    .eq('opponent_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  return (data ?? []) as PuzzleDuel[];
}
