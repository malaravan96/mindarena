import { supabase } from '@/lib/supabase';
import { grantXP } from '@/lib/xp';
import type { JigsawGridSize } from '@/lib/gameModes/jigsaw';

type ProfileSummary = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type JigsawRecordRow = {
  user_id: string;
  puzzle_key: string;
  grid_size: number;
  best_ms: number;
  best_moves: number;
  points_awarded: number;
};

type ShapeRecordRow = {
  user_id: string;
  level_key: string;
  best_ms: number;
  best_moves: number;
  points_awarded: number;
};

export type GameModeLeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bestMs: number;
  bestMoves: number;
};

export type PersonalBest = {
  bestMs: number;
  bestMoves: number;
};

export type SaveModeResult = {
  awardedRewards: boolean;
  improvedBest: boolean;
};

async function addProfilePoints(userId: string, amount: number) {
  const { data, error } = await supabase
    .from('profiles')
    .select('total_points')
    .eq('id', userId)
    .maybeSingle<{ total_points: number }>();

  if (error) throw error;

  const nextPoints = (data?.total_points ?? 0) + amount;
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ total_points: nextPoints })
    .eq('id', userId);

  if (updateError) throw updateError;
}

async function getProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ProfileSummary>();

  const { data } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);

  return new Map((data ?? []).map((profile) => [profile.id, profile as ProfileSummary]));
}

export async function getJigsawPersonalBest(userId: string, puzzleKey: string, gridSize: JigsawGridSize) {
  const { data, error } = await supabase
    .from('jigsaw_records')
    .select('best_ms, best_moves')
    .eq('user_id', userId)
    .eq('puzzle_key', puzzleKey)
    .eq('grid_size', gridSize)
    .maybeSingle<Pick<JigsawRecordRow, 'best_ms' | 'best_moves'>>();

  if (error || !data) return null;

  return {
    bestMs: data.best_ms,
    bestMoves: data.best_moves,
  } satisfies PersonalBest;
}

export async function getJigsawLeaderboard(puzzleKey: string, gridSize: JigsawGridSize) {
  const { data } = await supabase
    .from('jigsaw_records')
    .select('user_id, best_ms, best_moves')
    .eq('puzzle_key', puzzleKey)
    .eq('grid_size', gridSize)
    .order('best_ms', { ascending: true })
    .order('best_moves', { ascending: true })
    .limit(10);

  const rows = (data ?? []) as Pick<JigsawRecordRow, 'user_id' | 'best_ms' | 'best_moves'>[];
  const profiles = await getProfilesByIds(rows.map((row) => row.user_id));

  return rows.map((row, index) => {
    const profile = profiles.get(row.user_id);
    return {
      rank: index + 1,
      userId: row.user_id,
      username: profile?.username ?? 'player',
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      bestMs: row.best_ms,
      bestMoves: row.best_moves,
    } satisfies GameModeLeaderboardEntry;
  });
}

export async function saveJigsawCompletion(params: {
  userId: string;
  puzzleKey: string;
  gridSize: JigsawGridSize;
  ms: number;
  moves: number;
  points: number;
  xp: number;
}) {
  const { userId, puzzleKey, gridSize, ms, moves, points, xp } = params;

  const { data, error } = await supabase
    .from('jigsaw_records')
    .select('user_id, puzzle_key, grid_size, best_ms, best_moves, points_awarded')
    .eq('user_id', userId)
    .eq('puzzle_key', puzzleKey)
    .eq('grid_size', gridSize)
    .maybeSingle<JigsawRecordRow>();

  if (error) throw error;

  if (!data) {
    const { error: insertError } = await supabase.from('jigsaw_records').insert({
      user_id: userId,
      puzzle_key: puzzleKey,
      grid_size: gridSize,
      best_ms: ms,
      best_moves: moves,
      points_awarded: points,
    });

    if (insertError) throw insertError;

    await addProfilePoints(userId, points);
    await grantXP(userId, xp, `jigsaw:${puzzleKey}:${gridSize}`);

    return {
      awardedRewards: true,
      improvedBest: true,
    } satisfies SaveModeResult;
  }

  if (ms < data.best_ms || (ms === data.best_ms && moves < data.best_moves)) {
    const { error: updateError } = await supabase
      .from('jigsaw_records')
      .update({ best_ms: ms, best_moves: moves, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('puzzle_key', puzzleKey)
      .eq('grid_size', gridSize);

    if (updateError) throw updateError;

    return {
      awardedRewards: false,
      improvedBest: true,
    } satisfies SaveModeResult;
  }

  return {
    awardedRewards: false,
    improvedBest: false,
  } satisfies SaveModeResult;
}

export async function getShapePuzzlePersonalBest(userId: string, levelKey: string) {
  const { data, error } = await supabase
    .from('shape_puzzle_records')
    .select('best_ms, best_moves')
    .eq('user_id', userId)
    .eq('level_key', levelKey)
    .maybeSingle<Pick<ShapeRecordRow, 'best_ms' | 'best_moves'>>();

  if (error || !data) return null;

  return {
    bestMs: data.best_ms,
    bestMoves: data.best_moves,
  } satisfies PersonalBest;
}

export async function getShapePuzzleLeaderboard(levelKey: string) {
  const { data } = await supabase
    .from('shape_puzzle_records')
    .select('user_id, best_ms, best_moves')
    .eq('level_key', levelKey)
    .order('best_ms', { ascending: true })
    .order('best_moves', { ascending: true })
    .limit(10);

  const rows = (data ?? []) as Pick<ShapeRecordRow, 'user_id' | 'best_ms' | 'best_moves'>[];
  const profiles = await getProfilesByIds(rows.map((row) => row.user_id));

  return rows.map((row, index) => {
    const profile = profiles.get(row.user_id);
    return {
      rank: index + 1,
      userId: row.user_id,
      username: profile?.username ?? 'player',
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      bestMs: row.best_ms,
      bestMoves: row.best_moves,
    } satisfies GameModeLeaderboardEntry;
  });
}

export async function saveShapePuzzleCompletion(params: {
  userId: string;
  levelKey: string;
  ms: number;
  moves: number;
  points: number;
  xp: number;
}) {
  const { userId, levelKey, ms, moves, points, xp } = params;

  const { data, error } = await supabase
    .from('shape_puzzle_records')
    .select('user_id, level_key, best_ms, best_moves, points_awarded')
    .eq('user_id', userId)
    .eq('level_key', levelKey)
    .maybeSingle<ShapeRecordRow>();

  if (error) throw error;

  if (!data) {
    const { error: insertError } = await supabase.from('shape_puzzle_records').insert({
      user_id: userId,
      level_key: levelKey,
      best_ms: ms,
      best_moves: moves,
      points_awarded: points,
    });

    if (insertError) throw insertError;

    await addProfilePoints(userId, points);
    await grantXP(userId, xp, `shape_puzzle:${levelKey}`);

    return {
      awardedRewards: true,
      improvedBest: true,
    } satisfies SaveModeResult;
  }

  if (ms < data.best_ms || (ms === data.best_ms && moves < data.best_moves)) {
    const { error: updateError } = await supabase
      .from('shape_puzzle_records')
      .update({ best_ms: ms, best_moves: moves, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('level_key', levelKey);

    if (updateError) throw updateError;

    return {
      awardedRewards: false,
      improvedBest: true,
    } satisfies SaveModeResult;
  }

  return {
    awardedRewards: false,
    improvedBest: false,
  } satisfies SaveModeResult;
}
