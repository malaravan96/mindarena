-- ============================================================
-- MindArena - Rewards & Progression System Schema
-- Run this AFTER the base schema (supabase-schema.sql)
-- ============================================================

-- ── 1. Alter profiles table ─────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Newcomer',
  ADD COLUMN IF NOT EXISTS avatar_frame TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS login_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_date DATE;

-- ── 2. XP Levels table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.xp_levels (
  level INTEGER PRIMARY KEY,
  xp_required INTEGER NOT NULL,
  title TEXT NOT NULL
);

-- Seed 50 levels
INSERT INTO public.xp_levels (level, xp_required, title) VALUES
  (1, 0, 'Newcomer'),
  (2, 100, 'Thinker'),
  (3, 250, 'Solver'),
  (4, 450, 'Analyst'),
  (5, 700, 'Strategist'),
  (6, 1000, 'Sharp Mind'),
  (7, 1400, 'Quick Wit'),
  (8, 1900, 'Brain Trainer'),
  (9, 2500, 'Puzzle Adept'),
  (10, 3200, 'Logic Master'),
  (11, 4000, 'Pattern Seeker'),
  (12, 4900, 'Code Breaker'),
  (13, 5900, 'Mind Reader'),
  (14, 7000, 'Enigma Solver'),
  (15, 8200, 'Brainiac'),
  (16, 9500, 'Cerebral'),
  (17, 11000, 'Prodigy'),
  (18, 12700, 'Virtuoso'),
  (19, 14600, 'Sage'),
  (20, 16700, 'Oracle'),
  (21, 19000, 'Mastermind'),
  (22, 21500, 'Grandmaster'),
  (23, 24200, 'Elite Thinker'),
  (24, 27100, 'Genius'),
  (25, 30200, 'Luminary'),
  (26, 33500, 'Titan'),
  (27, 37000, 'Legend'),
  (28, 40700, 'Mythic Mind'),
  (29, 44600, 'Transcendent'),
  (30, 48700, 'Apex'),
  (31, 53000, 'Vanguard'),
  (32, 57500, 'Paragon'),
  (33, 62200, 'Ascendant'),
  (34, 67100, 'Sovereign'),
  (35, 72200, 'Infinite'),
  (36, 77500, 'Cosmic'),
  (37, 83000, 'Stellar'),
  (38, 88700, 'Celestial'),
  (39, 94600, 'Eternal'),
  (40, 100700, 'Omega'),
  (41, 107000, 'Omega+'),
  (42, 113500, 'Omega++'),
  (43, 120200, 'Ultra'),
  (44, 127100, 'Ultra+'),
  (45, 134200, 'Supreme'),
  (46, 141500, 'Supreme+'),
  (47, 149000, 'Pinnacle'),
  (48, 156700, 'Pinnacle+'),
  (49, 164600, 'Zenith'),
  (50, 172700, 'Zenith Master')
ON CONFLICT (level) DO NOTHING;

-- ── 3. Available Badges ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.available_badges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  category TEXT NOT NULL DEFAULT 'general',
  criteria JSONB NOT NULL DEFAULT '{}',
  xp_reward INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed 25+ badges (migrate existing 6 + add new ones)
INSERT INTO public.available_badges (id, title, description, icon, rarity, category, criteria, xp_reward) VALUES
  -- Original 6 badges (migrated from hardcoded)
  ('first-solve', 'First Solve', 'Solve your first puzzle', 'flag-outline', 'common', 'general', '{"type": "correct_count", "threshold": 1}', 25),
  ('five-streak', '5-Day Streak', 'Maintain a 5-day solving streak', 'flame-outline', 'uncommon', 'streak', '{"type": "streak", "threshold": 5}', 50),
  ('speed-demon', 'Speed Demon', 'Solve a puzzle in under 10 seconds', 'flash-outline', 'rare', 'speed', '{"type": "best_time_under", "threshold": 10000}', 75),
  ('ten-correct', 'Sharp Mind', 'Get 10 puzzles correct', 'bulb-outline', 'common', 'general', '{"type": "correct_count", "threshold": 10}', 50),
  ('perfectionist', 'Perfectionist', 'Achieve 100% accuracy on at least 5 attempts', 'diamond-outline', 'epic', 'accuracy', '{"type": "perfect_accuracy", "min_attempts": 5}', 100),
  ('dedicated', 'Dedicated', 'Attempt 20 puzzles', 'trophy-outline', 'uncommon', 'general', '{"type": "attempt_count", "threshold": 20}', 50),
  -- New progression badges
  ('level-5', 'Rising Star', 'Reach level 5', 'star-outline', 'common', 'progression', '{"type": "level", "threshold": 5}', 50),
  ('level-10', 'Double Digits', 'Reach level 10', 'star-half-outline', 'uncommon', 'progression', '{"type": "level", "threshold": 10}', 100),
  ('level-25', 'Quarter Century', 'Reach level 25', 'star', 'epic', 'progression', '{"type": "level", "threshold": 25}', 250),
  ('level-50', 'Max Level', 'Reach the maximum level', 'planet-outline', 'legendary', 'progression', '{"type": "level", "threshold": 50}', 500),
  -- Streak badges
  ('ten-streak', '10-Day Streak', 'Maintain a 10-day solving streak', 'flame', 'rare', 'streak', '{"type": "streak", "threshold": 10}', 100),
  ('thirty-streak', '30-Day Streak', 'Maintain a 30-day streak', 'bonfire-outline', 'epic', 'streak', '{"type": "streak", "threshold": 30}', 250),
  ('hundred-streak', '100-Day Streak', 'Maintain a 100-day streak', 'bonfire', 'legendary', 'streak', '{"type": "streak", "threshold": 100}', 500),
  -- Speed badges
  ('lightning', 'Lightning Fast', 'Solve a puzzle in under 5 seconds', 'thunderstorm-outline', 'epic', 'speed', '{"type": "best_time_under", "threshold": 5000}', 150),
  ('instant', 'Instant Genius', 'Solve a puzzle in under 3 seconds', 'flash', 'legendary', 'speed', '{"type": "best_time_under", "threshold": 3000}', 300),
  -- Volume badges
  ('fifty-correct', 'Half Century', 'Get 50 puzzles correct', 'ribbon-outline', 'uncommon', 'general', '{"type": "correct_count", "threshold": 50}', 100),
  ('hundred-correct', 'Century Club', 'Get 100 puzzles correct', 'medal-outline', 'rare', 'general', '{"type": "correct_count", "threshold": 100}', 200),
  ('five-hundred-correct', 'Puzzle Legend', 'Get 500 puzzles correct', 'medal', 'legendary', 'general', '{"type": "correct_count", "threshold": 500}', 500),
  -- Social badges
  ('first-friend', 'Social Butterfly', 'Make your first connection', 'people-outline', 'common', 'social', '{"type": "connection_count", "threshold": 1}', 25),
  ('ten-friends', 'Popular', 'Have 10 connections', 'people', 'uncommon', 'social', '{"type": "connection_count", "threshold": 10}', 75),
  -- Mode badges
  ('timed-master', 'Timed Master', 'Score 20+ in a timed challenge', 'timer-outline', 'rare', 'modes', '{"type": "timed_score", "threshold": 20}', 100),
  ('streak-warrior', 'Streak Warrior', 'Reach a 15-puzzle streak in Streak Mode', 'trending-up-outline', 'rare', 'modes', '{"type": "puzzle_streak", "threshold": 15}', 100),
  ('category-expert', 'Category Expert', 'Master any puzzle category', 'school-outline', 'epic', 'modes', '{"type": "category_mastery", "threshold": 1}', 150),
  -- XP badges
  ('xp-1000', 'XP Collector', 'Earn 1,000 total XP', 'sparkles-outline', 'common', 'xp', '{"type": "total_xp", "threshold": 1000}', 50),
  ('xp-10000', 'XP Hoarder', 'Earn 10,000 total XP', 'sparkles', 'rare', 'xp', '{"type": "total_xp", "threshold": 10000}', 200)
ON CONFLICT (id) DO NOTHING;

-- ── 4. User Achievements (earned badges) ────────────────────
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES public.available_badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "user_achievements_select_all" ON public.user_achievements
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_achievements_insert_own" ON public.user_achievements
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. User Titles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'level',
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, title)
);

ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "user_titles_select_all" ON public.user_titles
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_titles_insert_own" ON public.user_titles
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. Avatar Frames ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.avatar_frames (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  unlock_level INTEGER DEFAULT 1,
  border_color TEXT NOT NULL DEFAULT '#6366f1',
  border_width INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.avatar_frames (id, name, description, rarity, unlock_level, border_color, border_width) VALUES
  ('default', 'Default', 'The classic frame', 'common', 1, '#6366f1', 3),
  ('bronze', 'Bronze Ring', 'A warm bronze border', 'common', 5, '#cd7f32', 3),
  ('silver', 'Silver Ring', 'A sleek silver border', 'uncommon', 10, '#c0c0c0', 3),
  ('gold', 'Gold Ring', 'A prestigious gold border', 'rare', 15, '#ffd700', 4),
  ('emerald', 'Emerald Glow', 'A vibrant emerald border', 'rare', 20, '#50c878', 4),
  ('sapphire', 'Sapphire Aura', 'A deep sapphire border', 'epic', 25, '#0f52ba', 4),
  ('ruby', 'Ruby Flame', 'A fiery ruby border', 'epic', 30, '#e0115f', 4),
  ('diamond', 'Diamond Shine', 'A brilliant diamond border', 'legendary', 40, '#b9f2ff', 5),
  ('cosmic', 'Cosmic Halo', 'An otherworldly cosmic border', 'legendary', 50, '#7b2ff7', 5)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_avatar_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  frame_id TEXT NOT NULL REFERENCES public.avatar_frames(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, frame_id)
);

ALTER TABLE public.user_avatar_frames ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "user_avatar_frames_select_all" ON public.user_avatar_frames
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "user_avatar_frames_insert_own" ON public.user_avatar_frames
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 7. Daily Login Rewards ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_login_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_date DATE NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  xp_reward INTEGER NOT NULL DEFAULT 10,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, reward_date)
);

ALTER TABLE public.daily_login_rewards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "daily_login_rewards_select_own" ON public.daily_login_rewards
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "daily_login_rewards_insert_own" ON public.daily_login_rewards
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 8. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_badge ON public.user_achievements(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_titles_user ON public.user_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_avatar_frames_user ON public.user_avatar_frames(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_login_rewards_user ON public.daily_login_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles(level DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);

-- ── RLS for new reference tables ────────────────────────────
ALTER TABLE public.xp_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.available_badges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "xp_levels_select_all" ON public.xp_levels FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "avatar_frames_select_all" ON public.avatar_frames FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "available_badges_select_all" ON public.available_badges FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
