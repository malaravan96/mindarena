import { supabase } from '@/lib/supabase';
import { grantXP } from '@/lib/xp';
import type { CategoryMastery } from '@/lib/types';
import type { PuzzleType } from '@/lib/puzzles';

const PUZZLES_PER_LEVEL = 20;
const MAX_LEVEL = 5;

export const MASTERY_CATEGORIES: { type: PuzzleType; label: string }[] = [
  { type: 'pattern', label: 'Pattern' },
  { type: 'logic', label: 'Logic' },
  { type: 'math', label: 'Math' },
  { type: 'word', label: 'Word' },
  { type: 'memory', label: 'Memory' },
  { type: 'visual', label: 'Visual' },
  { type: 'spatial', label: 'Spatial' },
  { type: 'trivia', label: 'Trivia' },
];

export async function getUserMastery(userId: string): Promise<CategoryMastery[]> {
  const { data } = await supabase
    .from('category_mastery')
    .select('*')
    .eq('user_id', userId);

  return (data ?? []) as CategoryMastery[];
}

export async function incrementCategoryProgress(
  userId: string,
  category: string,
): Promise<{ leveledUp: boolean; newLevel: number }> {
  // Get or create mastery record
  const { data: existing } = await supabase
    .from('category_mastery')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .maybeSingle<CategoryMastery>();

  let currentCompleted = existing?.puzzles_completed ?? 0;
  let currentLevel = existing?.current_level ?? 0;

  currentCompleted += 1;
  const newLevel = Math.min(Math.floor(currentCompleted / PUZZLES_PER_LEVEL), MAX_LEVEL);
  const leveledUp = newLevel > currentLevel;

  if (existing) {
    await supabase
      .from('category_mastery')
      .update({
        puzzles_completed: currentCompleted,
        current_level: newLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('category_mastery').insert({
      user_id: userId,
      category,
      puzzles_completed: 1,
      current_level: newLevel,
    });
  }

  if (leveledUp) {
    await grantXP(userId, 50 * newLevel, `category_mastery:${category}:${newLevel}`);
  }

  return { leveledUp, newLevel };
}

export function getMasteryProgress(completed: number): { level: number; progress: number; puzzlesInLevel: number } {
  const level = Math.min(Math.floor(completed / PUZZLES_PER_LEVEL), MAX_LEVEL);
  const puzzlesInLevel = completed % PUZZLES_PER_LEVEL;
  const progress = level >= MAX_LEVEL ? 1 : puzzlesInLevel / PUZZLES_PER_LEVEL;
  return { level, progress, puzzlesInLevel };
}
