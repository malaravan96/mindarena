import { supabase } from '@/lib/supabase';
import type { GroupConversation, GroupMember, GroupMessage, GroupRole } from '@/lib/types';

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createGroup(name: string, memberIds: string[]): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const { data: group, error: groupError } = await supabase
    .from('group_conversations')
    .insert({ name, created_by: uid })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (groupError || !group) throw groupError ?? new Error('Failed to create group');

  const allMemberIds = Array.from(new Set([uid, ...memberIds]));
  const memberRows = allMemberIds.map((userId) => ({
    group_id: group.id,
    user_id: userId,
    role: userId === uid ? 'owner' : 'member',
  }));

  const { error: memberError } = await supabase.from('group_members').insert(memberRows);
  if (memberError) throw memberError;

  return group.id;
}

export async function listGroupConversations(userId: string): Promise<GroupConversation[]> {
  // Get groups the user is a member of
  const { data: memberships, error: mErr } = await supabase
    .from('group_members')
    .select('group_id, last_read_at')
    .eq('user_id', userId);

  if (mErr || !memberships?.length) return [];

  const groupIds = memberships.map((m) => m.group_id);
  const lastReadMap = new Map(memberships.map((m) => [m.group_id, m.last_read_at]));

  const { data: groups, error: gErr } = await supabase
    .from('group_conversations')
    .select('id, name, description, avatar_url, created_by, created_at, last_message_at, max_members')
    .in('id', groupIds)
    .order('last_message_at', { ascending: false });

  if (gErr || !groups?.length) return [];

  // Member counts
  const { data: memberCounts } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  const countMap = new Map<string, number>();
  for (const m of memberCounts ?? []) {
    countMap.set(m.group_id, (countMap.get(m.group_id) ?? 0) + 1);
  }

  // Last messages + unread counts
  const { data: messages } = await supabase
    .from('group_messages')
    .select('id, group_id, sender_id, body, message_type, created_at')
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })
    .limit(groupIds.length * 10);

  const lastByGroup = new Map<string, string>();
  const unreadByGroup = new Map<string, number>();

  for (const msg of messages ?? []) {
    if (!lastByGroup.has(msg.group_id)) {
      lastByGroup.set(msg.group_id, msg.message_type === 'text' ? msg.body : `[${msg.message_type}]`);
    }
    const lastRead = lastReadMap.get(msg.group_id);
    if (msg.sender_id !== userId && (lastRead ? msg.created_at > lastRead : true)) {
      unreadByGroup.set(msg.group_id, (unreadByGroup.get(msg.group_id) ?? 0) + 1);
    }
  }

  return (groups as GroupConversation[]).map((g) => ({
    ...g,
    member_count: countMap.get(g.id) ?? 0,
    last_message: lastByGroup.get(g.id) ?? null,
    unread_count: unreadByGroup.get(g.id) ?? 0,
  }));
}

export async function listGroupMessages(groupId: string): Promise<GroupMessage[]> {
  const { data, error } = await supabase
    .from('group_messages')
    .select('id, group_id, sender_id, body, message_type, attachment_url, attachment_mime, attachment_size, attachment_duration, attachment_width, attachment_height, expires_at, created_at, reply_to_id, edited_at, is_deleted, pinned_at, pinned_by')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
    .limit(400);

  if (error || !data) return [];

  const senderIds = Array.from(new Set((data as GroupMessage[]).map((m) => m.sender_id)));

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', senderIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url },
    ]),
  );

  return (data as GroupMessage[]).map((msg) => ({
    ...msg,
    sender_profile: profileMap.get(msg.sender_id),
  }));
}

export async function sendGroupMessage(
  groupId: string,
  body: string,
  attachment?: {
    message_type?: 'image' | 'voice' | 'video' | 'file';
    attachment_url?: string;
    attachment_mime?: string;
    attachment_size?: number;
    attachment_duration?: number;
    attachment_width?: number;
    attachment_height?: number;
    replyToId?: string | null;
  },
): Promise<GroupMessage> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const { replyToId, ...attachmentData } = attachment ?? {};
  const payload: Record<string, unknown> = {
    group_id: groupId,
    sender_id: uid,
    body,
    message_type: attachmentData?.message_type ?? 'text',
    reply_to_id: replyToId ?? null,
    ...attachmentData,
  };

  const { data, error } = await supabase
    .from('group_messages')
    .insert(payload)
    .select('id, group_id, sender_id, body, message_type, attachment_url, attachment_mime, attachment_size, attachment_duration, attachment_width, attachment_height, expires_at, created_at, reply_to_id, edited_at, is_deleted, pinned_at, pinned_by')
    .maybeSingle<GroupMessage>();

  if (error || !data) throw error ?? new Error('Group message insert failed');

  await supabase
    .from('group_conversations')
    .update({ last_message_at: data.created_at })
    .eq('id', groupId);

  return data;
}

export async function markGroupRead(groupId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;

  await supabase
    .from('group_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('user_id', uid);
}

// ── Member management ─────────────────────────────────────────────────────────

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, user_id, role, joined_at, last_read_at')
    .eq('group_id', groupId);

  if (error || !data) return [];

  const userIds = (data as GroupMember[]).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      { id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url },
    ]),
  );

  return (data as GroupMember[]).map((m) => ({
    ...m,
    profile: profileMap.get(m.user_id),
  }));
}

export async function addGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('group_members').insert({
    group_id: groupId,
    user_id: userId,
    role: 'member',
  });
  if (error) throw error;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function promoteGroupMember(groupId: string, userId: string, newRole: GroupRole): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ role: newRole })
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function leaveGroup(groupId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  // If owner, try to promote someone else first
  const { data: ownerRow } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', uid)
    .maybeSingle<{ role: GroupRole }>();

  if (ownerRow?.role === 'owner') {
    const { data: admins } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId)
      .eq('role', 'admin')
      .neq('user_id', uid)
      .limit(1);

    const nextOwner = (admins ?? [])[0]?.user_id;

    if (nextOwner) {
      await promoteGroupMember(groupId, nextOwner, 'owner').catch(() => null);
    } else {
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .neq('user_id', uid)
        .limit(1);

      const fallback = (members ?? [])[0]?.user_id;
      if (fallback) await promoteGroupMember(groupId, fallback, 'owner').catch(() => null);
    }
  }

  await removeGroupMember(groupId, uid);
}

export async function updateGroupInfo(
  groupId: string,
  updates: { name?: string; description?: string; avatar_url?: string },
): Promise<void> {
  const { error } = await supabase
    .from('group_conversations')
    .update(updates)
    .eq('id', groupId);
  if (error) throw error;
}

export async function deleteGroup(groupId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  // Only owner can delete
  const { data: role } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', uid)
    .maybeSingle<{ role: GroupRole }>();

  if (role?.role !== 'owner') throw new Error('Only the group owner can delete this group');

  const { error } = await supabase.from('group_conversations').delete().eq('id', groupId);
  if (error) throw error;
}

export async function editGroupMessage(messageId: string, newBody: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const { error } = await supabase
    .from('group_messages')
    .update({ body: newBody, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_id', uid);

  if (error) throw error;
}

export async function deleteGroupMessage(messageId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const { error } = await supabase
    .from('group_messages')
    .update({ is_deleted: true, body: '', edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_id', uid);

  if (error) throw error;
}

export async function pinGroupMessage(messageId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const { error } = await supabase
    .from('group_messages')
    .update({ pinned_at: new Date().toISOString(), pinned_by: uid })
    .eq('id', messageId);

  if (error) throw error;
}

export async function unpinGroupMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('group_messages')
    .update({ pinned_at: null, pinned_by: null })
    .eq('id', messageId);

  if (error) throw error;
}

export async function listPinnedGroupMessages(groupId: string): Promise<GroupMessage[]> {
  const { data, error } = await supabase
    .from('group_messages')
    .select('id, group_id, sender_id, body, message_type, attachment_url, attachment_mime, attachment_size, attachment_duration, attachment_width, attachment_height, expires_at, created_at, reply_to_id, edited_at, is_deleted, pinned_at, pinned_by')
    .eq('group_id', groupId)
    .not('pinned_at', 'is', null)
    .order('pinned_at', { ascending: false });

  if (error || !data) return [];
  return data as GroupMessage[];
}

export async function getGroupInfo(groupId: string): Promise<GroupConversation | null> {
  const { data, error } = await supabase
    .from('group_conversations')
    .select('id, name, description, avatar_url, created_by, created_at, last_message_at, max_members')
    .eq('id', groupId)
    .maybeSingle<GroupConversation>();

  if (error) return null;
  return data;
}
