import { supabase } from '@/lib/supabase';
import type { AvatarFrame } from '@/lib/types';

export async function getAllFrames(): Promise<AvatarFrame[]> {
  const { data } = await supabase
    .from('avatar_frames')
    .select('*')
    .order('unlock_level', { ascending: true });

  return (data ?? []) as AvatarFrame[];
}

export async function getUnlockedFrames(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('user_avatar_frames')
    .select('frame_id')
    .eq('user_id', userId);

  const unlocked = (data ?? []).map((f) => f.frame_id);
  // Default frame is always unlocked
  if (!unlocked.includes('default')) unlocked.push('default');
  return unlocked;
}

export async function unlockFramesForLevel(userId: string, level: number): Promise<string[]> {
  const allFrames = await getAllFrames();
  const unlocked = await getUnlockedFrames(userId);
  const unlockedSet = new Set(unlocked);
  const newlyUnlocked: string[] = [];

  for (const frame of allFrames) {
    if (frame.unlock_level <= level && !unlockedSet.has(frame.id)) {
      const { error } = await supabase.from('user_avatar_frames').insert({
        user_id: userId,
        frame_id: frame.id,
      });
      if (!error) newlyUnlocked.push(frame.id);
    }
  }

  return newlyUnlocked;
}

export async function equipFrame(userId: string, frameId: string): Promise<boolean> {
  const unlocked = await getUnlockedFrames(userId);
  if (!unlocked.includes(frameId)) return false;

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_frame: frameId })
    .eq('id', userId);

  return !error;
}

export async function getEquippedFrame(userId: string): Promise<AvatarFrame | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_frame')
    .eq('id', userId)
    .maybeSingle<{ avatar_frame: string }>();

  if (!profile?.avatar_frame) return null;

  const { data: frame } = await supabase
    .from('avatar_frames')
    .select('*')
    .eq('id', profile.avatar_frame)
    .maybeSingle<AvatarFrame>();

  return frame ?? null;
}
