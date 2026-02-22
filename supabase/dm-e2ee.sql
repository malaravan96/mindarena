-- DM end-to-end encryption key registry.
-- Run this after your base schema + DM schema scripts.

CREATE TABLE IF NOT EXISTS public.dm_user_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_user_keys_updated_at
  ON public.dm_user_keys (updated_at DESC);

DROP TRIGGER IF EXISTS update_dm_user_keys_updated_at ON public.dm_user_keys;
CREATE TRIGGER update_dm_user_keys_updated_at
  BEFORE UPDATE ON public.dm_user_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.dm_user_keys ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "dm_user_keys_select_authenticated" ON public.dm_user_keys
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "dm_user_keys_insert_own" ON public.dm_user_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "dm_user_keys_update_own" ON public.dm_user_keys
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "dm_user_keys_no_delete" ON public.dm_user_keys
    FOR DELETE USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
