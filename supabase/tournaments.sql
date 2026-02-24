-- ============================================================
-- MindArena - Tournament System Schema
-- Run AFTER puzzle-modes.sql
-- ============================================================

-- ── 1. Tournaments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'points' CHECK (type IN ('elimination', 'points')),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  max_participants INTEGER DEFAULT 100,
  participant_count INTEGER DEFAULT 0,
  entry_fee INTEGER DEFAULT 0,
  prize_xp INTEGER DEFAULT 500,
  prize_title TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tournaments_select_all" ON public.tournaments
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Tournament Participants ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_score INTEGER DEFAULT 0,
  rounds_completed INTEGER DEFAULT 0,
  eliminated BOOLEAN DEFAULT false,
  final_rank INTEGER,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tournament_participants_select_all" ON public.tournament_participants
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "tournament_participants_insert_own" ON public.tournament_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "tournament_participants_update_own" ON public.tournament_participants
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Tournament Rounds ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  puzzle_id UUID REFERENCES public.puzzles(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  UNIQUE(tournament_id, round_number)
);

ALTER TABLE public.tournament_rounds ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tournament_rounds_select_all" ON public.tournament_rounds
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. Tournament Attempts ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.tournament_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  ms_taken INTEGER NOT NULL,
  score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(round_id, user_id)
);

ALTER TABLE public.tournament_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tournament_attempts_select_all" ON public.tournament_attempts
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

 CREATE TABLE IF NOT EXISTS public.tournament_attempts (                                                                                          
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES public.tournament_rounds(id) ON DELETE CASCADE,                                                                  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,                                                                             
    selected_index INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    ms_taken INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(round_id, user_id)
  );

  ALTER TABLE public.tournament_attempts ENABLE ROW LEVEL SECURITY;

  Then run the rest:

  DO $$ BEGIN
    CREATE POLICY "tournament_attempts_select_all" ON public.tournament_attempts
      FOR SELECT USING (true);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  DO $$ BEGIN
    CREATE POLICY "tournament_attempts_insert_own" ON public.tournament_attempts
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);
  CREATE INDEX IF NOT EXISTS idx_tournaments_starts ON public.tournaments(starts_at);
  CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON public.tournament_participants(tournament_id);
  CREATE INDEX IF NOT EXISTS idx_tournament_participants_user ON public.tournament_participants(user_id);
  CREATE INDEX IF NOT EXISTS idx_tournament_participants_score ON public.tournament_participants(total_score DESC);
  CREATE INDEX IF NOT EXISTS idx_tournament_rounds_tournament ON public.tournament_rounds(tournament_id);
  CREATE INDEX IF NOT EXISTS idx_tournament_attempts_round ON public.tournament_attempts(round_id);

  DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_participants;
  EXCEPTION WHEN OTHERS THEN NULL; END $$;

  DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_rounds;
  EXCEPTION WHEN OTHERS THEN NULL; END $$;
