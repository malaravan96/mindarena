-- ============================================================
-- Chat Request & Block System
-- ============================================================

-- 1. user_connections - tracks chat requests and accepted connections
CREATE TABLE IF NOT EXISTS public.user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_connection CHECK (requester_id <> target_id)
);

-- Unique index to prevent duplicate connections between two users (order-independent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_connections_pair
  ON public.user_connections (LEAST(requester_id, target_id), GREATEST(requester_id, target_id));

ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

-- SELECT: either party can view
CREATE POLICY "user_connections_select" ON public.user_connections
  FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = target_id
  );

-- INSERT: only the requester can create, forced to pending status
CREATE POLICY "user_connections_insert" ON public.user_connections
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id
    AND status = 'pending'
  );

-- UPDATE: only the target can accept or decline
CREATE POLICY "user_connections_update" ON public.user_connections
  FOR UPDATE USING (
    auth.uid() = target_id
  ) WITH CHECK (
    auth.uid() = target_id
    AND status IN ('accepted', 'declined')
  );

-- DELETE: either party can remove a connection
CREATE POLICY "user_connections_delete" ON public.user_connections
  FOR DELETE USING (
    auth.uid() = requester_id OR auth.uid() = target_id
  );

-- Add to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_connections;


-- 2. blocked_users - unidirectional blocking
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id),
  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- SELECT: either party can see blocks involving them
CREATE POLICY "blocked_users_select" ON public.blocked_users
  FOR SELECT USING (
    auth.uid() = blocker_id OR auth.uid() = blocked_id
  );

-- INSERT: only the blocker can create
CREATE POLICY "blocked_users_insert" ON public.blocked_users
  FOR INSERT WITH CHECK (
    auth.uid() = blocker_id
  );

-- DELETE: only the blocker can remove their own block
CREATE POLICY "blocked_users_delete" ON public.blocked_users
  FOR DELETE USING (
    auth.uid() = blocker_id
  );

-- No UPDATE policy - blocks are immutable (delete + re-create instead)


-- 3. Update dm_messages INSERT policy to enforce block checks
-- Drop existing insert policy if it exists, then recreate with block check
DO $$
BEGIN
  -- Try to drop the existing policy; ignore if it doesn't exist
  BEGIN
    DROP POLICY "dm_messages_insert" ON public.dm_messages;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END
$$;

CREATE POLICY "dm_messages_insert" ON public.dm_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users
      WHERE (blocker_id = auth.uid() AND blocked_id IN (
        SELECT CASE WHEN user_a = auth.uid() THEN user_b ELSE user_a END
        FROM public.dm_conversations WHERE id = conversation_id
      ))
      OR (blocked_id = auth.uid() AND blocker_id IN (
        SELECT CASE WHEN user_a = auth.uid() THEN user_b ELSE user_a END
        FROM public.dm_conversations WHERE id = conversation_id
      ))
    )
  );
