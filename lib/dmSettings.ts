import { supabase } from '@/lib/supabase';
import type { DmConversationSettings } from '@/lib/types';

export async function getConversationSettings(
  conversationId: string,
): Promise<DmConversationSettings | null> {
  const { data, error } = await supabase
    .from('dm_conversation_settings')
    .select('conversation_id, disappearing_messages_ttl, updated_at, updated_by')
    .eq('conversation_id', conversationId)
    .maybeSingle<DmConversationSettings>();

  if (error) return null;
  return data;
}

/**
 * Set disappearing message TTL for a conversation.
 * @param ttlSeconds - seconds until messages expire; null to disable.
 */
export async function setDisappearingMessages(
  conversationId: string,
  ttlSeconds: number | null,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { error } = await supabase
    .from('dm_conversation_settings')
    .upsert(
      {
        conversation_id: conversationId,
        disappearing_messages_ttl: ttlSeconds,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: 'conversation_id' },
    );

  if (error) throw error;
}
