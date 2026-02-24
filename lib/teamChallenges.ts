import { supabase } from '@/lib/supabase';
import type { TeamChallenge, Team } from '@/lib/types';

export async function createTeamChallenge(
  challengerTeamId: string,
  opponentTeamId: string,
  puzzleId?: string,
): Promise<TeamChallenge> {
  const { data, error } = await supabase
    .from('team_challenges')
    .insert({
      challenger_team_id: challengerTeamId,
      opponent_team_id: opponentTeamId,
      puzzle_id: puzzleId ?? null,
      status: 'pending',
    })
    .select('*')
    .maybeSingle<TeamChallenge>();

  if (error || !data) throw error ?? new Error('Failed to create challenge');
  return data;
}

export async function getTeamChallenges(teamId: string): Promise<(TeamChallenge & { challenger_team?: Team; opponent_team?: Team })[]> {
  const { data, error } = await supabase
    .from('team_challenges')
    .select('*')
    .or(`challenger_team_id.eq.${teamId},opponent_team_id.eq.${teamId}`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  const teamIds = [
    ...new Set(data.flatMap((c: any) => [c.challenger_team_id, c.opponent_team_id])),
  ];

  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .in('id', teamIds);

  const teamMap = new Map((teams ?? []).map((t: any) => [t.id, t]));

  return data.map((c: any) => ({
    ...c,
    challenger_team: teamMap.get(c.challenger_team_id) ?? undefined,
    opponent_team: teamMap.get(c.opponent_team_id) ?? undefined,
  }));
}

export async function acceptTeamChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase
    .from('team_challenges')
    .update({ status: 'active' })
    .eq('id', challengeId);

  if (error) throw error;
}

export async function submitTeamChallengeScore(
  challengeId: string,
  teamId: string,
  score: number,
): Promise<void> {
  const { data: challenge } = await supabase
    .from('team_challenges')
    .select('challenger_team_id, opponent_team_id, challenger_score, opponent_score')
    .eq('id', challengeId)
    .maybeSingle<{
      challenger_team_id: string;
      opponent_team_id: string;
      challenger_score: number;
      opponent_score: number;
    }>();

  if (!challenge) throw new Error('Challenge not found');

  const isChallenger = teamId === challenge.challenger_team_id;
  const updateData = isChallenger
    ? { challenger_score: challenge.challenger_score + score }
    : { opponent_score: challenge.opponent_score + score };

  const { error } = await supabase
    .from('team_challenges')
    .update(updateData)
    .eq('id', challengeId);

  if (error) throw error;
}

export async function completeTeamChallenge(challengeId: string): Promise<void> {
  const { data: challenge } = await supabase
    .from('team_challenges')
    .select('challenger_team_id, opponent_team_id, challenger_score, opponent_score')
    .eq('id', challengeId)
    .maybeSingle<{
      challenger_team_id: string;
      opponent_team_id: string;
      challenger_score: number;
      opponent_score: number;
    }>();

  if (!challenge) throw new Error('Challenge not found');

  const winnerId =
    challenge.challenger_score > challenge.opponent_score
      ? challenge.challenger_team_id
      : challenge.opponent_score > challenge.challenger_score
        ? challenge.opponent_team_id
        : null;

  const { error } = await supabase
    .from('team_challenges')
    .update({ status: 'completed', winner_team_id: winnerId })
    .eq('id', challengeId);

  if (error) throw error;
}
