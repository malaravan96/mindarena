-- MindArena - Jigsaw and Pieces Shape Puzzle records

CREATE TABLE IF NOT EXISTS public.jigsaw_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_key TEXT NOT NULL,
  grid_size INTEGER NOT NULL CHECK (grid_size IN (4, 5)),
  best_ms INTEGER NOT NULL CHECK (best_ms >= 0),
  best_moves INTEGER NOT NULL CHECK (best_moves >= 0),
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, puzzle_key, grid_size)
);

CREATE TABLE IF NOT EXISTS public.shape_puzzle_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level_key TEXT NOT NULL,
  best_ms INTEGER NOT NULL CHECK (best_ms >= 0),
  best_moves INTEGER NOT NULL CHECK (best_moves >= 0),
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, level_key)
);

ALTER TABLE public.jigsaw_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shape_puzzle_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "jigsaw_records_select_all" ON public.jigsaw_records
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "jigsaw_records_insert_own" ON public.jigsaw_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "jigsaw_records_update_own" ON public.jigsaw_records
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "shape_puzzle_records_select_all" ON public.shape_puzzle_records
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "shape_puzzle_records_insert_own" ON public.shape_puzzle_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "shape_puzzle_records_update_own" ON public.shape_puzzle_records
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_jigsaw_records_leaderboard
  ON public.jigsaw_records (puzzle_key, grid_size, best_ms, best_moves);

CREATE INDEX IF NOT EXISTS idx_shape_puzzle_records_leaderboard
  ON public.shape_puzzle_records (level_key, best_ms, best_moves);
