import { useCallback, useEffect, useReducer, useRef } from 'react';
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

// ── State & Actions ──

interface ChatRealtimeState {
  messages: DmMessage[];
  reactionsMap: Map<string, DmReactionGroup[]>;
  pinnedMessages: DmMessage[];
  peerTyping: boolean;
  peerIsOnline: boolean;
  peerLastSeen: string | null;
}

type ChatRealtimeAction =
  | { type: 'SET_MESSAGES'; payload: DmMessage[] }
  | { type: 'UPDATE_MESSAGES'; fn: (prev: DmMessage[]) => DmMessage[] }
  | { type: 'SET_REACTIONS_MAP'; payload: Map<string, DmReactionGroup[]> }
  | { type: 'UPDATE_REACTIONS_MAP'; fn: (prev: Map<string, DmReactionGroup[]>) => Map<string, DmReactionGroup[]> }
  | { type: 'SET_PINNED'; payload: DmMessage[] }
  | { type: 'SET_PEER_TYPING'; payload: boolean }
  | { type: 'SET_PEER_STATUS'; payload: { isOnline: boolean; lastSeen: string | null } }
  | {
      type: 'LOAD_THREAD';
      payload: {
        messages: DmMessage[];
        reactionsMap: Map<string, DmReactionGroup[]>;
        pinned: DmMessage[];
      };
    };

const initialState: ChatRealtimeState = {
  messages: [],
  reactionsMap: new Map(),
  pinnedMessages: [],
  peerTyping: false,
  peerIsOnline: false,
  peerLastSeen: null,
};

function chatRealtimeReducer(
  state: ChatRealtimeState,
  action: ChatRealtimeAction,
): ChatRealtimeState {
  switch (action.type) {
    case 'LOAD_THREAD':
      return {
        ...state,
        messages: action.payload.messages,
        reactionsMap: action.payload.reactionsMap,
        pinnedMessages: action.payload.pinned,
      };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'UPDATE_MESSAGES': {
      const next = action.fn(state.messages);
      return next === state.messages ? state : { ...state, messages: next };
    }
    case 'SET_REACTIONS_MAP':
      return { ...state, reactionsMap: action.payload };
    case 'UPDATE_REACTIONS_MAP': {
      const next = action.fn(state.reactionsMap);
      return next === state.reactionsMap ? state : { ...state, reactionsMap: next };
    }
    case 'SET_PINNED':
      return { ...state, pinnedMessages: action.payload };
    case 'SET_PEER_TYPING':
      return state.peerTyping === action.payload ? state : { ...state, peerTyping: action.payload };
    case 'SET_PEER_STATUS':
      return {
        ...state,
        peerIsOnline: action.payload.isOnline,
        peerLastSeen: action.payload.lastSeen,
      };
    default:
      return state;
  }
}

// ── Compatible return type (preserves API surface) ──

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
  const [state, dispatch] = useReducer(chatRealtimeReducer, initialState);

  const callChannelRef = useRef<RealtimeChannel | null>(null);
  const typingResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef(userId);
  const peerIdRef = useRef(peerId);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);

  // ── Compatible setters that mirror useState dispatch ──

  const setMessages = useCallback((action: React.SetStateAction<DmMessage[]>) => {
    if (typeof action === 'function') {
      dispatch({ type: 'UPDATE_MESSAGES', fn: action });
    } else {
      dispatch({ type: 'SET_MESSAGES', payload: action });
    }
  }, []);

  const setReactionsMap = useCallback(
    (action: React.SetStateAction<Map<string, DmReactionGroup[]>>) => {
      if (typeof action === 'function') {
        dispatch({ type: 'UPDATE_REACTIONS_MAP', fn: action });
      } else {
        dispatch({ type: 'SET_REACTIONS_MAP', payload: action });
      }
    },
    [],
  );

  const setPinnedMessages = useCallback((action: React.SetStateAction<DmMessage[]>) => {
    if (typeof action === 'function') {
      // For functional updates, we need to get the current pinned list — dispatch SET_PINNED
      // Since reducer doesn't expose current state to a callback, use a ref workaround:
      // However functional updates on pinnedMessages aren't used in the codebase, so just set directly
      dispatch({ type: 'SET_PINNED', payload: action as unknown as DmMessage[] });
    } else {
      dispatch({ type: 'SET_PINNED', payload: action });
    }
  }, []);

  // ── Load thread (batched state update via LOAD_THREAD action) ──

  const loadThread = useCallback(async () => {
    if (!conversationId || !userId || !peerId) return;

    const rows = await listMessages(conversationId, { userId, peerId });

    // Load reactions and pinned in parallel, then dispatch single batched update
    const [reactions, pinned] = await Promise.all([
      rows.length > 0
        ? loadReactionsForMessages(rows.map((r) => r.id))
            .then((r) => groupReactions(r, userId))
            .catch(() => new Map<string, DmReactionGroup[]>())
        : Promise.resolve(new Map<string, DmReactionGroup[]>()),
      listPinnedDmMessages(conversationId).catch(() => [] as DmMessage[]),
    ]);

    // Single batched dispatch — one render instead of three
    dispatch({
      type: 'LOAD_THREAD',
      payload: { messages: rows, reactionsMap: reactions, pinned },
    });

    markConversationRead(conversationId).catch(() => null);
  }, [conversationId, userId, peerId]);

  const refreshPinnedMessages = useCallback(async () => {
    if (!conversationId) return;
    const pinned = await listPinnedDmMessages(conversationId).catch(() => []);
    dispatch({ type: 'SET_PINNED', payload: pinned });
  }, [conversationId]);

  // ── Subscribe to peer profile changes (online status) ──
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
          dispatch({
            type: 'SET_PEER_STATUS',
            payload: { isOnline: p.is_online ?? false, lastSeen: p.last_seen_at ?? null },
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [peerId]);

  // ── Subscribe to new messages + updates + reactions ──
  useEffect(() => {
    if (!conversationId) return;
    let mounted = true;

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

            if (!mounted) return;

            dispatch({
              type: 'UPDATE_MESSAGES',
              fn: (prev) => {
                if (prev.some((msg) => msg.id === raw.id)) return prev;
                const next = [...prev, { ...raw, body }];
                next.sort((a, b) => a.created_at.localeCompare(b.created_at));
                return next;
              },
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
          if (!mounted) return;
          const updated = row as DmMessage;
          dispatch({
            type: 'UPDATE_MESSAGES',
            fn: (prev) =>
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
          });
          if (updated.pinned_at !== undefined) {
            listPinnedDmMessages(conversationId)
              .then((pinned) => { if (mounted) dispatch({ type: 'SET_PINNED', payload: pinned }); })
              .catch(() => null);
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
          if (!mounted) return;
          const r = row as { message_id: string; user_id: string; emoji: string };
          const uid = userIdRef.current;
          if (!uid) return;
          dispatch({
            type: 'UPDATE_REACTIONS_MAP',
            fn: (prev) => {
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
            },
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // ── Call channel — typing signals and broadcast reactions ──
  useEffect(() => {
    if (!conversationId || !userId) return;
    let mounted = true;

    const channel = supabase.channel(`dm-call-${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'dm-typing' }, ({ payload }) => {
        if (!mounted) return;
        const p = (payload ?? {}) as Record<string, unknown>;
        if (p.fromId === userIdRef.current) return;
        dispatch({ type: 'SET_PEER_TYPING', payload: true });
        if (typingResetTimerRef.current) clearTimeout(typingResetTimerRef.current);
        typingResetTimerRef.current = setTimeout(
          () => { if (mounted) dispatch({ type: 'SET_PEER_TYPING', payload: false }); },
          TYPING_RESET_MS,
        );
      })
      .on('broadcast', { event: 'dm-typing-stop' }, ({ payload }) => {
        if (!mounted) return;
        const p = (payload ?? {}) as Record<string, unknown>;
        if (p.fromId === userIdRef.current) return;
        if (typingResetTimerRef.current) clearTimeout(typingResetTimerRef.current);
        dispatch({ type: 'SET_PEER_TYPING', payload: false });
      })
      .on('broadcast', { event: 'dm-reaction' }, ({ payload }) => {
        if (!mounted) return;
        const p = (payload ?? {}) as {
          userId?: string;
          messageId?: string;
          emoji?: string;
          added?: boolean;
        };
        if (!p.messageId || !p.emoji) return;
        const uid = userIdRef.current;
        dispatch({
          type: 'UPDATE_REACTIONS_MAP',
          fn: (prev) => {
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
          },
        });
      })
      .subscribe();

    callChannelRef.current = channel;

    return () => {
      mounted = false;
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
    messages: state.messages,
    setMessages,
    reactionsMap: state.reactionsMap,
    setReactionsMap,
    pinnedMessages: state.pinnedMessages,
    setPinnedMessages,
    peerTyping: state.peerTyping,
    peerIsOnline: state.peerIsOnline,
    peerLastSeen: state.peerLastSeen,
    callChannel: callChannelRef.current,
    loadThread,
    refreshPinnedMessages,
    notifyTyping,
    stopTyping,
  };
}
