import { supabase } from '@/lib/supabase';
import type { TeamMessage } from '@/lib/types';

export async function listTeamMessages(teamId: string, limit = 200): Promise<TeamMessage[]> {
  const { data, error } = await supabase
    .from('team_messages')
    .select('id, team_id, sender_id, body, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data as TeamMessage[];
}

export async function sendTeamMessage(teamId: string, body: string): Promise<TeamMessage> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Not signed in');

  const text = body.trim();
  if (!text) throw new Error('Message cannot be empty');

  const { data, error } = await supabase
    .from('team_messages')
    .insert({ team_id: teamId, sender_id: uid, body: text })
    .select('id, team_id, sender_id, body, created_at')
    .maybeSingle<TeamMessage>();

  if (error || !data) throw error ?? new Error('Failed to send message');
  return data;
}

export async function getTeamMessageSenderProfiles(messages: TeamMessage[]) {
  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  if (senderIds.length === 0) return new Map<string, { name: string; avatar_url: string | null }>();

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', senderIds);

  return new Map(
    (profiles ?? []).map((p: any) => [
      p.id,
      {
        name: p.display_name || p.username || 'Player',
        avatar_url: p.avatar_url ?? null,
      },
    ]),
  );
}
