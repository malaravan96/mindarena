import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { TournamentParticipant } from '@/lib/types';

export function useTournamentRealtime(tournamentId: string | null) {
  const [leaderboard, setLeaderboard] = useState<TournamentParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    const { data } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('total_score', { ascending: false })
      .limit(100);

    setLeaderboard((data ?? []) as TournamentParticipant[]);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId) return;

    fetchLeaderboard();

    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_participants',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          fetchLeaderboard();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, fetchLeaderboard]);

  return { leaderboard, loading, refresh: fetchLeaderboard };
}
