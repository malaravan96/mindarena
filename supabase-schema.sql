-- MindArena Database Schema
-- This file contains the SQL schema for Supabase tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
-- Stores user profile information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  total_points INTEGER DEFAULT 0,
  streak_count INTEGER DEFAULT 0,
  last_puzzle_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 20),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_-]+$')
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Puzzles table (already exists in your codebase)
CREATE TABLE IF NOT EXISTS public.puzzles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL,
  options TEXT[] NOT NULL,
  answer_index INTEGER NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  points INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (type IN ('logic', 'pattern', 'math', 'reasoning'))
);

-- Enable Row Level Security for puzzles
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Puzzles are viewable by everyone"
  ON public.puzzles FOR SELECT
  USING (true);

-- Attempts table (already exists in your codebase)
CREATE TABLE IF NOT EXISTS public.attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id UUID NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
  selected_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  ms_taken INTEGER NOT NULL,
  points_earned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, puzzle_id)
);

-- Enable Row Level Security for attempts
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attempts"
  ON public.attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attempts"
  ON public.attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_total_points ON public.profiles(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_puzzles_date_key ON public.puzzles(date_key);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_puzzle_id ON public.attempts(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_attempts_created_at ON public.attempts(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile automatically on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update user stats after completing a puzzle
CREATE OR REPLACE FUNCTION public.update_user_stats_after_attempt()
RETURNS TRIGGER AS $$
DECLARE
  puzzle_points INTEGER;
  today_date DATE;
BEGIN
  -- Get the puzzle points
  SELECT points INTO puzzle_points
  FROM public.puzzles
  WHERE id = NEW.puzzle_id;

  -- Get today's date
  today_date := CURRENT_DATE;

  -- Update profile stats only if answer is correct
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

    -- Update the attempt with points earned
    NEW.points_earned := COALESCE(puzzle_points, 100);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update stats after attempt
DROP TRIGGER IF EXISTS update_stats_after_attempt ON public.attempts;
CREATE TRIGGER update_stats_after_attempt
  BEFORE INSERT ON public.attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_stats_after_attempt();

-- View for leaderboard
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.total_points,
  p.streak_count,
  COUNT(a.id) as total_attempts,
  COUNT(CASE WHEN a.is_correct THEN 1 END) as correct_attempts,
  ROW_NUMBER() OVER (ORDER BY p.total_points DESC, p.streak_count DESC) as rank
FROM public.profiles p
LEFT JOIN public.attempts a ON p.id = a.user_id
GROUP BY p.id, p.username, p.display_name, p.avatar_url, p.total_points, p.streak_count
ORDER BY p.total_points DESC, p.streak_count DESC;

-- Grant permissions
GRANT SELECT ON public.leaderboard TO authenticated;
GRANT SELECT ON public.leaderboard TO anon;
