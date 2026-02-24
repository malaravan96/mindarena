import { supabase } from '@/lib/supabase';
import type { XPLevel } from '@/lib/types';

let cachedLevels: XPLevel[] | null = null;

export async function getXPLevels(): Promise<XPLevel[]> {
  if (cachedLevels) return cachedLevels;

  const { data, error } = await supabase
    .from('xp_levels')
    .select('level, xp_required, title')
    .order('level', { ascending: true });

  if (error || !data) return getDefaultLevels();
  cachedLevels = data as XPLevel[];
  return cachedLevels;
}

export function getXPForLevel(level: number): number {
  const defaults = getDefaultLevels();
  const entry = defaults.find((l) => l.level === level);
  return entry?.xp_required ?? level * level * 100;
}

export async function getCurrentLevelProgress(userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, level')
    .eq('id', userId)
    .maybeSingle<{ xp: number; level: number }>();

  if (!profile) return { level: 1, xp: 0, xpForCurrent: 0, xpForNext: 100, progress: 0, title: 'Newcomer' };

  const levels = await getXPLevels();
  const current = levels.find((l) => l.level === profile.level) ?? levels[0];
  const next = levels.find((l) => l.level === profile.level + 1);

  const xpForCurrent = current.xp_required;
  const xpForNext = next?.xp_required ?? current.xp_required + 10000;
  const xpInLevel = profile.xp - xpForCurrent;
  const xpNeeded = xpForNext - xpForCurrent;
  const progress = xpNeeded > 0 ? Math.min(xpInLevel / xpNeeded, 1) : 1;

  return {
    level: profile.level,
    xp: profile.xp,
    xpForCurrent,
    xpForNext,
    progress,
    title: current.title,
  };
}

export async function grantXP(userId: string, amount: number, source: string): Promise<{ leveledUp: boolean; newLevel: number; newTitle: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, level')
    .eq('id', userId)
    .maybeSingle<{ xp: number; level: number }>();

  if (!profile) return { leveledUp: false, newLevel: 1, newTitle: 'Newcomer' };

  const newXP = profile.xp + amount;
  const levels = await getXPLevels();

  let newLevel = profile.level;
  let newTitle = levels.find((l) => l.level === profile.level)?.title ?? 'Newcomer';

  for (const lvl of levels) {
    if (lvl.level > profile.level && newXP >= lvl.xp_required) {
      newLevel = lvl.level;
      newTitle = lvl.title;
    }
  }

  const leveledUp = newLevel > profile.level;

  await supabase
    .from('profiles')
    .update({ xp: newXP, level: newLevel, title: newTitle })
    .eq('id', userId);

  // Grant title on level up
  if (leveledUp) {
    await supabase.from('user_titles').upsert(
      { user_id: userId, title: newTitle, source: 'level' },
      { onConflict: 'user_id,title' },
    );
  }

  return { leveledUp, newLevel, newTitle };
}

function getDefaultLevels(): XPLevel[] {
  const levels: XPLevel[] = [];
  const titles = [
    'Newcomer', 'Thinker', 'Solver', 'Analyst', 'Strategist',
    'Sharp Mind', 'Quick Wit', 'Brain Trainer', 'Puzzle Adept', 'Logic Master',
  ];
  for (let i = 1; i <= 50; i++) {
    levels.push({
      level: i,
      xp_required: Math.floor(i === 1 ? 0 : 50 * i * i),
      title: titles[Math.min(i - 1, titles.length - 1)],
    });
  }
  return levels;
}
