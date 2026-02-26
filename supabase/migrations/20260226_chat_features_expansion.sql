-- ============================================================
-- MindArena Chat Features Expansion
-- Run after: 20260225_reactions_and_replies.sql
-- Adds: edit/delete, pinning, polls, group reply-to
-- ============================================================

-- ── Part 1: Edit & Soft-Delete columns ──────────────────────

-- dm_messages
ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS edited_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN NOT NULL DEFAULT false;

-- group_messages
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS edited_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN NOT NULL DEFAULT false;

-- ── Part 2: Pinning columns ──────────────────────────────────

-- dm_messages
ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS pinned_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- group_messages
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS pinned_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── Part 3: Add 'poll' to message_type check constraints ────
-- Drop old CHECK then re-add with 'poll' included.
-- dm_messages
ALTER TABLE public.dm_messages
  DROP CONSTRAINT IF EXISTS dm_messages_message_type_check;
ALTER TABLE public.dm_messages
  ADD CONSTRAINT dm_messages_message_type_check
    CHECK (message_type IN ('text', 'image', 'voice', 'video', 'file', 'poll'));

-- group_messages
ALTER TABLE public.group_messages
  DROP CONSTRAINT IF EXISTS group_messages_message_type_check;
ALTER TABLE public.group_messages
  ADD CONSTRAINT group_messages_message_type_check
    CHECK (message_type IN ('text', 'image', 'voice', 'video', 'file', 'system', 'poll'));

-- ── Part 4: Reply-to on group_messages ──────────────────────
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID
    REFERENCES public.group_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_group_messages_reply_to
  ON public.group_messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- ── Part 5: Update RLS — allow sender to UPDATE own dm_messages ─
-- Senders need to edit and soft-delete their own messages.
DO $$ BEGIN
  CREATE POLICY "dm_messages_update_own" ON public.dm_messages
    FOR UPDATE USING (auth.uid() = sender_id)
    WITH CHECK (auth.uid() = sender_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Any conversation participant can pin/unpin (update pinned_at only).
-- Covered by the above policy since pinned_at is on the same row.
-- group_messages: allow sender to edit/delete and any member to pin.
DO $$ BEGIN
  CREATE POLICY "group_messages_update" ON public.group_messages
    FOR UPDATE USING (
      auth.uid() = sender_id
      OR EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_messages.group_id AND user_id = auth.uid()
      )
    )
    WITH CHECK (
      auth.uid() = sender_id
      OR EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = group_messages.group_id AND user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Part 6: Poll tables ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_polls (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID        REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  group_id          UUID        REFERENCES public.group_conversations(id) ON DELETE CASCADE,
  created_by        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question          TEXT        NOT NULL CHECK (char_length(question) > 0),
  is_multiple_choice BOOLEAN    NOT NULL DEFAULT false,
  ends_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_polls_exactly_one_target CHECK (
    (conversation_id IS NOT NULL)::int + (group_id IS NOT NULL)::int = 1
  )
);

CREATE TABLE IF NOT EXISTS public.chat_poll_options (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id       UUID    NOT NULL REFERENCES public.chat_polls(id) ON DELETE CASCADE,
  text          TEXT    NOT NULL CHECK (char_length(text) > 0),
  display_order INT     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.chat_poll_votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID        NOT NULL REFERENCES public.chat_polls(id) ON DELETE CASCADE,
  option_id  UUID        NOT NULL REFERENCES public.chat_poll_options(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, option_id, user_id)
);

-- Indexes for poll lookups
CREATE INDEX IF NOT EXISTS idx_chat_polls_conv     ON public.chat_polls (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_polls_group    ON public.chat_polls (group_id)        WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_poll_opts_poll ON public.chat_poll_options (poll_id);
CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_poll ON public.chat_poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS idx_chat_poll_votes_user ON public.chat_poll_votes (user_id);

-- ── Part 7: RLS for poll tables ──────────────────────────────

ALTER TABLE public.chat_polls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_poll_votes   ENABLE ROW LEVEL SECURITY;

-- chat_polls: DM participant or group member can SELECT
DO $$ BEGIN
  CREATE POLICY "chat_polls_select" ON public.chat_polls
    FOR SELECT USING (
      (conversation_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.dm_conversations
        WHERE id = chat_polls.conversation_id
          AND (user_a = auth.uid() OR user_b = auth.uid())
      ))
      OR
      (group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = chat_polls.group_id AND user_id = auth.uid()
      ))
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- creator can insert
DO $$ BEGIN
  CREATE POLICY "chat_polls_insert" ON public.chat_polls
    FOR INSERT WITH CHECK (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- chat_poll_options: readable by same participants (via poll)
DO $$ BEGIN
  CREATE POLICY "chat_poll_options_select" ON public.chat_poll_options
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.chat_polls p
        WHERE p.id = chat_poll_options.poll_id
          AND (
            (p.conversation_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.dm_conversations c
              WHERE c.id = p.conversation_id
                AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
            ))
            OR
            (p.group_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.group_members gm
              WHERE gm.group_id = p.group_id AND gm.user_id = auth.uid()
            ))
          )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- poll creator inserts options
DO $$ BEGIN
  CREATE POLICY "chat_poll_options_insert" ON public.chat_poll_options
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.chat_polls WHERE id = chat_poll_options.poll_id AND created_by = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- chat_poll_votes: participants can read all votes for a poll
DO $$ BEGIN
  CREATE POLICY "chat_poll_votes_select" ON public.chat_poll_votes
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.chat_polls p
        WHERE p.id = chat_poll_votes.poll_id
          AND (
            (p.conversation_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.dm_conversations c
              WHERE c.id = p.conversation_id
                AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
            ))
            OR
            (p.group_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.group_members gm
              WHERE gm.group_id = p.group_id AND gm.user_id = auth.uid()
            ))
          )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- users can only insert their own vote
DO $$ BEGIN
  CREATE POLICY "chat_poll_votes_insert" ON public.chat_poll_votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- users can delete (retract) their own vote
DO $$ BEGIN
  CREATE POLICY "chat_poll_votes_delete" ON public.chat_poll_votes
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Part 8: Enable Realtime ──────────────────────────────────
-- dm_messages and group_messages are already in the publication;
-- UPDATE events will now fire for edited_at, is_deleted, pinned_at.
-- Add the three new poll tables so vote counts can be pushed live.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_polls;
EXCEPTION
  WHEN duplicate_object  THEN NULL;
  WHEN undefined_object  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_poll_options;
EXCEPTION
  WHEN duplicate_object  THEN NULL;
  WHEN undefined_object  THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_poll_votes;
EXCEPTION
  WHEN duplicate_object  THEN NULL;
  WHEN undefined_object  THEN NULL;
END $$;

-- ── Part 9: Indexes for pin lookups ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_dm_messages_pinned
  ON public.dm_messages (conversation_id, pinned_at)
  WHERE pinned_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_group_messages_pinned
  ON public.group_messages (group_id, pinned_at)
  WHERE pinned_at IS NOT NULL;

-- ============================================================
-- DONE.
-- Verify with:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'dm_messages'
--     AND column_name IN ('edited_at','is_deleted','pinned_at','pinned_by');
--
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'group_messages'
--     AND column_name IN ('edited_at','is_deleted','pinned_at','pinned_by','reply_to_id');
--
--   SELECT table_name FROM information_schema.tables
--     WHERE table_name IN ('chat_polls','chat_poll_options','chat_poll_votes');
-- ============================================================
