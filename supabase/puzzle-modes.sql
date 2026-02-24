-- ============================================================
-- MindArena - Puzzle Modes Schema
-- Run AFTER rewards-progression.sql
-- ============================================================

-- ── 1. Add mode column to puzzles ───────────────────────────
ALTER TABLE public.puzzles
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'daily'
    CHECK (mode IN ('daily', 'timed', 'streak', 'practice', 'tournament', 'duel', 'weekly_challenge'));

-- Drop the strict unique on date_key (only enforce for daily mode)
-- First check if the constraint exists before dropping
DO $$ BEGIN
  ALTER TABLE public.puzzles DROP CONSTRAINT IF EXISTS puzzles_date_key_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Create partial unique index for daily puzzles only
CREATE UNIQUE INDEX IF NOT EXISTS idx_puzzles_daily_date_key
  ON public.puzzles(date_key)
  WHERE mode = 'daily';

-- ── 2. Timed Challenge Sessions ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.timed_challenge_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds IN (180, 300, 600)),
  puzzles_solved INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.timed_challenge_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "timed_sessions_select_own" ON public.timed_challenge_sessions
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "timed_sessions_insert_own" ON public.timed_challenge_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "timed_sessions_update_own" ON public.timed_challenge_sessions
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Puzzle Streak Sessions ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.puzzle_streak_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_length INTEGER DEFAULT 0,
  max_difficulty_reached TEXT DEFAULT 'easy',
  total_score INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.puzzle_streak_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "streak_sessions_select_own" ON public.puzzle_streak_sessions
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "streak_sessions_insert_own" ON public.puzzle_streak_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "streak_sessions_update_own" ON public.puzzle_streak_sessions
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. Category Mastery ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.category_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  puzzles_completed INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

ALTER TABLE public.category_mastery ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "category_mastery_select_own" ON public.category_mastery
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "category_mastery_insert_own" ON public.category_mastery
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "category_mastery_update_own" ON public.category_mastery
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. Weekly Challenges ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  theme TEXT NOT NULL,
  point_multiplier NUMERIC(3,1) DEFAULT 1.5,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "weekly_challenges_select_all" ON public.weekly_challenges
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_timed_sessions_user ON public.timed_challenge_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_timed_sessions_score ON public.timed_challenge_sessions(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_streak_sessions_user ON public.puzzle_streak_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_streak_sessions_length ON public.puzzle_streak_sessions(streak_length DESC);
CREATE INDEX IF NOT EXISTS idx_category_mastery_user ON public.category_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_puzzles_mode ON public.puzzles(mode);
