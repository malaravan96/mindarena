-- PvP chat + voice notes
-- Run this in Supabase SQL Editor after base schema setup.

CREATE TABLE IF NOT EXISTS public.pvp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'emoji', 'voice')),
  text_content TEXT,
  emoji TEXT,
  voice_url TEXT,
  voice_duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pvp_messages_match_created
  ON public.pvp_messages(match_id, created_at ASC);

ALTER TABLE public.pvp_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "pvp_messages_select_all" ON public.pvp_messages
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "pvp_messages_insert_own" ON public.pvp_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "pvp_messages_no_update" ON public.pvp_messages
    FOR UPDATE USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "pvp_messages_no_delete" ON public.pvp_messages
    FOR DELETE USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pvp_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pvp-voice',
  'pvp-voice',
  true,
  10485760,
  ARRAY['audio/m4a', 'audio/mp4', 'audio/aac', 'audio/webm']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$ BEGIN
  CREATE POLICY "pvp_voice_select_public" ON storage.objects
    FOR SELECT USING (bucket_id = 'pvp-voice');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "pvp_voice_insert_authed" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'pvp-voice' AND auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
