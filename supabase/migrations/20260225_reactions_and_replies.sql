-- ============================================================
-- MindArena Chat — Message Reactions + Reply-to Migration
-- Run in Supabase SQL Editor after 20260225_chat_upgrade.sql
-- ============================================================

-- ── Phase 1: Reply-to column on dm_messages ─────────────────
ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID
    REFERENCES public.dm_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dm_messages_reply_to
  ON public.dm_messages (reply_to_id)
  WHERE reply_to_id IS NOT NULL;

-- ── Phase 2: Message reactions table ────────────────────────
CREATE TABLE IF NOT EXISTS public.dm_message_reactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID        NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  emoji       TEXT        NOT NULL CHECK (char_length(emoji) <= 8),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_dm_msg_reactions_msg
  ON public.dm_message_reactions (message_id);

-- ── Phase 3: RLS for dm_message_reactions ───────────────────
ALTER TABLE public.dm_message_reactions ENABLE ROW LEVEL SECURITY;

-- Participants of the conversation can view reactions
DO $$ BEGIN
  CREATE POLICY "reactions_select" ON public.dm_message_reactions
    FOR SELECT USING (
      EXISTS (
        SELECT 1
        FROM public.dm_messages m
        JOIN public.dm_conversations c ON c.id = m.conversation_id
        WHERE m.id = dm_message_reactions.message_id
          AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can only insert their own reactions
DO $$ BEGIN
  CREATE POLICY "reactions_insert" ON public.dm_message_reactions
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can only delete their own reactions
DO $$ BEGIN
  CREATE POLICY "reactions_delete" ON public.dm_message_reactions
    FOR DELETE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Phase 4: Enable Realtime for reactions ───────────────────
-- Required so the postgres_changes INSERT listener fires in the app
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_message_reactions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ============================================================
-- DONE.
-- Verify:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'dm_messages' AND column_name = 'reply_to_id';
--   SELECT table_name FROM information_schema.tables
--     WHERE table_name = 'dm_message_reactions';
-- ============================================================
