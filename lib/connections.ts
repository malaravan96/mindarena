import { supabase } from '@/lib/supabase';
import type { UserConnection, ConnectionWithProfile, BlockedUser } from '@/lib/types';

async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ── Chat request / connection helpers ────────────────────────────

export async function sendChatRequest(targetId: string) {
  const uid = await getUid();
  if (!uid) throw new Error('Not signed in');
  if (uid === targetId) throw new Error('Cannot connect with yourself');

  // Check for existing block
  const blocked = await isBlocked(uid, targetId);
  if (blocked) throw new Error('Cannot send request — user is blocked');

  const { data, error } = await supabase
    .from('user_connections')
    .insert({ requester_id: uid, target_id: targetId, status: 'pending' })
    .select()
    .maybeSingle<UserConnection>();

  if (error) {
    // Unique constraint → connection already exists
    if (error.code === '23505') throw new Error('Connection already exists');
    throw error;
  }
  return data;
}

export async function acceptChatRequest(connectionId: string) {
  const uid = await getUid();
  if (!uid) throw new Error('Not signed in');

  const { error } = await supabase
    .from('user_connections')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', connectionId)
    .eq('target_id', uid);

  if (error) throw error;
}

export async function declineChatRequest(connectionId: string) {
  const uid = await getUid();
  if (!uid) throw new Error('Not signed in');

  // Delete the record so the requester can send a new request later
  const { error } = await supabase
    .from('user_connections')
    .delete()
    .eq('id', connectionId)
    .eq('target_id', uid);

  if (error) throw error;
}

export async function cancelChatRequest(connectionId: string) {
  const uid = await getUid();
  if (!uid) throw new Error('Not signed in');

  const { error } = await supabase
    .from('user_connections')
    .delete()
    .eq('id', connectionId)
    .eq('requester_id', uid)
    .eq('status', 'pending');

  if (error) throw error;
}

export async function removeConnection(connectionId: string) {
  const uid = await getUid();
  if (!uid) throw new Error('Not signed in');

  const { error } = await supabase
    .from('user_connections')
    .delete()
    .eq('id', connectionId);

  if (error) throw error;
}

export async function listConnections(
  userId: string,
  statusFilter?: 'pending' | 'accepted',
): Promise<ConnectionWithProfile[]> {
  let query = supabase
    .from('user_connections')
    .select('id, requester_id, target_id, status, created_at, updated_at')
    .or(`requester_id.eq.${userId},target_id.eq.${userId}`);

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data: rows, error } = await query.order('updated_at', { ascending: false });
  if (error || !rows?.length) return [];

  const connections = rows as UserConnection[];
  const peerIds = connections.map((c) =>
    c.requester_id === userId ? c.target_id : c.requester_id,
  );

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', peerIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [
      p.id,
      { name: p.display_name || p.username || 'Player', avatar_url: p.avatar_url ?? null },
    ]),
  );

  return connections.map((c) => {
    const peerId = c.requester_id === userId ? c.target_id : c.requester_id;
    const peer = profileMap.get(peerId);
    return {
      ...c,
      peer_id: peerId,
      peer_name: peer?.name ?? 'Player',
      peer_avatar_url: peer?.avatar_url ?? null,
    };
  });
}

export async function getConnectionStatus(
  userId: string,
  peerId: string,
): Promise<UserConnection | null> {
  const { data } = await supabase
    .from('user_connections')
    .select('id, requester_id, target_id, status, created_at, updated_at')
    .or(
      `and(requester_id.eq.${userId},target_id.eq.${peerId}),and(requester_id.eq.${peerId},target_id.eq.${userId})`,
    )
    .maybeSingle<UserConnection>();

  return data ?? null;
}

export async function getAcceptedPeerIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('user_connections')
    .select('requester_id, target_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},target_id.eq.${userId}`);

  if (!data) return new Set();
  return new Set(
    data.map((row: any) => (row.requester_id === userId ? row.target_id : row.requester_id)),
  );
}

// ── Block helpers ────────────────────────────────────────────────

export async function blockUser(blockedId: string) {
  const uid = await getUid();
  if (!uid) throw new Error('Not signed in');
  if (uid === blockedId) throw new Error('Cannot block yourself');

  // Insert block
  const { error: blockError } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: uid, blocked_id: blockedId });

  if (blockError && blockError.code !== '23505') throw blockError;

  // Remove any existing connection between the two users
  await supabase
    .from('user_connections')
    .delete()
    .or(
      `and(requester_id.eq.${uid},target_id.eq.${blockedId}),and(requester_id.eq.${blockedId},target_id.eq.${uid})`,
    );
}

export async function unblockUser(blockedId: string) {
  const uid = await getUid();
  if (!uid) throw new Error('Not signed in');

  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', uid)
    .eq('blocked_id', blockedId);

  if (error) throw error;
}

export async function getBlockedIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (!data) return new Set();
  return new Set(
    data.map((row: any) => (row.blocker_id === userId ? row.blocked_id : row.blocker_id)),
  );
}

export async function isBlocked(userId: string, peerId: string): Promise<boolean> {
  const { data } = await supabase
    .from('blocked_users')
    .select('id')
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${peerId}),and(blocker_id.eq.${peerId},blocked_id.eq.${userId})`,
    )
    .limit(1);

  return (data?.length ?? 0) > 0;
}
