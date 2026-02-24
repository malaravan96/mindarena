-- ============================================================
-- MindArena - Activity Feed & Social Schema
-- Run AFTER tournaments.sql
-- ============================================================

-- ── 1. Activity Feed ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'puzzle_solved', 'badge_earned', 'level_up', 'streak_milestone',
    'tournament_win', 'duel_completed', 'team_joined'
  )),
  metadata JSONB NOT NULL DEFAULT '{}',
  visibility TEXT DEFAULT 'friends' CHECK (visibility IN ('public', 'friends')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "activity_feed_select_all" ON public.activity_feed
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "activity_feed_insert_own" ON public.activity_feed
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Puzzle Duels ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.puzzle_duels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id UUID REFERENCES public.puzzles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'declined')),
  challenger_ms INTEGER,
  opponent_ms INTEGER,
  challenger_correct BOOLEAN,
  opponent_correct BOOLEAN,
  winner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.puzzle_duels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "puzzle_duels_select_own" ON public.puzzle_duels
    FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "puzzle_duels_insert_own" ON public.puzzle_duels
    FOR INSERT WITH CHECK (auth.uid() = challenger_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "puzzle_duels_update_own" ON public.puzzle_duels
    FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Presence columns on profiles ─────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- ── 4. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON public.activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON public.activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_type ON public.activity_feed(event_type);
CREATE INDEX IF NOT EXISTS idx_puzzle_duels_challenger ON public.puzzle_duels(challenger_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_duels_opponent ON public.puzzle_duels(opponent_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_duels_status ON public.puzzle_duels(status);
CREATE INDEX IF NOT EXISTS idx_profiles_online ON public.profiles(is_online) WHERE is_online = true;
