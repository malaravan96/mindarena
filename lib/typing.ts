import type { RealtimeChannel } from '@supabase/supabase-js';

const TYPING_DEBOUNCE_MS = 2000;
const lastSentMap = new Map<string, number>();

/**
 * Broadcasts a typing signal on the given call channel.
 * Debounced to at most one signal per 2 seconds per (channel, userId) pair.
 */
export async function sendTypingSignal(
  channel: RealtimeChannel,
  userId: string,
  conversationId: string,
): Promise<void> {
  const key = `${conversationId}:${userId}`;
  const now = Date.now();
  const last = lastSentMap.get(key) ?? 0;
  if (now - last < TYPING_DEBOUNCE_MS) return;
  lastSentMap.set(key, now);

  try {
    await channel.send({
      type: 'broadcast',
      event: 'dm-typing',
      payload: { fromId: userId, conversationId },
    });
  } catch {
    // Non-critical — silently ignore
  }
}

/**
 * Broadcasts a typing-stop signal on the given call channel.
 */
export async function sendTypingStop(
  channel: RealtimeChannel,
  userId: string,
  conversationId: string,
): Promise<void> {
  // Reset debounce so next typing signal goes through immediately
  lastSentMap.delete(`${conversationId}:${userId}`);

  try {
    await channel.send({
      type: 'broadcast',
      event: 'dm-typing-stop',
      payload: { fromId: userId, conversationId },
    });
  } catch {
    // Non-critical — silently ignore
  }
}
