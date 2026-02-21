import { supabase } from '@/lib/supabase';
import type { DmConversation, DmMessage, Profile } from '@/lib/types';

type ConversationRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  last_message_at: string;
};

type ParticipantRow = {
  conversation_id: string;
  last_read_at: string;
};

function normalizedPair(a: string, b: string) {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

export async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getOrCreateConversation(peerUserId: string) {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  if (uid === peerUserId) throw new Error('Cannot message yourself');

  const { data: existing } = await supabase
    .from('dm_conversations')
    .select('id, user_a, user_b, created_at, last_message_at')
    .or(`and(user_a.eq.${uid},user_b.eq.${peerUserId}),and(user_a.eq.${peerUserId},user_b.eq.${uid})`)
    .maybeSingle<ConversationRow>();

  let conversationId = existing?.id ?? null;

  if (!conversationId) {
    const pair = normalizedPair(uid, peerUserId);
    const { data: inserted, error } = await supabase
      .from('dm_conversations')
      .insert(pair)
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) {
      // Handles race where two clients create the same thread simultaneously.
      const { data: raced } = await supabase
        .from('dm_conversations')
        .select('id')
        .or(`and(user_a.eq.${uid},user_b.eq.${peerUserId}),and(user_a.eq.${peerUserId},user_b.eq.${uid})`)
        .maybeSingle<{ id: string }>();
      conversationId = raced?.id ?? null;
    } else {
      conversationId = inserted?.id ?? null;
    }
  }

  if (!conversationId) throw new Error('Unable to create conversation');

  const now = new Date().toISOString();
  await supabase.from('dm_participants').upsert(
    [
      { conversation_id: conversationId, user_id: uid, last_read_at: now },
      { conversation_id: conversationId, user_id: peerUserId, last_read_at: now },
    ],
    { onConflict: 'conversation_id,user_id' },
  );

  return conversationId;
}

export async function listConversations(userId: string): Promise<DmConversation[]> {
  const { data: rows, error } = await supabase
    .from('dm_conversations')
    .select('id, user_a, user_b, created_at, last_message_at')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('last_message_at', { ascending: false });

  if (error || !rows?.length) return [];

  const conversations = rows as ConversationRow[];
  const peerIds = Array.from(new Set(conversations.map((c) => (c.user_a === userId ? c.user_b : c.user_a))));
  const conversationIds = conversations.map((c) => c.id);

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', peerIds);

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        name: p.display_name || p.username || 'Player',
        avatar_url: p.avatar_url ?? null,
      },
    ]),
  );

  const { data: participants } = await supabase
    .from('dm_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)
    .in('conversation_id', conversationIds);

  const participantMap = new Map(
    (participants as ParticipantRow[] | null | undefined)?.map((p) => [p.conversation_id, p.last_read_at]) ?? [],
  );

  const { data: messages } = await supabase
    .from('dm_messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(Math.max(conversationIds.length * 30, 120));

  const msgs = (messages as DmMessage[] | null | undefined) ?? [];
  const lastByConversation = new Map<string, DmMessage>();
  const unreadByConversation = new Map<string, number>();

  for (const msg of msgs) {
    if (!lastByConversation.has(msg.conversation_id)) {
      lastByConversation.set(msg.conversation_id, msg);
    }
    const lastReadAt = participantMap.get(msg.conversation_id);
    if (
      msg.sender_id !== userId &&
      (!!lastReadAt ? msg.created_at > lastReadAt : true)
    ) {
      unreadByConversation.set(msg.conversation_id, (unreadByConversation.get(msg.conversation_id) ?? 0) + 1);
    }
  }

  return conversations.map((c) => {
    const peerId = c.user_a === userId ? c.user_b : c.user_a;
    const peer = profileById.get(peerId);
    return {
      ...c,
      peer_id: peerId,
      peer_name: peer?.name ?? 'Player',
      peer_avatar_url: peer?.avatar_url ?? null,
      last_message: lastByConversation.get(c.id)?.body ?? '',
      unread_count: unreadByConversation.get(c.id) ?? 0,
    };
  });
}

export async function listMessages(conversationId: string): Promise<DmMessage[]> {
  const { data, error } = await supabase
    .from('dm_messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(400);

  if (error || !data) return [];
  return data as DmMessage[];
}

export async function sendMessage(conversationId: string, body: string) {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const text = body.trim();
  if (!text) throw new Error('Message cannot be empty');

  const { data, error } = await supabase
    .from('dm_messages')
    .insert({ conversation_id: conversationId, sender_id: uid, body: text })
    .select('id, conversation_id, sender_id, body, created_at')
    .maybeSingle<DmMessage>();

  if (error || !data) throw error ?? new Error('Message insert failed');

  await supabase
    .from('dm_conversations')
    .update({ last_message_at: data.created_at })
    .eq('id', conversationId);

  return data;
}

export async function markConversationRead(conversationId: string) {
  const uid = await getCurrentUserId();
  if (!uid) return;

  await supabase
    .from('dm_participants')
    .upsert(
      { conversation_id: conversationId, user_id: uid, last_read_at: new Date().toISOString() },
      { onConflict: 'conversation_id,user_id' },
    );
}

export async function getTotalDmUnread(userId: string) {
  const conversations = await listConversations(userId);
  return conversations.reduce((sum, c) => sum + c.unread_count, 0);
}

export async function listMessageTargets(userId: string): Promise<Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .neq('id', userId)
    .order('total_points', { ascending: false })
    .limit(80);

  if (error || !data) return [];
  return data;
}
