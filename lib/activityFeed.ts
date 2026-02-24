import { supabase } from '@/lib/supabase';
import { getAcceptedPeerIds } from '@/lib/connections';
import type { ActivityFeedItem, ActivityEventType } from '@/lib/types';

export async function getFriendsFeed(userId: string, limit = 50): Promise<ActivityFeedItem[]> {
  const friends = await getAcceptedPeerIds(userId);
  const friendIds = Array.from(friends);

  // Include own events + friends' events
  const allIds = [userId, ...friendIds];

  if (allIds.length === 0) return [];

  const { data } = await supabase
    .from('activity_feed')
    .select('*')
    .in('user_id', allIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data?.length) return [];

  // Attach profiles
  const userIds = [...new Set(data.map((e) => e.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  return data.map((e) => ({
    ...e,
    profile: profileMap.get(e.user_id) ?? undefined,
  })) as ActivityFeedItem[];
}

export async function postFeedEvent(
  userId: string,
  eventType: ActivityEventType,
  metadata: Record<string, any> = {},
  visibility: 'public' | 'friends' = 'friends',
): Promise<void> {
  await supabase.from('activity_feed').insert({
    user_id: userId,
    event_type: eventType,
    metadata,
    visibility,
  });
}

export function getEventDescription(event: ActivityFeedItem): string {
  const name = event.profile?.display_name || event.profile?.username || 'Someone';

  switch (event.event_type) {
    case 'puzzle_solved':
      return `${name} solved a puzzle${event.metadata.ms_taken ? ` in ${(event.metadata.ms_taken / 1000).toFixed(1)}s` : ''}`;
    case 'badge_earned':
      return `${name} earned the "${event.metadata.badge_title ?? 'a'}" badge`;
    case 'level_up':
      return `${name} reached level ${event.metadata.level ?? '?'}`;
    case 'streak_milestone':
      return `${name} hit a ${event.metadata.streak ?? '?'}-day streak!`;
    case 'tournament_win':
      return `${name} won a tournament!`;
    case 'duel_completed':
      return `${name} completed a duel${event.metadata.won ? ' and won!' : ''}`;
    case 'team_joined':
      return `${name} joined team "${event.metadata.team_name ?? 'a team'}"`;
    default:
      return `${name} did something`;
  }
}

export function getEventIcon(eventType: ActivityEventType): string {
  switch (eventType) {
    case 'puzzle_solved': return 'checkmark-circle-outline';
    case 'badge_earned': return 'ribbon-outline';
    case 'level_up': return 'arrow-up-circle-outline';
    case 'streak_milestone': return 'flame-outline';
    case 'tournament_win': return 'trophy-outline';
    case 'duel_completed': return 'flash-outline';
    case 'team_joined': return 'people-outline';
    default: return 'ellipse-outline';
  }
}
