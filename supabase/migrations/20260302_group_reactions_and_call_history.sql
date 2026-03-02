-- ══════════════════════════════════════════════════════════════════
-- Group Message Reactions + Call History
-- ══════════════════════════════════════════════════════════════════

-- ── Group Message Reactions ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_message_reactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  uuid NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji       varchar(8) NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_group_reactions_message ON group_message_reactions(message_id);
CREATE INDEX idx_group_reactions_user    ON group_message_reactions(user_id);

ALTER TABLE group_message_reactions ENABLE ROW LEVEL SECURITY;

-- Group members can view reactions on messages in their groups
CREATE POLICY "Group members can view reactions"
  ON group_message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_messages gm
      JOIN group_members gmbr ON gmbr.group_id = gm.group_id
      WHERE gm.id = group_message_reactions.message_id
        AND gmbr.user_id = auth.uid()
    )
  );

-- Users can insert their own reactions
CREATE POLICY "Users can insert own reactions"
  ON group_message_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own reactions
CREATE POLICY "Users can delete own reactions"
  ON group_message_reactions FOR DELETE
  USING (user_id = auth.uid());


-- ── Call History ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS call_history (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id   uuid NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  caller_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callee_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode              text NOT NULL CHECK (mode IN ('audio', 'video')),
  status            text NOT NULL CHECK (status IN ('completed', 'missed', 'declined', 'failed')),
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_seconds  integer,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_call_history_caller  ON call_history(caller_id);
CREATE INDEX idx_call_history_callee  ON call_history(callee_id);
CREATE INDEX idx_call_history_conv    ON call_history(conversation_id);

ALTER TABLE call_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own call history
CREATE POLICY "Users can view own call history"
  ON call_history FOR SELECT
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

-- Users can insert call history for calls they participate in
CREATE POLICY "Users can insert own call history"
  ON call_history FOR INSERT
  WITH CHECK (caller_id = auth.uid() OR callee_id = auth.uid());

-- Users can update call history for calls they participate in
CREATE POLICY "Users can update own call history"
  ON call_history FOR UPDATE
  USING (caller_id = auth.uid() OR callee_id = auth.uid());
