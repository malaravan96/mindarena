-- ============================================================
-- MindArena Chat System Upgrade — SQL Migration
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── Phase 1A: Online/Offline Status ────────────────────────────────────────
-- Add presence columns to profiles if not already present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- ── Phase 1C: Message Status ────────────────────────────────────────────────
ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'delivered', 'seen'));

-- Allow recipient to update status (delivered/seen)
DROP POLICY IF EXISTS "dm_messages_no_update" ON public.dm_messages;
CREATE POLICY "dm_messages_update_status" ON public.dm_messages
  FOR UPDATE USING (
    auth.uid() != sender_id
    AND EXISTS (
      SELECT 1 FROM public.dm_participants
      WHERE conversation_id = dm_messages.conversation_id
        AND user_id = auth.uid()
    )
  ) WITH CHECK (true);

-- ── Phase 2: Media Messages ────────────────────────────────────────────────
ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'voice', 'video', 'file')),
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER,
  ADD COLUMN IF NOT EXISTS attachment_duration REAL,
  ADD COLUMN IF NOT EXISTS attachment_width INTEGER,
  ADD COLUMN IF NOT EXISTS attachment_height INTEGER;

-- ── Phase 3B: Disappearing Messages ────────────────────────────────────────
ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.dm_conversation_settings (
  conversation_id UUID PRIMARY KEY REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  disappearing_messages_ttl INTEGER,  -- seconds; NULL = disabled
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.dm_conversation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_settings_select" ON public.dm_conversation_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dm_participants
      WHERE conversation_id = dm_conversation_settings.conversation_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "dm_settings_upsert" ON public.dm_conversation_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.dm_participants
      WHERE conversation_id = dm_conversation_settings.conversation_id
        AND user_id = auth.uid()
    )
  ) WITH CHECK (true);

-- Cron job to delete expired messages (requires pg_cron extension)
-- Enable extension first: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('delete-disappeared-messages', '0 * * * *', $$
--   DELETE FROM public.dm_messages WHERE expires_at IS NOT NULL AND expires_at < NOW();
-- $$);

-- ── Phase 3C: User Reports ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam','harassment','inappropriate_content','hate_speech','impersonation','other')),
  details TEXT,
  context_type TEXT CHECK (context_type IN ('dm','group','profile')),
  context_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_report CHECK (reporter_id <> reported_id)
);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_reports_insert" ON public.user_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "user_reports_select_own" ON public.user_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- ── Phase 4: Group Chat ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.group_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  max_members INTEGER NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id UUID NOT NULL REFERENCES public.group_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.group_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'voice', 'video', 'file', 'system')),
  attachment_url TEXT,
  attachment_mime TEXT,
  attachment_size INTEGER,
  attachment_duration REAL,
  attachment_width INTEGER,
  attachment_height INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for group tables
ALTER TABLE public.group_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- group_conversations: members can read; creators/admins can update
CREATE POLICY "group_conv_select" ON public.group_conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_conversations.id AND user_id = auth.uid())
  );
CREATE POLICY "group_conv_insert" ON public.group_conversations
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "group_conv_update" ON public.group_conversations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_conversations.id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
CREATE POLICY "group_conv_delete" ON public.group_conversations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_conversations.id AND user_id = auth.uid() AND role = 'owner')
  );

-- group_members: members can read; admins/owners can manage
CREATE POLICY "group_members_select" ON public.group_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid())
  );
CREATE POLICY "group_members_insert" ON public.group_members
  FOR INSERT WITH CHECK (
    -- Allow self-insert (for createGroup) or admin/owner inserts
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
CREATE POLICY "group_members_update" ON public.group_members
  FOR UPDATE USING (
    auth.uid() = user_id OR -- allow self update (last_read_at)
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
  );
CREATE POLICY "group_members_delete" ON public.group_members
  FOR DELETE USING (
    auth.uid() = user_id OR -- allow self remove (leave group)
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_members.group_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- group_messages: members can read/insert their own
CREATE POLICY "group_messages_select" ON public.group_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );
CREATE POLICY "group_messages_insert" ON public.group_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
  );

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- ── Supabase Storage: dm-attachments bucket ──────────────────────────────────
-- Create this bucket in the Supabase Dashboard > Storage > New Bucket:
--   Name: dm-attachments
--   Public: NO (private)
--   File size limit: 52428800 (50MB)
--
-- Storage RLS policies (set in Dashboard > Storage > Policies):
-- INSERT: auth.uid()::text = (storage.foldername(name))[3]
--   (path: {conversationId}/{type}/{senderId}/{filename})
-- SELECT: use a function to verify conversation membership
-- (Full storage RLS setup is best done through the Supabase Dashboard UI)

-- ============================================================
-- DONE. Verify by checking Supabase Table Editor.
-- ============================================================
-- Next migration: 20260225_reactions_and_replies.sql
--   Adds dm_messages.reply_to_id and dm_message_reactions table.
