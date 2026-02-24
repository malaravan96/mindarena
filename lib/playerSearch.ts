import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type PlayerProfile = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'total_points' | 'streak_count'> & {
  is_online?: boolean;
  level?: number;
  title?: string;
};

export async function searchPlayers(query: string, limit = 20): Promise<PlayerProfile[]> {
  if (!query.trim()) return [];

  const searchTerm = `%${query.trim()}%`;

  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, total_points, streak_count, is_online, level, title')
    .or(`username.ilike.${searchTerm},display_name.ilike.${searchTerm}`)
    .order('total_points', { ascending: false })
    .limit(limit);

  return (data ?? []) as PlayerProfile[];
}

export async function getPlayerProfile(userId: string): Promise<PlayerProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, total_points, streak_count, is_online, level, title')
    .eq('id', userId)
    .maybeSingle<PlayerProfile>();

  return data ?? null;
}

export async function getOnlinePlayers(limit = 30): Promise<PlayerProfile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, total_points, streak_count, is_online, level, title')
    .eq('is_online', true)
    .order('total_points', { ascending: false })
    .limit(limit);

  return (data ?? []) as PlayerProfile[];
}
