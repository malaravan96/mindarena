-- ============================================================
-- MindArena - Teams/Groups Schema
-- Run AFTER activity-feed.sql
-- ============================================================

-- ── 1. Teams ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  avatar_url TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_count INTEGER DEFAULT 1,
  total_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "teams_select_all" ON public.teams
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "teams_insert_auth" ON public.teams
    FOR INSERT WITH CHECK (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "teams_update_owner" ON public.teams
    FOR UPDATE USING (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Team Members ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "team_members_select_all" ON public.team_members
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "team_members_insert_own" ON public.team_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Team Invites ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, invitee_id)
);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "team_invites_select_own" ON public.team_invites
    FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "team_invites_insert_own" ON public.team_invites
    FOR INSERT WITH CHECK (auth.uid() = inviter_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "team_invites_update_own" ON public.team_invites
    FOR UPDATE USING (auth.uid() = invitee_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 4. Team Messages ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "team_messages_select_members" ON public.team_messages
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.team_members WHERE team_id = team_messages.team_id AND user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "team_messages_insert_members" ON public.team_messages
    FOR INSERT WITH CHECK (
      auth.uid() = sender_id
      AND EXISTS (SELECT 1 FROM public.team_members WHERE team_id = team_messages.team_id AND user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 5. Team Challenges ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  opponent_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  puzzle_id UUID REFERENCES public.puzzles(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  challenger_score INTEGER DEFAULT 0,
  opponent_score INTEGER DEFAULT 0,
  winner_team_id UUID REFERENCES public.teams(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.team_challenges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "team_challenges_select_all" ON public.team_challenges
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. Add team_id to profiles ──────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- ── 7. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_teams_points ON public.teams(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_invitee ON public.team_invites(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_team_messages_team ON public.team_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_created ON public.team_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_challenges_teams ON public.team_challenges(challenger_team_id, opponent_team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_team ON public.profiles(team_id);
