import { supabase } from '@/lib/supabase';
import type { DmReaction, DmReactionGroup } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export async function loadReactionsForMessages(messageIds: string[]): Promise<DmReaction[]> {
  if (!messageIds.length) return [];
  const { data, error } = await supabase
    .from('dm_message_reactions')
    .select('id, message_id, user_id, emoji, created_at')
    .in('message_id', messageIds);
  if (error || !data) return [];
  return data as DmReaction[];
}

export async function toggleReaction(messageId: string, emoji: string): Promise<{ added: boolean }> {
  const { data: session } = await supabase.auth.getUser();
  const uid = session?.user?.id;
  if (!uid) throw new Error('Not signed in');

  const { error: insertError } = await supabase
    .from('dm_message_reactions')
    .insert({ message_id: messageId, user_id: uid, emoji });

  if (!insertError) return { added: true };

  // Unique constraint violation — reaction already exists, so remove it
  if (insertError.code === '23505') {
    await supabase
      .from('dm_message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', uid)
      .eq('emoji', emoji);
    return { added: false };
  }

  throw insertError;
}

export function groupReactions(
  reactions: DmReaction[],
  currentUserId: string,
): Map<string, DmReactionGroup[]> {
  const result = new Map<string, DmReactionGroup[]>();

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

  for (const [key, groups] of result) {
    result.set(key, groups.sort((a, b) => b.count - a.count));
  }

  return result;
}

export async function broadcastReaction(
  channel: RealtimeChannel,
  userId: string,
  messageId: string,
  emoji: string,
  added: boolean,
): Promise<void> {
  await channel.send({
    type: 'broadcast',
    event: 'dm-reaction',
    payload: { userId, messageId, emoji, added },
  });
}
