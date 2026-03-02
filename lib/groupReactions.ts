import { supabase } from '@/lib/supabase';
import type { GroupReaction, GroupReactionGroup } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export async function loadGroupReactions(messageIds: string[]): Promise<GroupReaction[]> {
  if (!messageIds.length) return [];
  const { data, error } = await supabase
    .from('group_message_reactions')
    .select('id, message_id, user_id, emoji, created_at')
    .in('message_id', messageIds);
  if (error || !data) return [];
  return data as GroupReaction[];
}

export async function toggleGroupReaction(
  messageId: string,
  emoji: string,
): Promise<{ added: boolean }> {
  const { data: session } = await supabase.auth.getUser();
  const uid = session?.user?.id;
  if (!uid) throw new Error('Not signed in');

  const { error: insertError } = await supabase
    .from('group_message_reactions')
    .insert({ message_id: messageId, user_id: uid, emoji });

  if (!insertError) return { added: true };

  // Unique constraint violation — reaction already exists, so remove it
  if (insertError.code === '23505') {
    await supabase
      .from('group_message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', uid)
      .eq('emoji', emoji);
    return { added: false };
  }

  throw insertError;
}

export function groupGroupReactions(
  reactions: GroupReaction[],
  currentUserId: string,
): Map<string, GroupReactionGroup[]> {
  const result = new Map<string, GroupReactionGroup[]>();

  for (const reaction of reactions) {
    const groups = result.get(reaction.message_id) ?? [];
    const existing = groups.find((g) => g.emoji === reaction.emoji);
    if (existing) {
      existing.count += 1;
      if (reaction.user_id === currentUserId) existing.reactedByMe = true;
    } else {
      groups.push({
        emoji: reaction.emoji,
        count: 1,
        reactedByMe: reaction.user_id === currentUserId,
      });
    }
    result.set(reaction.message_id, groups);
  }

  for (const [, groups] of result) {
    groups.sort((a, b) => b.count - a.count);
  }

  return result;
}

export async function broadcastGroupReaction(
  channel: RealtimeChannel,
  userId: string,
  messageId: string,
  emoji: string,
  added: boolean,
): Promise<void> {
  await channel.send({
    type: 'broadcast',
    event: 'group-reaction',
    payload: { userId, messageId, emoji, added },
  });
}
