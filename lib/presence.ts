import { supabase } from '@/lib/supabase';

export async function setOnlineStatus(userId: string, online: boolean): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      is_online: online,
      last_seen_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

const PRESENCE_HEARTBEAT_MS = 60_000;
const CONSECUTIVE_FAILURE_LOG_THRESHOLD = 3;

export async function trackPresence(userId: string): Promise<() => void> {
  // Set online immediately
  await setOnlineStatus(userId, true);

  let consecutiveFailures = 0;

  const heartbeat = setInterval(() => {
    setOnlineStatus(userId, true)
      .then(() => {
        consecutiveFailures = 0;
      })
      .catch((err) => {
        consecutiveFailures++;
        if (consecutiveFailures >= CONSECUTIVE_FAILURE_LOG_THRESHOLD) {
          console.error(
            `[Presence] heartbeat failed ${consecutiveFailures} times in a row`,
            err?.message ?? err,
          );
        }
      });
  }, PRESENCE_HEARTBEAT_MS);

  // Return cleanup function
  return () => {
    clearInterval(heartbeat);
    setOnlineStatus(userId, false).catch(() => null);
  };
}
