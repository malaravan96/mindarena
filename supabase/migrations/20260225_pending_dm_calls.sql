-- Migration: pending_dm_calls
-- Persists in-flight DM call invites so callee can answer from a
-- background / killed-app state after tapping the push notification.

CREATE TABLE IF NOT EXISTS pending_dm_calls (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text        NOT NULL,
  from_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_name       text        NOT NULL DEFAULT '',
  mode            text        NOT NULL DEFAULT 'audio' CHECK (mode IN ('audio','video')),
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','accepted','declined','expired')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '60 seconds')
);

ALTER TABLE pending_dm_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_select" ON pending_dm_calls FOR SELECT TO authenticated
  USING (from_id = auth.uid() OR to_id = auth.uid());

CREATE POLICY "caller_insert" ON pending_dm_calls FOR INSERT TO authenticated
  WITH CHECK (from_id = auth.uid());

CREATE POLICY "participants_update" ON pending_dm_calls FOR UPDATE TO authenticated
  USING (from_id = auth.uid() OR to_id = auth.uid());

-- Optional: cron job to purge expired rows every 5 minutes.
-- Requires the pg_cron extension (enable it in Supabase Dashboard → Extensions first).
-- SELECT cron.schedule(
--   'expire-pending-dm-calls',
--   '*/5 * * * *',
--   $$
--     DELETE FROM pending_dm_calls
--     WHERE expires_at < now() - interval '5 minutes';
--   $$
-- );
