import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getCurrentUserId, getTotalDmUnread, listConversations } from '@/lib/dm';
import { decryptDmCallPayload, isEncryptedEnvelope } from '@/lib/dmE2ee';
import { supabase } from '@/lib/supabase';
import type { DmConversation } from '@/lib/types';

export type GlobalIncomingCall = {
  conversationId: string;
  fromId: string;
  fromName: string;
  fromAvatarUrl: string | null;
  mode: 'audio' | 'video';
};

export type GlobalMessageToast = {
  conversationId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  preview: string;
};

type GlobalNotificationsContextValue = {
  incomingCall: GlobalIncomingCall | null;
  dismissIncomingCall: () => void;
  acceptIncomingCall: () => void;
  declineIncomingCall: () => void;
  messageToast: GlobalMessageToast | null;
  dismissMessageToast: () => void;
  totalUnread: number;
  refreshUnread: () => void;
  setActiveConversationId: (id: string | null) => void;
  consumePendingIncomingInvite: (convId: string) => GlobalIncomingCall | null;
};

const GlobalNotificationsContext = createContext<GlobalNotificationsContextValue | null>(null);

export function GlobalNotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [incomingCall, _setIncomingCall] = useState<GlobalIncomingCall | null>(null);
  const [messageToast, setMessageToast] = useState<GlobalMessageToast | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);

  // Refs to avoid stale closures in async callbacks
  const incomingCallRef = useRef<GlobalIncomingCall | null>(null);
  const uidRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const callChannelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const messageChannelRef = useRef<RealtimeChannel | null>(null);
  const conversationsRef = useRef<DmConversation[]>([]);
  const pendingInviteRef = useRef<GlobalIncomingCall | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setIncomingCall = useCallback((val: GlobalIncomingCall | null) => {
    incomingCallRef.current = val;
    _setIncomingCall(val);
  }, []);

  const setActiveConversationId = useCallback((id: string | null) => {
    activeConversationIdRef.current = id;
  }, []);

  const consumePendingIncomingInvite = useCallback((convId: string): GlobalIncomingCall | null => {
    const pending = pendingInviteRef.current;
    if (pending && pending.conversationId === convId) {
      pendingInviteRef.current = null;
      return pending;
    }
    return null;
  }, []);

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, [setIncomingCall]);

  const acceptIncomingCall = useCallback(() => {
    const current = incomingCallRef.current;
    if (!current) return;
    pendingInviteRef.current = current;
    setIncomingCall(null);
    router.push({
      pathname: '/chat-thread',
      params: { conversationId: current.conversationId },
    });
  }, [router, setIncomingCall]);

  const declineIncomingCall = useCallback(() => {
    const current = incomingCallRef.current;
    if (!current) return;
    const uid = uidRef.current;
    const channel = callChannelsRef.current.get(current.conversationId);
    if (channel && uid) {
      channel
        .send({
          type: 'broadcast',
          event: 'dm-call-decline',
          payload: {
            fromId: uid,
            toId: current.fromId,
            conversationId: current.conversationId,
          },
        })
        .catch(() => null);
    }
    setIncomingCall(null);
  }, [setIncomingCall]);

  const dismissMessageToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setMessageToast(null);
  }, []);

  const refreshUnread = useCallback(() => {
    const uid = uidRef.current;
    if (!uid) return;
    getTotalDmUnread(uid)
      .then((count) => setTotalUnread(count))
      .catch(() => null);
  }, []);

  const subscribeToCallChannel = useCallback(
    (convId: string, uid: string, peerId: string) => {
      if (callChannelsRef.current.has(convId)) return;

      const channel = supabase.channel(`dm-call-${convId}`);

      channel.on('broadcast', { event: 'dm-call-invite' }, async (msg) => {
        const payload = msg.payload as Record<string, unknown>;
        const fromId = typeof payload.fromId === 'string' ? payload.fromId : null;
        const toId = typeof payload.toId === 'string' ? payload.toId : null;

        if (!fromId || fromId === uid) return;
        if (toId && toId !== uid) return;
        if (activeConversationIdRef.current === convId) return;

        // Outer (non-sensitive) fields always present for fallback
        const outerFromName = typeof payload.fromName === 'string' ? payload.fromName : 'User';
        const outerMode: 'audio' | 'video' = payload.mode === 'video' ? 'video' : 'audio';
        let fromName = outerFromName;
        let mode: 'audio' | 'video' = outerMode;

        // Try E2EE decrypt for sensitive inner payload
        if (typeof payload.enc === 'string') {
          try {
            const decrypted = await decryptDmCallPayload({
              conversationId: convId,
              userId: uid,
              peerId: fromId,
              envelope: payload.enc,
            });
            if (typeof decrypted.fromName === 'string') fromName = decrypted.fromName;
            if (decrypted.mode === 'video' || decrypted.mode === 'audio') {
              mode = decrypted.mode as 'audio' | 'video';
            }
          } catch {
            // fallback to outer fields
          }
        }

        // Fetch caller avatar
        let fromAvatarUrl: string | null = null;
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', fromId)
            .maybeSingle<{ avatar_url: string | null }>();
          fromAvatarUrl = profile?.avatar_url ?? null;
        } catch {
          // ignore
        }

        setIncomingCall({ conversationId: convId, fromId, fromName, fromAvatarUrl, mode });
      });

      channel.subscribe();
      callChannelsRef.current.set(convId, channel);
    },
    [setIncomingCall],
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const uid = await getCurrentUserId();
      if (!uid || !mounted) return;
      uidRef.current = uid;

      const convs = await listConversations(uid).catch(() => [] as DmConversation[]);
      if (!mounted) return;
      conversationsRef.current = convs;

      // Subscribe to call channels for all existing conversations
      for (const conv of convs) {
        const peerId = conv.user_a === uid ? conv.user_b : conv.user_a;
        subscribeToCallChannel(conv.id, uid, peerId);
      }

      // Subscribe to new DM messages (global — RLS controls row visibility)
      const msgChannel = supabase
        .channel(`global-dm-messages-${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'dm_messages' },
          (change) => {
            const row = change.new as {
              id: string;
              conversation_id: string;
              sender_id: string;
              body: string;
            };
            if (!row || row.sender_id === uid) return;
            if (activeConversationIdRef.current === row.conversation_id) return;

            const preview = isEncryptedEnvelope(row.body) ? 'New message' : row.body.slice(0, 80);
            const conv = conversationsRef.current.find((c) => c.id === row.conversation_id);
            const senderName = conv?.peer_name ?? 'Someone';
            const senderAvatarUrl = conv?.peer_avatar_url ?? null;

            setMessageToast({ conversationId: row.conversation_id, senderName, senderAvatarUrl, preview });
            setTotalUnread((n) => n + 1);

            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => {
              setMessageToast(null);
              toastTimerRef.current = null;
            }, 4000);
          },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'dm_conversations' },
          async (change) => {
            const row = change.new as { id: string; user_a: string; user_b: string };
            if (!row) return;
            if (row.user_a !== uid && row.user_b !== uid) return;
            const peerId = row.user_a === uid ? row.user_b : row.user_a;
            subscribeToCallChannel(row.id, uid, peerId);
            // Refresh cached conversations list
            const updated = await listConversations(uid).catch(() => conversationsRef.current);
            conversationsRef.current = updated;
          },
        )
        .subscribe();

      if (mounted) {
        messageChannelRef.current = msgChannel;
      }

      const unread = await getTotalDmUnread(uid).catch(() => 0);
      if (mounted) setTotalUnread(unread);
    };

    init().catch(() => null);

    return () => {
      mounted = false;
      callChannelsRef.current.forEach((ch) => supabase.removeChannel(ch));
      callChannelsRef.current.clear();
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [subscribeToCallChannel]);

  return (
    <GlobalNotificationsContext.Provider
      value={{
        incomingCall,
        dismissIncomingCall,
        acceptIncomingCall,
        declineIncomingCall,
        messageToast,
        dismissMessageToast,
        totalUnread,
        refreshUnread,
        setActiveConversationId,
        consumePendingIncomingInvite,
      }}
    >
      {children}
    </GlobalNotificationsContext.Provider>
  );
}

export function useGlobalNotifications(): GlobalNotificationsContextValue {
  const ctx = useContext(GlobalNotificationsContext);
  if (!ctx) throw new Error('useGlobalNotifications must be used within a GlobalNotificationsProvider');
  return ctx;
}
