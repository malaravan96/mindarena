import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  listMessages,
  markConversationRead,
  markMessagesDelivered,
  listPinnedDmMessages,
} from '@/lib/dm';
import {
  loadReactionsForMessages,
  groupReactions,
} from '@/lib/dmReactions';
import {
  decryptDmMessageBody,
  isEncryptedEnvelope,
} from '@/lib/dmE2ee';
import { sendTypingSignal, sendTypingStop } from '@/lib/typing';
import type { DmMessage, DmReactionGroup } from '@/lib/types';

const TYPING_RESET_MS = 4000;

interface UseChatRealtimeOptions {
  conversationId: string | undefined;
  userId: string | null;
  peerId: string | null;
}

interface UseChatRealtimeReturn {
  messages: DmMessage[];
  setMessages: React.Dispatch<React.SetStateAction<DmMessage[]>>;
  reactionsMap: Map<string, DmReactionGroup[]>;
  setReactionsMap: React.Dispatch<React.SetStateAction<Map<string, DmReactionGroup[]>>>;
  pinnedMessages: DmMessage[];
  setPinnedMessages: React.Dispatch<React.SetStateAction<DmMessage[]>>;
  peerTyping: boolean;
  peerIsOnline: boolean;
  peerLastSeen: string | null;
  callChannel: RealtimeChannel | null;
  loadThread: () => Promise<void>;
  refreshPinnedMessages: () => Promise<void>;
  notifyTyping: (text: string) => void;
  stopTyping: () => void;
}

export function useChatRealtime({
  conversationId,
  userId,
  peerId,
}: UseChatRealtimeOptions): UseChatRealtimeReturn {
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [reactionsMap, setReactionsMap] = useState<Map<string, DmReactionGroup[]>>(new Map());
  const [pinnedMessages, setPinnedMessages] = useState<DmMessage[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerIsOnline, setPeerIsOnline] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState<string | null>(null);

  const callChannelRef = useRef<RealtimeChannel | null>(null);
  const typingResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef(userId);
  const peerIdRef = useRef(peerId);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);

  const loadThread = useCallback(async () => {
    if (!conversationId || !userId || !peerId) return;
    const rows = await listMessages(conversationId, { userId, peerId });
    setMessages(rows);

    if (rows.length > 0) {
      loadReactionsForMessages(rows.map((r) => r.id))
        .then((reactions) => setReactionsMap(groupReactions(reactions, userId)))
        .catch(() => null);
    }

    listPinnedDmMessages(conversationId)
      .then(setPinnedMessages)
      .catch(() => null);

    markConversationRead(conversationId).catch(() => null);
  }, [conversationId, userId, peerId]);

  const refreshPinnedMessages = useCallback(async () => {
    if (!conversationId) return;
    const pinned = await listPinnedDmMessages(conversationId).catch(() => []);
    setPinnedMessages(pinned);
  }, [conversationId]);

  // Subscribe to peer profile changes (online status)
  useEffect(() => {
    if (!peerId) return;
    const channel = supabase
      .channel(`peer-presence-${peerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${peerId}`,
        },
        ({ new: row }) => {
          const p = row as { is_online?: boolean; last_seen_at?: string };
          setPeerIsOnline(p.is_online ?? false);
          setPeerLastSeen(p.last_seen_at ?? null);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [peerId]);

  // Subscribe to new messages + updates + reactions
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`dm-thread-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        ({ new: row }) => {
          void (async () => {
            const raw = row as DmMessage;
            const uid = userIdRef.current;
            const currentPeerId = peerIdRef.current;
            let body = isEncryptedEnvelope(raw.body) ? '[Encrypted message]' : raw.body;

            if (uid && currentPeerId) {
              try {
                body = await decryptDmMessageBody({
                  conversationId,
                  userId: uid,
                  peerId: currentPeerId,
                  body: raw.body,
                });
              } catch {
                body = '[Encrypted message]';
              }
            }

            setMessages((prev) => {
              if (prev.some((msg) => msg.id === raw.id)) return prev;
              const next = [...prev, { ...raw, body }];
              next.sort((a, b) => a.created_at.localeCompare(b.created_at));
              return next;
            });

            if (raw.sender_id !== uid) {
              markMessagesDelivered(conversationId).catch(() => null);
              markConversationRead(conversationId).catch(() => null);
            }
          })();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dm_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        ({ new: row }) => {
          const updated = row as DmMessage;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updated.id
                ? {
                    ...msg,
                    status: updated.status,
                    body: updated.is_deleted
                      ? ''
                      : updated.edited_at
                        ? updated.body
                        : msg.body,
                    edited_at: updated.edited_at,
                    is_deleted: updated.is_deleted,
                    pinned_at: updated.pinned_at,
                    pinned_by: updated.pinned_by,
                  }
                : msg,
            ),
          );
          if (updated.pinned_at !== undefined) {
            listPinnedDmMessages(conversationId).then(setPinnedMessages).catch(() => null);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_message_reactions',
        },
        ({ new: row }) => {
          const r = row as { message_id: string; user_id: string; emoji: string };
          const uid = userIdRef.current;
          if (!uid) return;
          setReactionsMap((prev) => {
            const next = new Map(prev);
            const groups = [...(next.get(r.message_id) ?? [])];
            const idx = groups.findIndex((g) => g.emoji === r.emoji);
            if (idx >= 0) {
              groups[idx] = {
                ...groups[idx],
                count: groups[idx].count + 1,
                reactedByMe: groups[idx].reactedByMe || r.user_id === uid,
              };
            } else {
              groups.push({ emoji: r.emoji, count: 1, reactedByMe: r.user_id === uid });
            }
            next.set(r.message_id, groups.sort((a, b) => b.count - a.count));
            return next;
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // Call channel — also handles typing signals and broadcast reactions
  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase.channel(`dm-call-${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'dm-typing' }, ({ payload }) => {
        const p = (payload ?? {}) as Record<string, unknown>;
        if (p.fromId === userIdRef.current) return;
        setPeerTyping(true);
        if (typingResetTimerRef.current) clearTimeout(typingResetTimerRef.current);
        typingResetTimerRef.current = setTimeout(() => setPeerTyping(false), TYPING_RESET_MS);
      })
      .on('broadcast', { event: 'dm-typing-stop' }, ({ payload }) => {
        const p = (payload ?? {}) as Record<string, unknown>;
        if (p.fromId === userIdRef.current) return;
        if (typingResetTimerRef.current) clearTimeout(typingResetTimerRef.current);
        setPeerTyping(false);
      })
      .on('broadcast', { event: 'dm-reaction' }, ({ payload }) => {
        const p = (payload ?? {}) as {
          userId?: string;
          messageId?: string;
          emoji?: string;
          added?: boolean;
        };
        if (!p.messageId || !p.emoji) return;
        const uid = userIdRef.current;
        setReactionsMap((prev) => {
          const next = new Map(prev);
          const groups = [...(next.get(p.messageId!) ?? [])];
          if (p.added) {
            const idx = groups.findIndex((g) => g.emoji === p.emoji);
            if (idx >= 0) {
              groups[idx] = {
                ...groups[idx],
                count: groups[idx].count + 1,
                reactedByMe: groups[idx].reactedByMe || p.userId === uid,
              };
            } else {
              groups.push({ emoji: p.emoji!, count: 1, reactedByMe: p.userId === uid });
            }
          } else {
            const idx = groups.findIndex((g) => g.emoji === p.emoji);
            if (idx >= 0) {
              const newCount = groups[idx].count - 1;
              if (newCount <= 0) {
                groups.splice(idx, 1);
              } else {
                groups[idx] = {
                  ...groups[idx],
                  count: newCount,
                  reactedByMe: p.userId === uid ? false : groups[idx].reactedByMe,
                };
              }
            }
          }
          if (groups.length === 0) next.delete(p.messageId!);
          else next.set(p.messageId!, groups.sort((a, b) => b.count - a.count));
          return next;
        });
      })
      .subscribe();

    callChannelRef.current = channel;

    return () => {
      if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
        callChannelRef.current = null;
      }
      if (typingResetTimerRef.current) clearTimeout(typingResetTimerRef.current);
    };
  }, [conversationId, userId]);

  const notifyTyping = useCallback(
    (text: string) => {
      if (!callChannelRef.current || !userId || !conversationId) return;
      if (text.length > 0) {
        sendTypingSignal(callChannelRef.current, userId, conversationId).catch(() => null);
      } else {
        sendTypingStop(callChannelRef.current, userId, conversationId).catch(() => null);
      }
    },
    [userId, conversationId],
  );

  const stopTyping = useCallback(() => {
    if (!callChannelRef.current || !userId || !conversationId) return;
    sendTypingStop(callChannelRef.current, userId, conversationId).catch(() => null);
  }, [userId, conversationId]);

  return {
    messages,
    setMessages,
    reactionsMap,
    setReactionsMap,
    pinnedMessages,
    setPinnedMessages,
    peerTyping,
    peerIsOnline,
    peerLastSeen,
    callChannel: callChannelRef.current,
    loadThread,
    refreshPinnedMessages,
    notifyTyping,
    stopTyping,
  };
}
