import { supabase } from '@/lib/supabase';
import type { DmConversation, DmMessage, Profile } from '@/lib/types';
import {
  decryptDmMessageBody,
  encryptDmMessageBody,
  ensureDmE2eeReady,
  isEncryptedEnvelope,
  isPeerE2eeNotReadyError,
} from '@/lib/dmE2ee';
import { getAcceptedPeerIds, getBlockedIds, isBlocked } from '@/lib/connections';

const DM_E2EE_ENABLED = true;

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

  // Block check
  const blocked = await isBlocked(uid, peerUserId);
  if (blocked) throw new Error('Cannot message this user — blocked');

  // Connection check — only accepted connections can message
  const acceptedPeers = await getAcceptedPeerIds(uid);
  if (!acceptedPeers.has(peerUserId)) throw new Error('You must be connected to message this user');

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
  let e2eeReady = DM_E2EE_ENABLED;
  if (DM_E2EE_ENABLED) {
    try {
      await ensureDmE2eeReady(userId);
    } catch {
      e2eeReady = false;
    }
  }

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
    .select('id, username, display_name, avatar_url, is_online, last_seen_at')
    .in('id', peerIds);

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        name: p.display_name || p.username || 'Player',
        avatar_url: p.avatar_url ?? null,
        is_online: p.is_online ?? false,
        last_seen_at: p.last_seen_at ?? null,
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

  // Filter out blocked and non-connected peers
  const [blockedIds, acceptedPeers] = await Promise.all([
    getBlockedIds(userId),
    getAcceptedPeerIds(userId),
  ]);

  const output = await Promise.all(
    conversations
      .filter((c) => {
        const pid = c.user_a === userId ? c.user_b : c.user_a;
        return !blockedIds.has(pid) && acceptedPeers.has(pid);
      })
      .map(async (c) => {
      const peerId = c.user_a === userId ? c.user_b : c.user_a;
      const peer = profileById.get(peerId);
      const lastRaw = lastByConversation.get(c.id)?.body ?? '';
      let lastMessage = isEncryptedEnvelope(lastRaw) ? '[Encrypted message]' : lastRaw;

      if (lastRaw && e2eeReady) {
        try {
          lastMessage = await decryptDmMessageBody({
            conversationId: c.id,
            userId,
            peerId,
            body: lastRaw,
          });
        } catch {
          lastMessage = '[Encrypted message]';
        }
      }

      return {
        ...c,
        peer_id: peerId,
        peer_name: peer?.name ?? 'Player',
        peer_avatar_url: peer?.avatar_url ?? null,
        peer_is_online: peer?.is_online ?? false,
        peer_last_seen_at: peer?.last_seen_at ?? null,
        last_message: lastMessage,
        unread_count: unreadByConversation.get(c.id) ?? 0,
      };
    }),
  );

  return output;
}

export async function listMessages(
  conversationId: string,
  options?: { userId?: string; peerId?: string },
): Promise<DmMessage[]> {
  const uid = options?.userId ?? (await getCurrentUserId());
  if (!uid) return [];
  let e2eeReady = DM_E2EE_ENABLED;
  if (DM_E2EE_ENABLED) {
    try {
      await ensureDmE2eeReady(uid);
    } catch {
      e2eeReady = false;
    }
  }

  const { data, error } = await supabase
    .from('dm_messages')
    .select('id, conversation_id, sender_id, body, created_at, status, message_type, attachment_url, attachment_mime, attachment_size, attachment_duration, attachment_width, attachment_height, expires_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(400);

  if (error || !data) return [];
  const rows = data as DmMessage[];

  let peerId = options?.peerId ?? null;
  if (!peerId) {
    const { data: conversation } = await supabase
      .from('dm_conversations')
      .select('user_a, user_b')
      .eq('id', conversationId)
      .maybeSingle<{ user_a: string; user_b: string }>();
    if (conversation) {
      peerId = conversation.user_a === uid ? conversation.user_b : conversation.user_a;
    }
  }

  if (!peerId || !e2eeReady) {
    return rows.map((row) => ({
      ...row,
      body: isEncryptedEnvelope(row.body) ? '[Encrypted message]' : row.body,
    }));
  }

  const decrypted = await Promise.all(
    rows.map(async (row) => {
      try {
        const body = await decryptDmMessageBody({
          conversationId,
          userId: uid,
          peerId: peerId!,
          body: row.body,
        });
        return { ...row, body };
      } catch {
        return { ...row, body: '[Encrypted message]' };
      }
    }),
  );

  return decrypted;
}

export async function sendMessage(conversationId: string, body: string) {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  let canEncrypt = DM_E2EE_ENABLED;
  if (DM_E2EE_ENABLED) {
    try {
      await ensureDmE2eeReady(uid);
    } catch {
      // Keep DM usable even when key publish/storage is unavailable.
      canEncrypt = false;
    }
  }

  const text = body.trim();
  if (!text) throw new Error('Message cannot be empty');

  const { data: conversation } = await supabase
    .from('dm_conversations')
    .select('user_a, user_b')
    .eq('id', conversationId)
    .maybeSingle<{ user_a: string; user_b: string }>();
  if (!conversation) throw new Error('Conversation not found');

  const peerId = conversation.user_a === uid ? conversation.user_b : conversation.user_a;

  // Block check
  const blocked = await isBlocked(uid, peerId);
  if (blocked) throw new Error('Cannot send message — user is blocked');

  let messageBody = text;
  if (canEncrypt) {
    try {
      messageBody = await encryptDmMessageBody({
        conversationId,
        userId: uid,
        peerId,
        body: text,
        forceRefreshPeerKey: true,
      });
    } catch (error) {
      if (!isPeerE2eeNotReadyError(error)) {
        console.warn('DM encrypt failed; falling back to plaintext', error);
      }
      // Compatibility path: allow plaintext messages when E2EE is not available.
      messageBody = text;
    }
  }

  const { data, error } = await supabase
    .from('dm_messages')
    .insert({ conversation_id: conversationId, sender_id: uid, body: messageBody, status: 'sent', message_type: 'text' })
    .select('id, conversation_id, sender_id, body, created_at, status, message_type, attachment_url, attachment_mime, attachment_size, attachment_duration, attachment_width, attachment_height, expires_at')
    .maybeSingle<DmMessage>();

  if (error || !data) throw error ?? new Error('Message insert failed');

  await supabase
    .from('dm_conversations')
    .update({ last_message_at: data.created_at })
    .eq('id', conversationId);

  return {
    ...data,
    body: text,
  };
}

export async function markConversationRead(conversationId: string) {
  const uid = await getCurrentUserId();
  if (!uid) return;

  await Promise.all([
    supabase
      .from('dm_participants')
      .upsert(
        { conversation_id: conversationId, user_id: uid, last_read_at: new Date().toISOString() },
        { onConflict: 'conversation_id,user_id' },
      ),
    // Mark incoming messages as 'seen'
    supabase
      .from('dm_messages')
      .update({ status: 'seen' })
      .eq('conversation_id', conversationId)
      .neq('sender_id', uid)
      .in('status', ['sent', 'delivered']),
  ]);
}

/** Mark incoming messages as 'delivered' (called when new messages arrive and chat is open). */
export async function markMessagesDelivered(conversationId: string) {
  const uid = await getCurrentUserId();
  if (!uid) return;

  await supabase
    .from('dm_messages')
    .update({ status: 'delivered' })
    .eq('conversation_id', conversationId)
    .neq('sender_id', uid)
    .eq('status', 'sent');
}

export async function getTotalDmUnread(userId: string) {
  const conversations = await listConversations(userId);
  return conversations.reduce((sum, c) => sum + c.unread_count, 0);
}

export async function listMessageTargets(userId: string): Promise<Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>[]> {
  // Only return accepted connections
  const acceptedPeers = await getAcceptedPeerIds(userId);
  if (acceptedPeers.size === 0) return [];

  const peerArray = Array.from(acceptedPeers);
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', peerArray)
    .order('total_points', { ascending: false });

  if (error || !data) return [];
  return data;
}
