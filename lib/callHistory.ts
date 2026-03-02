import { supabase } from '@/lib/supabase';
import type { CallHistoryEntry, CallHistoryStatus } from '@/lib/types';

/** Log a call start — returns the call history row ID */
export async function logCallStart(
  conversationId: string,
  callerId: string,
  calleeId: string,
  mode: 'audio' | 'video',
): Promise<string | null> {
  const { data, error } = await supabase
    .from('call_history')
    .insert({
      conversation_id: conversationId,
      caller_id: callerId,
      callee_id: calleeId,
      mode,
      status: 'completed', // will be updated on end
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[callHistory] logCallStart error:', error.message);
    return null;
  }
  return data.id;
}

/** Log a call end — updates status and duration */
export async function logCallEnd(
  callId: string,
  status: CallHistoryStatus,
): Promise<void> {
  const endedAt = new Date().toISOString();

  // Fetch the started_at to compute duration
  const { data: row } = await supabase
    .from('call_history')
    .select('started_at')
    .eq('id', callId)
    .single();

  let durationSeconds: number | null = null;
  if (row?.started_at) {
    durationSeconds = Math.round(
      (Date.now() - new Date(row.started_at).getTime()) / 1000,
    );
  }

  const { error } = await supabase
    .from('call_history')
    .update({
      status,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
    })
    .eq('id', callId);

  if (error) {
    console.warn('[callHistory] logCallEnd error:', error.message);
  }
}

/** Get recent call history for a user */
export async function getCallHistory(
  userId: string,
  limit = 50,
): Promise<CallHistoryEntry[]> {
  const { data, error } = await supabase
    .from('call_history')
    .select('*')
    .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as CallHistoryEntry[];
}

/** Count missed calls that the user hasn't seen */
export async function getMissedCallCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('call_history')
    .select('*', { count: 'exact', head: true })
    .eq('callee_id', userId)
    .eq('status', 'missed');

  if (error) return 0;
  return count ?? 0;
}
