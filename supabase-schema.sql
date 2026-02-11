-- ============================================================
-- MindArena - Complete Database Schema (Drop & Recreate)
--
-- HOW TO USE:
-- 1. Go to Supabase Dashboard > SQL Editor > New Query
-- 2. Paste this ENTIRE file
-- 3. Click "Run"
--
-- This script is safe to run multiple times.
-- It drops everything first, then recreates from scratch.
-- ============================================================


-- ============================================================
-- STEP 1: DROP EVERYTHING (order matters - children first)
-- ============================================================

-- Drop triggers first (they depend on functions and tables)
DROP TRIGGER IF EXISTS update_stats_after_attempt ON public.attempts;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop views
DROP VIEW IF EXISTS public.leaderboard;

-- Drop policies on attempts
DO $$ BEGIN
  DROP POLICY IF EXISTS "attempts_select_all" ON public.attempts;
  DROP POLICY IF EXISTS "attempts_insert_own" ON public.attempts;
  DROP POLICY IF EXISTS "attempts_no_update" ON public.attempts;
  DROP POLICY IF EXISTS "attempts_no_delete" ON public.attempts;
  DROP POLICY IF EXISTS "attempts_select_public_leaderboard" ON public.attempts;
  DROP POLICY IF EXISTS "Users can view their own attempts" ON public.attempts;
  DROP POLICY IF EXISTS "Users can insert their own attempts" ON public.attempts;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Drop policies on puzzles
DO $$ BEGIN
  DROP POLICY IF EXISTS "puzzles_select_all" ON public.puzzles;
  DROP POLICY IF EXISTS "puzzles_read_all" ON public.puzzles;
  DROP POLICY IF EXISTS "Puzzles are viewable by everyone" ON public.puzzles;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Drop policies on profiles
DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_upsert_own" ON public.profiles;
  DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
  DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Drop tables (attempts first because it references puzzles and users)
DROP TABLE IF EXISTS public.attempts CASCADE;
DROP TABLE IF EXISTS public.puzzles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_stats_after_attempt() CASCADE;


-- ============================================================
-- STEP 2: CREATE TABLES
-- ============================================================

-- 2a) PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  total_points INTEGER DEFAULT 0,
  streak_count INTEGER DEFAULT 0,
  last_puzzle_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2b) PUZZLES
CREATE TABLE public.puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('logic', 'pattern', 'math', 'reasoning')),
  options TEXT[] NOT NULL,
  answer_index INTEGER NOT NULL CHECK (answer_index >= 0),
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  points INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2c) ATTEMPTS
CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id UUID NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
  selected_index INTEGER NOT NULL CHECK (selected_index >= 0),
  is_correct BOOLEAN NOT NULL,
  ms_taken INTEGER NOT NULL CHECK (ms_taken >= 0),
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, puzzle_id)
);


-- ============================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 4: CREATE RLS POLICIES
-- ============================================================

-- Profiles: everyone can view, users can insert/update their own
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Puzzles: everyone can read
CREATE POLICY "puzzles_select_all" ON public.puzzles
  FOR SELECT USING (true);

-- Attempts: everyone can SELECT (needed for leaderboard), only own INSERT
CREATE POLICY "attempts_select_all" ON public.attempts
  FOR SELECT USING (true);

CREATE POLICY "attempts_insert_own" ON public.attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attempts_no_update" ON public.attempts
  FOR UPDATE USING (false);

CREATE POLICY "attempts_no_delete" ON public.attempts
  FOR DELETE USING (false);


-- ============================================================
-- STEP 5: CREATE INDEXES
-- ============================================================

CREATE INDEX idx_puzzles_date_key ON public.puzzles(date_key);
CREATE INDEX idx_attempts_puzzle_correct_time ON public.attempts(puzzle_id, is_correct, ms_taken);
CREATE INDEX idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX idx_attempts_created_at ON public.attempts(created_at DESC);
CREATE INDEX idx_profiles_total_points ON public.profiles(total_points DESC);


-- ============================================================
-- STEP 6: CREATE FUNCTIONS
-- ============================================================

-- 6a) Auto-update updated_at on profile changes
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6b) Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'user_' || substr(NEW.id::text, 1, 8)
    ),
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6c) Auto-update points & streak when an attempt is inserted
CREATE OR REPLACE FUNCTION public.update_user_stats_after_attempt()
RETURNS TRIGGER AS $$
DECLARE
  puzzle_points INTEGER;
  today_date DATE;
BEGIN
  SELECT points INTO puzzle_points
  FROM public.puzzles
  WHERE id = NEW.puzzle_id;

  today_date := CURRENT_DATE;

  IF NEW.is_correct THEN
    UPDATE public.profiles
    SET
      total_points = total_points + COALESCE(puzzle_points, 100),
      streak_count = CASE
        WHEN last_puzzle_date = today_date - INTERVAL '1 day' THEN streak_count + 1
        WHEN last_puzzle_date = today_date THEN streak_count
        ELSE 1
      END,
      last_puzzle_date = today_date,
      updated_at = NOW()
    WHERE id = NEW.user_id;

    NEW.points_earned := COALESCE(puzzle_points, 100);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- STEP 7: CREATE TRIGGERS
-- ============================================================

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_stats_after_attempt
  BEFORE INSERT ON public.attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_after_attempt();


-- ============================================================
-- STEP 8: SEED DATA (7 days of puzzles)
-- ============================================================

INSERT INTO public.puzzles (date_key, title, prompt, type, options, answer_index, difficulty, points)
VALUES
  (
    '2026-02-10',
    'Pattern Recognition',
    'What comes next in the sequence? 3, 6, 12, 24, ?',
    'pattern',
    ARRAY['27', '36', '48', '60'],
    2,
    'easy',
    100
  ),
  (
    '2026-02-11',
    'Logic Challenge',
    'If all Bloops are Razzies and all Razzies are Lazzies, are all Bloops definitely Lazzies?',
    'logic',
    ARRAY['Yes', 'No', 'Cannot be determined', 'Only sometimes'],
    0,
    'medium',
    100
  ),
  (
    '2026-02-12',
    'Quick Math',
    'Solve: (15 x 4) - (20 / 5) = ?',
    'math',
    ARRAY['52', '56', '60', '64'],
    1,
    'easy',
    100
  ),
  (
    '2026-02-13',
    'Number Sequence',
    'What is the next number? 1, 1, 2, 3, 5, 8, ?',
    'pattern',
    ARRAY['10', '11', '13', '15'],
    2,
    'medium',
    150
  ),
  (
    '2026-02-14',
    'Deductive Reasoning',
    'A is taller than B. C is shorter than B. D is taller than A. Who is the shortest?',
    'logic',
    ARRAY['A', 'B', 'C', 'D'],
    2,
    'medium',
    150
  ),
  (
    '2026-02-15',
    'Arithmetic',
    'If x + 7 = 15 and y = 2x, what is y?',
    'math',
    ARRAY['14', '16', '18', '20'],
    1,
    'easy',
    100
  ),
  (
    '2026-02-16',
    'Pattern Match',
    'Complete the pattern: AB, CD, EF, ?',
    'pattern',
    ARRAY['FG', 'GH', 'HI', 'IJ'],
    1,
    'easy',
    100
  );


-- ============================================================
-- DONE! You should see "Success. No rows returned" in Supabase.
-- ============================================================
