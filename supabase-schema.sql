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
  type TEXT NOT NULL CHECK (
    type IN ('logic', 'pattern', 'math', 'reasoning', 'word', 'memory', 'visual', 'spatial', 'trivia')
  ),
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
-- STEP 7.5: CREATE STORAGE BUCKETS + POLICIES
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$ BEGIN
  CREATE POLICY "avatars_select_public" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_insert_own" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'avatars'
      AND auth.role() = 'authenticated'
      AND name LIKE auth.uid()::text || '/%'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_update_own" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'avatars'
      AND name LIKE auth.uid()::text || '/%'
    )
    WITH CHECK (
      bucket_id = 'avatars'
      AND name LIKE auth.uid()::text || '/%'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "avatars_delete_own" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'avatars'
      AND name LIKE auth.uid()::text || '/%'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- STEP 8: SEED DATA (current 14-day window)
-- ============================================================

INSERT INTO public.puzzles (date_key, title, prompt, type, options, answer_index, difficulty, points)
VALUES
  (
    '2026-02-21',
    'Growing Gaps',
    'What comes next in the sequence? 2, 6, 12, 20, ?',
    'pattern',
    ARRAY['28', '30', '32', '34'],
    1,
    'easy',
    100
  ),
  (
    '2026-02-22',
    'Set Logic',
    'All Zorps are Kems. Some Kems are Dars. Can we conclude that some Zorps are Dars?',
    'logic',
    ARRAY['Yes', 'No', 'Cannot be determined', 'Only if all Kems are Zorps'],
    2,
    'medium',
    120
  ),
  (
    '2026-02-23',
    'Mental Arithmetic',
    'Solve: (18 / 3) + (7 * 4) = ?',
    'math',
    ARRAY['30', '32', '34', '36'],
    2,
    'easy',
    100
  ),
  (
    '2026-02-24',
    'Word Sense',
    'Choose the closest synonym for "scarce".',
    'word',
    ARRAY['Plentiful', 'Rare', 'Simple', 'Obvious'],
    1,
    'easy',
    100
  ),
  (
    '2026-02-25',
    'Sequence Recall',
    'You see this sequence once: 9, 1, 4, 7, 2. What was the 4th number?',
    'memory',
    ARRAY['1', '4', '7', '2'],
    2,
    'medium',
    120
  ),
  (
    '2026-02-26',
    'Odd Shape',
    'Which option is not a polygon?',
    'visual',
    ARRAY['Triangle', 'Square', 'Pentagon', 'Circle'],
    3,
    'easy',
    100
  ),
  (
    '2026-02-27',
    'Direction Turn',
    'An arrow points north. Rotate it 90 degrees clockwise. Where does it point?',
    'spatial',
    ARRAY['North', 'East', 'South', 'West'],
    1,
    'easy',
    100
  ),
  (
    '2026-02-28',
    'Brain Fact',
    'Which brain structure is most associated with forming new memories?',
    'trivia',
    ARRAY['Cerebellum', 'Hippocampus', 'Medulla', 'Occipital lobe'],
    1,
    'medium',
    120
  ),
  (
    '2026-03-01',
    'Conditional Reasoning',
    'Every pilot is trained. No untrained person can fly. Can an untrained person be a pilot?',
    'reasoning',
    ARRAY['Yes', 'No', 'Only in emergencies', 'Cannot be determined'],
    1,
    'medium',
    130
  ),
  (
    '2026-03-02',
    'Square Pattern',
    'Find the next number: 1, 4, 9, 16, ?',
    'pattern',
    ARRAY['20', '24', '25', '27'],
    2,
    'easy',
    100
  ),
  (
    '2026-03-03',
    'Order Logic',
    'If A is taller than B, B is taller than C, and C is taller than D, who is tallest?',
    'logic',
    ARRAY['A', 'B', 'C', 'D'],
    0,
    'easy',
    100
  ),
  (
    '2026-03-04',
    'Percent Quickie',
    'What is 40% of 90?',
    'math',
    ARRAY['32', '34', '36', '38'],
    2,
    'easy',
    100
  ),
  (
    '2026-03-05',
    'Analogy',
    'Book is to reading as fork is to ____.',
    'word',
    ARRAY['writing', 'eating', 'drawing', 'sleeping'],
    1,
    'easy',
    100
  ),
  (
    '2026-03-06',
    'Color Recall',
    'Remember this order: Blue, Red, Green, Blue, Yellow. Which color came right after Green?',
    'memory',
    ARRAY['Red', 'Blue', 'Yellow', 'Green'],
    1,
    'medium',
    120
  );


-- ============================================================
-- DONE! You should see "Success. No rows returned" in Supabase.
-- ============================================================
