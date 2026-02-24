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

export async function trackPresence(userId: string): Promise<() => void> {
  // Set online immediately
  await setOnlineStatus(userId, true);

  // Heartbeat every 60 seconds
  const heartbeat = setInterval(() => {
    setOnlineStatus(userId, true).catch(() => null);
  }, 60000);

  // Return cleanup function
  return () => {
    clearInterval(heartbeat);
    setOnlineStatus(userId, false).catch(() => null);
  };
}
