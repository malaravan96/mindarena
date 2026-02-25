import { supabase } from '@/lib/supabase';

export interface PendingDmCall {
  id: string;
  conversation_id: string;
  from_id: string;
  to_id: string;
  from_name: string;
  mode: 'audio' | 'video';
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string;
}

/** Insert a new pending call record. Returns the new row id, or null on error. */
export async function createPendingCall(
  conversationId: string,
  fromId: string,
  toId: string,
  fromName: string,
  mode: 'audio' | 'video',
): Promise<string | null> {
  const { data, error } = await supabase
    .from('pending_dm_calls')
    .insert({
      conversation_id: conversationId,
      from_id: fromId,
      to_id: toId,
      from_name: fromName,
      mode,
    })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error || !data) return null;
  return data.id;
}

/**
 * Return the latest unexpired pending call addressed to `toId` in this
 * conversation, or null if none exists.
 */
export async function getPendingCallForCallee(
  conversationId: string,
  toId: string,
): Promise<PendingDmCall | null> {
  const { data } = await supabase
    .from('pending_dm_calls')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('to_id', toId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<PendingDmCall>();

  return data ?? null;
}

/** Update the status of a pending call record. */
export async function updatePendingCallStatus(
  id: string,
  status: 'accepted' | 'declined' | 'expired',
): Promise<void> {
  await supabase
    .from('pending_dm_calls')
    .update({ status })
    .eq('id', id);
}
