import { supabase } from '@/lib/supabase';
import { grantXP } from '@/lib/xp';
import type { Tournament, TournamentParticipant, TournamentRound, TournamentAttempt } from '@/lib/types';

export async function listTournaments(status?: string): Promise<Tournament[]> {
  let query = supabase
    .from('tournaments')
    .select('*')
    .order('starts_at', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  const { data } = await query.limit(50);
  return (data ?? []) as Tournament[];
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .maybeSingle<Tournament>();
  return data ?? null;
}

export async function registerForTournament(tournamentId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tournament_participants')
    .insert({ tournament_id: tournamentId, user_id: userId });

  if (error) {
    if (error.code === '23505') return false; // Already registered
    throw error;
  }

  // Increment participant count
  try {
    await supabase.rpc('increment_tournament_participants', { tournament_id: tournamentId });
  } catch {
    // Fallback: manual increment
    const { data: t } = await supabase
      .from('tournaments')
      .select('participant_count')
      .eq('id', tournamentId)
      .maybeSingle<{ participant_count: number }>();
    if (t) {
      await supabase
        .from('tournaments')
        .update({ participant_count: (t.participant_count ?? 0) + 1 })
        .eq('id', tournamentId);
    }
  }

  return true;
}

export async function isRegistered(tournamentId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('tournament_participants')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>();
  return !!data;
}

export async function getTournamentLeaderboard(tournamentId: string): Promise<(TournamentParticipant & { username?: string; display_name?: string })[]> {
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('total_score', { ascending: false })
    .limit(100);

  if (!participants?.length) return [];

  const userIds = [...new Set(participants.map((p) => p.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return participants.map((p) => ({
    ...(p as TournamentParticipant),
    username: profileMap.get(p.user_id)?.username ?? undefined,
    display_name: profileMap.get(p.user_id)?.display_name ?? undefined,
  }));
}

export async function getTournamentRounds(tournamentId: string): Promise<TournamentRound[]> {
  const { data } = await supabase
    .from('tournament_rounds')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round_number', { ascending: true });

  return (data ?? []) as TournamentRound[];
}

export async function submitTournamentAttempt(
  roundId: string,
  userId: string,
  selectedIndex: number,
  isCorrect: boolean,
  msTaken: number,
): Promise<number> {
  const score = isCorrect ? Math.max(1000 - msTaken, 100) : 0;

  await supabase.from('tournament_attempts').insert({
    round_id: roundId,
    user_id: userId,
    selected_index: selectedIndex,
    is_correct: isCorrect,
    ms_taken: msTaken,
    score,
  });

  // Update participant total score
  const { data: existing } = await supabase
    .from('tournament_participants')
    .select('total_score, rounds_completed, tournament_id')
    .eq('user_id', userId)
    .maybeSingle<{ total_score: number; rounds_completed: number; tournament_id: string }>();

  // Find the tournament for this round
  const { data: round } = await supabase
    .from('tournament_rounds')
    .select('tournament_id')
    .eq('id', roundId)
    .maybeSingle<{ tournament_id: string }>();

  if (round) {
    await supabase
      .from('tournament_participants')
      .update({
        total_score: (existing?.total_score ?? 0) + score,
        rounds_completed: (existing?.rounds_completed ?? 0) + 1,
      })
      .eq('tournament_id', round.tournament_id)
      .eq('user_id', userId);
  }

  return score;
}

export async function getActiveTournament(): Promise<Tournament | null> {
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'active')
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle<Tournament>();

  return data ?? null;
}
