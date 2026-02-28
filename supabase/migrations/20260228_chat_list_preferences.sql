-- ============================================================
-- MindArena Chat List Preferences (pin / mute / archive)
-- Stores per-user chat list organization so it syncs across devices.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_list_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pinned_dm_ids UUID[] NOT NULL DEFAULT '{}',
  muted_dm_ids UUID[] NOT NULL DEFAULT '{}',
  archived_dm_ids UUID[] NOT NULL DEFAULT '{}',
  pinned_group_ids UUID[] NOT NULL DEFAULT '{}',
  muted_group_ids UUID[] NOT NULL DEFAULT '{}',
  archived_group_ids UUID[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_list_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "chat_list_prefs_select_own" ON public.chat_list_preferences
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "chat_list_prefs_insert_own" ON public.chat_list_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "chat_list_prefs_update_own" ON public.chat_list_preferences
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "chat_list_prefs_delete_own" ON public.chat_list_preferences
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_list_preferences;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ============================================================
-- DONE.
-- ============================================================
