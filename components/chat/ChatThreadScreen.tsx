import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  Modal,
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useTheme } from '@/contexts/ThemeContext';
import { useCall } from '@/contexts/CallContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import { getCurrentUserId, listMessages, markConversationRead, markMessagesDelivered, sendMessage } from '@/lib/dm';
import { loadReactionsForMessages, toggleReaction, groupReactions, broadcastReaction } from '@/lib/dmReactions';
import { blockUser, unblockUser, isBlocked as checkIsBlocked } from '@/lib/connections';
import {
  decryptDmCallPayload,
  decryptDmMessageBody,
  encryptDmCallPayload,
  ensureDmE2eeReady,
  isEncryptedEnvelope,
  isPeerE2eeNotReadyError,
} from '@/lib/dmE2ee';
import { notifyDmMessage, notifyIncomingDmCall } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { showAlert, showConfirm } from '@/lib/alert';
import { DmWebRTCCall } from '@/lib/webrtcCall';
import { setSpeaker, startCallAudio, stopCallAudio } from '@/lib/audioRoute';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { sendTypingSignal, sendTypingStop } from '@/lib/typing';
import { getConversationSettings, setDisappearingMessages } from '@/lib/dmSettings';
import { reportUser, type ReportReason } from '@/lib/report';
import { sendImageMessage, sendVoiceMessage } from '@/lib/dmAttachments';
import type { CallUiState, DmMessage, DmReactionGroup } from '@/lib/types';
import { FullScreenCallOverlay } from '@/components/chat/FullScreenCallOverlay';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { ReactionPicker } from '@/components/chat/ReactionPicker';
import { ScreenshotWarningBanner } from '@/components/chat/ScreenshotWarningBanner';

type CallMode = 'audio' | 'video';
type IncomingInvite = { fromId: string; fromName: string; mode: CallMode };

const OUTGOING_CALL_TIMEOUT_MS = 30_000;
const DM_SIGNAL_E2EE_ENABLED = true;
const TYPING_RESET_MS = 4000;

function getStreamUrl(stream: any | null) {
  if (!stream || typeof stream.toURL !== 'function') return null;
  return stream.toURL();
}

function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ChatThreadScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { colors } = useTheme();
  const { publishCallState, clearCallState, registerEndCallFn } = useCall();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selfName, setSelfName] = useState('Player');
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState('Player');
  const [peerAvatarUrl, setPeerAvatarUrl] = useState<string | null>(null);
  const [peerIsOnline, setPeerIsOnline] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isBlockedState, setIsBlockedState] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [disappearingTtl, setDisappearingTtl] = useState<number | null>(null);
  const [showDisappearingModal, setShowDisappearingModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('spam');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [reactionsMap, setReactionsMap] = useState<Map<string, DmReactionGroup[]>>(new Map());
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<DmMessage | null>(null);

  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);
  const [outgoingMode, setOutgoingMode] = useState<CallMode | null>(null);
  const [activeCallMode, setActiveCallMode] = useState<CallMode>('audio');
  const [callState, setCallState] = useState<CallUiState>('off');
  const [callMuted, setCallMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [opponentMuted, setOpponentMuted] = useState(false);
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const [composerHeight, setComposerHeight] = useState(56);
  const [callOverlayMinimized, setCallOverlayMinimized] = useState(false);

  const callChannelRef = useRef<RealtimeChannel | null>(null);
  const callRef = useRef<DmWebRTCCall | null>(null);
  const callInitPromiseRef = useRef<Promise<DmWebRTCCall | null> | null>(null);
  const callInviteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageListRef = useRef<FlatList<DmMessage> | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const userIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const typingResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);
  useEffect(() => { conversationIdRef.current = conversationId ?? null; }, [conversationId]);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages],
  );

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    const timer = setTimeout(() => {
      messageListRef.current?.scrollToEnd({ animated: true });
    }, 30);
    return () => clearTimeout(timer);
  }, [sortedMessages.length]);

  const onListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    shouldAutoScrollRef.current = distanceFromBottom < 120;
  }, []);

  const clearOutgoingTimer = useCallback(() => {
    if (!callInviteTimeoutRef.current) return;
    clearTimeout(callInviteTimeoutRef.current);
    callInviteTimeoutRef.current = null;
  }, []);

  const buildIceServers = useCallback(() => {
    const list: { urls: string; username?: string; credential?: string }[] = [];
    const stunUrl = process.env.EXPO_PUBLIC_STUN_URL || 'stun:stun.l.google.com:19302';
    if (stunUrl) list.push({ urls: stunUrl });

    const turnUrl = process.env.EXPO_PUBLIC_TURN_URL;
    if (turnUrl) {
      list.push({
        urls: turnUrl,
        username: process.env.EXPO_PUBLIC_TURN_USERNAME,
        credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
      });
    }
    return list;
  }, []);

  const resolveSignalPeerId = useCallback((payload: Record<string, unknown>) => {
    const uid = userIdRef.current;
    const fromId = typeof payload.fromId === 'string' ? payload.fromId : null;
    const toId = typeof payload.toId === 'string' ? payload.toId : null;
    if (uid && fromId && toId) {
      return fromId === uid ? toId : fromId;
    }
    return peerIdRef.current;
  }, []);

  const sendCallSignal = useCallback(async (event: string, payload: Record<string, unknown>) => {
    const channel = callChannelRef.current;
    const uid = userIdRef.current;
    const convId = conversationIdRef.current;
    const resolvedPeerId = resolveSignalPeerId(payload);
    if (!channel || !uid || !convId || !resolvedPeerId) return false;

    const fromId = typeof payload.fromId === 'string' ? payload.fromId : uid;
    const toId = typeof payload.toId === 'string' ? payload.toId : resolvedPeerId;

    const sendPlain = async () => {
      await channel.send({
        type: 'broadcast',
        event,
        payload: { ...payload, conversationId: convId, fromId, toId },
      });
    };

    if (!DM_SIGNAL_E2EE_ENABLED) {
      try {
        await sendPlain();
        return true;
      } catch (error) {
        console.warn('Failed to send plaintext call signal', error);
        return false;
      }
    }

    try {
      const envelope = await encryptDmCallPayload({
        conversationId: convId,
        userId: uid,
        peerId: resolvedPeerId,
        payload,
        forceRefreshPeerKey: event !== 'call-ice',
      });
      await channel.send({
        type: 'broadcast',
        event,
        payload: { ...payload, conversationId: convId, fromId, toId, enc: envelope, v: 1 },
      });
      return true;
    } catch (error) {
      if (!isPeerE2eeNotReadyError(error)) {
        console.warn('Failed to send encrypted call signal; trying plaintext', error);
      }
      try {
        await sendPlain();
        return true;
      } catch (fallbackError) {
        console.warn('Failed to send fallback call signal', fallbackError);
        return false;
      }
    }
  }, [resolveSignalPeerId]);

  const decodeCallSignalPayload = useCallback(
    async (payload: Record<string, unknown>) => {
      if (typeof payload.enc !== 'string') return payload;
      if (!DM_SIGNAL_E2EE_ENABLED) return payload;

      const uid = userIdRef.current;
      const convId =
        typeof payload.conversationId === 'string'
          ? payload.conversationId
          : conversationIdRef.current;
      const resolvedPeerId = resolveSignalPeerId(payload);
      if (!uid || !convId || !resolvedPeerId) return null;

      try {
        const decrypted = await decryptDmCallPayload({
          conversationId: convId,
          userId: uid,
          peerId: resolvedPeerId,
          envelope: payload.enc,
        });
        return { ...payload, ...decrypted };
      } catch {
        return payload;
      }
    },
    [resolveSignalPeerId],
  );

  const endCall = useCallback(
    async (sendEndedSignal: boolean) => {
      clearOutgoingTimer();
      callInitPromiseRef.current = null;
      setIncomingInvite(null);
      setOutgoingMode(null);
      setCallState('off');
      setCallMuted(false);
      setOpponentMuted(false);
      setCameraEnabled(true);
      setSpeakerOn(false);
      setLocalStreamUrl(null);
      setRemoteStreamUrl(null);
      await stopCallAudio().catch(() => null);

      const active = callRef.current;
      callRef.current = null;
      if (active) {
        await active.close(sendEndedSignal).catch(() => null);
      }
    },
    [clearOutgoingTimer],
  );

  const ensureCallClient = useCallback(
    async (mode: CallMode) => {
      if (!conversationIdRef.current || !userIdRef.current) return null;
      if (Platform.OS === 'web') {
        showAlert('Unsupported', 'Audio/video calling is available on Android and iOS builds.');
        return null;
      }
      if (callRef.current) return callRef.current;
      if (callInitPromiseRef.current) return callInitPromiseRef.current;

      const initPromise: Promise<DmWebRTCCall | null> = (async () => {
        const client = new DmWebRTCCall({
          conversationId: conversationIdRef.current!,
          userId: userIdRef.current!,
          mediaMode: mode,
          iceServers: buildIceServers(),
          sendSignal: (event, payload) => {
            void sendCallSignal(event, { ...payload, toId: peerIdRef.current });
          },
          callbacks: {
            onStateChange: (state) => {
              setCallState(state);
              if (state === 'reconnecting' || state === 'off') {
                void sendCallSignal('call-state', {
                  conversationId: conversationIdRef.current,
                  fromId: userIdRef.current,
                  toId: peerIdRef.current,
                  state,
                });
              }
              if (state === 'off') {
                setOutgoingMode(null);
                setSpeakerOn(false);
                setLocalStreamUrl(null);
                setRemoteStreamUrl(null);
                if (callRef.current === client) callRef.current = null;
                void stopCallAudio();
              }
            },
            onLocalStream: (stream) => setLocalStreamUrl(getStreamUrl(stream)),
            onRemoteStream: (stream) => setRemoteStreamUrl(getStreamUrl(stream)),
            onError: (message) => showAlert('Call failed', message),
          },
        });

        await client.init();
        await startCallAudio(mode);
        const defaultSpeaker = mode === 'video';
        await setSpeaker(defaultSpeaker);
        setSpeakerOn(defaultSpeaker);
        callRef.current = client;
        return client;
      })();

      callInitPromiseRef.current = initPromise;
      try {
        return await initPromise;
      } finally {
        if (callInitPromiseRef.current === initPromise) callInitPromiseRef.current = null;
      }
    },
    [buildIceServers, sendCallSignal],
  );

  const loadThread = useCallback(async () => {
    if (!conversationId) return;

    setLoading(true);
    try {
      const uid = await getCurrentUserId();
      setUserId(uid);

      if (!uid) return;
      await ensureDmE2eeReady(uid).catch(() => null);

      const [{ data: me }, { data: conversation }] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', uid)
          .maybeSingle<{ display_name: string | null; username: string | null }>(),
        supabase
          .from('dm_conversations')
          .select('user_a, user_b')
          .eq('id', conversationId)
          .maybeSingle<{ user_a: string; user_b: string }>(),
      ]);

      setSelfName(me?.display_name || me?.username || 'Player');

      if (!conversation) return;
      const nextPeerId = conversation.user_a === uid ? conversation.user_b : conversation.user_a;
      setPeerId(nextPeerId);

      const blocked = await checkIsBlocked(uid, nextPeerId);
      setIsBlockedState(blocked);

      const [rows, , { data: profile }] = await Promise.all([
        listMessages(conversationId, { userId: uid, peerId: nextPeerId }),
        markConversationRead(conversationId),
        supabase
          .from('profiles')
          .select('display_name, username, avatar_url, is_online, last_seen_at')
          .eq('id', nextPeerId)
          .maybeSingle<{ display_name: string | null; username: string | null; avatar_url: string | null; is_online: boolean | null; last_seen_at: string | null }>(),
      ]);
      setMessages(rows);

      // Load reactions for all messages
      if (rows.length > 0 && uid) {
        loadReactionsForMessages(rows.map((r) => r.id))
          .then((reactions) => {
            setReactionsMap(groupReactions(reactions, uid));
          })
          .catch(() => null);
      }

      setPeerName(profile?.display_name || profile?.username || 'Player');
      setPeerAvatarUrl(profile?.avatar_url ?? null);
      setPeerIsOnline(profile?.is_online ?? false);
      setPeerLastSeen(profile?.last_seen_at ?? null);

      // Load conversation settings (disappearing messages)
      getConversationSettings(conversationId)
        .then((settings) => {
          if (settings) setDisappearingTtl(settings.disappearing_messages_ttl ?? null);
        })
        .catch(() => null);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadThread().catch(() => null);
  }, [loadThread]);

  useFocusEffect(
    useCallback(() => {
      if (conversationId) {
        markConversationRead(conversationId).catch(() => null);
      }
      return undefined;
    }, [conversationId]),
  );

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

  // Subscribe to new messages
  useEffect(() => {
    if (!conversationId) return;
    const channel: RealtimeChannel = supabase
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

            // Mark as delivered when we receive a new message from peer
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
          // Update message status in-place
          const updated = row as DmMessage;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updated.id ? { ...msg, status: updated.status } : msg,
            ),
          );
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

  // Call channel — also handles typing signals
  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase.channel(`dm-call-${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    const unwrapPayload = async (payload: Record<string, unknown>) => {
      const toId = typeof payload.toId === 'string' ? payload.toId : null;
      const currentUserId = userIdRef.current;
      if (toId && currentUserId && toId !== currentUserId) return null;
      return decodeCallSignalPayload(payload);
    };

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
      .on('broadcast', { event: 'dm-settings-update' }, ({ payload }) => {
        const p = (payload ?? {}) as Record<string, unknown>;
        if (p.fromId === userIdRef.current) return;
        if (typeof p.disappearing_ttl === 'number' || p.disappearing_ttl === null) {
          setDisappearingTtl(p.disappearing_ttl as number | null);
        }
      })
      .on('broadcast', { event: 'dm-call-invite' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data) return;
          if (data.fromId === userIdRef.current) return;
          const fromId = typeof data.fromId === 'string' ? data.fromId : null;
          if (!fromId) return;
          setIncomingInvite({
            fromId,
            fromName: typeof data.fromName === 'string' ? data.fromName : 'Player',
            mode: data.mode === 'video' ? 'video' : 'audio',
          });
        })();
      })
      .on('broadcast', { event: 'dm-call-accept' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data || data.toId !== userIdRef.current) return;
          const mode: CallMode = data.mode === 'video' ? 'video' : 'audio';
          clearOutgoingTimer();
          setOutgoingMode(null);
          setActiveCallMode(mode);
          setCameraEnabled(mode === 'video');
          const client = await ensureCallClient(mode);
          if (!client) return;
          await client.startAsCaller();
        })();
      })
      .on('broadcast', { event: 'dm-call-decline' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data || data.toId !== userIdRef.current) return;
          clearOutgoingTimer();
          setOutgoingMode(null);
          showAlert('Call declined', `${typeof data.fromName === 'string' ? data.fromName : 'Peer'} declined your call.`);
        })();
      })
      .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data) return;
          if (data.toId && data.toId !== userIdRef.current) return;
          if (data.conversationId !== conversationIdRef.current) return;
          if (!data.offer) return;

          const mode: CallMode = data.mediaMode === 'video' ? 'video' : 'audio';
          setActiveCallMode(mode);
          setCameraEnabled(mode === 'video');
          setIncomingInvite(null);
          const client = await ensureCallClient(mode);
          if (!client) return;
          await client.handleOffer(data.offer as { type: 'offer' | 'answer'; sdp: string });
        })();
      })
      .on('broadcast', { event: 'call-answer' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data) return;
          if (data.toId && data.toId !== userIdRef.current) return;
          if (data.conversationId !== conversationIdRef.current) return;
          if (!data.answer || !callRef.current) return;
          await callRef.current.handleAnswer(data.answer as { type: 'offer' | 'answer'; sdp: string });
        })();
      })
      .on('broadcast', { event: 'call-ice' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data) return;
          if (data.toId && data.toId !== userIdRef.current) return;
          if (data.conversationId !== conversationIdRef.current) return;
          if (!data.candidate || !callRef.current) return;
          await callRef.current.handleIceCandidate(data.candidate as Record<string, unknown>);
        })();
      })
      .on('broadcast', { event: 'call-ended' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data) return;
          if (data.toId && data.toId !== userIdRef.current) return;
          if (data.conversationId !== conversationIdRef.current) return;
          await endCall(false);
        })();
      })
      .on('broadcast', { event: 'call-state' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data) return;
          if (data.toId && data.toId !== userIdRef.current) return;
          if (data.conversationId !== conversationIdRef.current) return;

          if (data.state === 'reconnecting') {
            setCallState('reconnecting');
            return;
          }
          if (data.state === 'off') {
            await endCall(false);
          }
        })();
      })
      .on('broadcast', { event: 'call-mute' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data) return;
          if (data.toId && data.toId !== userIdRef.current) return;
          if (data.conversationId !== conversationIdRef.current) return;
          setOpponentMuted(!!data.muted);
        })();
      })
      .on('broadcast', { event: 'dm-reaction' }, ({ payload }) => {
        const p = (payload ?? {}) as { userId?: string; messageId?: string; emoji?: string; added?: boolean };
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
          if (groups.length === 0) {
            next.delete(p.messageId!);
          } else {
            next.set(p.messageId!, groups.sort((a, b) => b.count - a.count));
          }
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
    };
  }, [conversationId, userId, clearOutgoingTimer, decodeCallSignalPayload, ensureCallClient, endCall]);

  useEffect(() => {
    return () => {
      clearOutgoingTimer();
      void endCall(false);
      if (typingResetTimerRef.current) clearTimeout(typingResetTimerRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recording?.stopAndUnloadAsync().catch(() => null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearOutgoingTimer, endCall]);

  // Register endCall fn with context so PiP can end the call
  useEffect(() => {
    registerEndCallFn(() => endCall(true));
    return () => registerEndCallFn(null);
  }, [endCall, registerEndCallFn]);

  // Sync call state to context for PiP display
  useEffect(() => {
    if (callState === 'off' && !incomingInvite && !outgoingMode) {
      clearCallState();
      return;
    }
    if (!conversationId || !peerId) return;
    publishCallState({
      conversationId,
      peerId,
      peerName,
      peerAvatarUrl,
      callState,
      callMode: activeCallMode,
      callMuted,
      remoteStreamUrl,
      localStreamUrl,
    });
  }, [callState, incomingInvite, outgoingMode, callMuted, remoteStreamUrl, localStreamUrl, activeCallMode,
      conversationId, peerId, peerName, peerAvatarUrl, publishCallState, clearCallState]);

  async function pickImage(fromCamera: boolean) {
    if (!conversationId || isBlockedState) return;
    try {
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      shouldAutoScrollRef.current = true;
      const row = await sendImageMessage(
        conversationId,
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
        asset.width,
        asset.height,
      );
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        const next = [...prev, row];
        next.sort((a, b) => a.created_at.localeCompare(b.created_at));
        return next;
      });
    } catch (e: any) {
      showAlert('Failed', e?.message ?? 'Could not send image');
    }
  }

  async function startRecording() {
    if (isRecording || !conversationId || isBlockedState) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permission required', 'Microphone access is needed to send voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (e: any) {
      showAlert('Recording failed', e?.message ?? 'Could not start recording');
    }
  }

  async function stopRecording() {
    if (!recording || !conversationId) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const duration = recordingDuration;
    setIsRecording(false);
    setRecordingDuration(0);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;
      shouldAutoScrollRef.current = true;
      const row = await sendVoiceMessage(conversationId, uri, duration);
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        const next = [...prev, row];
        next.sort((a, b) => a.created_at.localeCompare(b.created_at));
        return next;
      });
    } catch (e: any) {
      showAlert('Failed', e?.message ?? 'Could not send voice message');
    }
  }

  async function onSend() {
    if (!conversationId || sending) return;
    const body = input.trim();
    if (!body) return;
    shouldAutoScrollRef.current = true;

    const replyToId = replyTarget?.id ?? null;

    // Stop typing signal
    if (callChannelRef.current && userId && conversationId) {
      sendTypingStop(callChannelRef.current, userId, conversationId).catch(() => null);
    }

    setSending(true);
    try {
      const row = await sendMessage(conversationId, body, replyToId);
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === row.id)) return prev;
        const next = [...prev, row];
        next.sort((a, b) => a.created_at.localeCompare(b.created_at));
        return next;
      });
      setInput('');
      setReplyTarget(null);
      void notifyDmMessage(row.id).catch((error) => {
        console.warn('DM push notify failed', error);
      });
    } catch (e: any) {
      showAlert('Send failed', e?.message ?? 'Could not send message');
    } finally {
      setSending(false);
    }
  }

  function onInputChange(text: string) {
    setInput(text);
    if (callChannelRef.current && userId && conversationId) {
      if (text.length > 0) {
        sendTypingSignal(callChannelRef.current, userId, conversationId).catch(() => null);
      } else {
        sendTypingStop(callChannelRef.current, userId, conversationId).catch(() => null);
      }
    }
  }

  const handleLongPress = useCallback((messageId: string) => {
    setReactionPickerMessageId(messageId);
  }, []);

  const handleReactionSelect = useCallback(async (messageId: string, emoji: string) => {
    setReactionPickerMessageId(null);
    const uid = userIdRef.current;
    if (!uid) return;

    // Optimistic update
    setReactionsMap((prev) => {
      const next = new Map(prev);
      const groups = [...(next.get(messageId) ?? [])];
      const idx = groups.findIndex((g) => g.emoji === emoji);
      if (idx >= 0 && groups[idx].reactedByMe) {
        const newCount = groups[idx].count - 1;
        if (newCount <= 0) groups.splice(idx, 1);
        else groups[idx] = { ...groups[idx], count: newCount, reactedByMe: false };
      } else if (idx >= 0) {
        groups[idx] = { ...groups[idx], count: groups[idx].count + 1, reactedByMe: true };
      } else {
        groups.push({ emoji, count: 1, reactedByMe: true });
      }
      if (groups.length === 0) next.delete(messageId);
      else next.set(messageId, groups.sort((a, b) => b.count - a.count));
      return next;
    });

    try {
      const result = await toggleReaction(messageId, emoji);
      if (callChannelRef.current) {
        broadcastReaction(callChannelRef.current, uid, messageId, emoji, result.added).catch(() => null);
      }
    } catch {
      // Re-fetch reactions for this message to restore correct state
      loadReactionsForMessages([messageId])
        .then((reactions) => {
          const currentUid = userIdRef.current;
          if (!currentUid) return;
          const refreshed = groupReactions(reactions, currentUid).get(messageId) ?? [];
          setReactionsMap((prev) => {
            const next = new Map(prev);
            if (refreshed.length === 0) next.delete(messageId);
            else next.set(messageId, refreshed);
            return next;
          });
        })
        .catch(() => null);
    }
  }, []);

  const handleSwipeReply = useCallback((message: DmMessage) => {
    setReplyTarget(message);
  }, []);

  const clearReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  async function startCall(mode: CallMode) {
    if (!conversationId || !userId || !peerId) return;
    if (outgoingMode || callState !== 'off') return;
    if (Platform.OS === 'web') {
      showAlert('Unsupported', 'Audio/video calling is available on Android and iOS builds.');
      return;
    }

    setOutgoingMode(mode);
    setActiveCallMode(mode);
    setCameraEnabled(mode === 'video');
    setOpponentMuted(false);
    const sent = await sendCallSignal('dm-call-invite', {
      conversationId,
      fromId: userId,
      toId: peerId,
      fromName: selfName,
      mode,
    });
    if (!sent) {
      setOutgoingMode(null);
      showAlert('Call failed', 'Unable to send encrypted call invite.');
      return;
    }
    void notifyIncomingDmCall(conversationId, peerId, selfName, mode).catch((error) => {
      console.warn('DM call push notify failed', error);
    });

    clearOutgoingTimer();
    callInviteTimeoutRef.current = setTimeout(() => {
      setOutgoingMode(null);
      showAlert('No answer', `${peerName} did not answer.`);
    }, OUTGOING_CALL_TIMEOUT_MS);
  }

  async function acceptIncomingCall() {
    if (!conversationId || !userId || !incomingInvite) return;
    setActiveCallMode(incomingInvite.mode);
    setCameraEnabled(incomingInvite.mode === 'video');
    const sent = await sendCallSignal('dm-call-accept', {
      conversationId,
      fromId: userId,
      toId: incomingInvite.fromId,
      mode: incomingInvite.mode,
    });
    if (!sent) {
      showAlert('Call failed', 'Unable to send encrypted call accept.');
      return;
    }
    setIncomingInvite(null);
  }

  async function declineIncomingCall() {
    if (!conversationId || !userId || !incomingInvite) return;
    await sendCallSignal('dm-call-decline', {
      conversationId,
      fromId: userId,
      fromName: selfName,
      toId: incomingInvite.fromId,
    });
    setIncomingInvite(null);
  }

  function toggleMute() {
    if (!callRef.current) return;
    const muted = callRef.current.toggleMute();
    setCallMuted(muted);
    void sendCallSignal('call-mute', {
      conversationId,
      userId,
      toId: peerId,
      muted,
    });
  }

  function toggleCamera() {
    if (!callRef.current || activeCallMode !== 'video') return;
    const enabled = callRef.current.toggleVideoEnabled();
    setCameraEnabled(enabled);
  }

  async function toggleSpeakerMode() {
    if (callState === 'off') return;
    const next = !speakerOn;
    const ok = await setSpeaker(next);
    if (!ok) {
      showAlert('Audio route', 'Unable to change speaker route on this device.');
      return;
    }
    setSpeakerOn(next);
  }

  const renderMessageItem = useCallback(
    ({ item }: { item: DmMessage }) => {
      const replyTo = item.reply_to_id
        ? messages.find((m) => m.id === item.reply_to_id) ?? null
        : null;
      return (
        <MessageBubble
          item={item}
          isOwn={item.sender_id === userId}
          playingVoiceId={playingVoiceId}
          reactions={reactionsMap.get(item.id) ?? []}
          replyTo={replyTo}
          peerName={peerName}
          currentUserId={userId ?? undefined}
          onImagePress={(url) => {
            router.push({ pathname: '/image-viewer', params: { url } });
          }}
          onVoicePress={(url, id) => {
            setPlayingVoiceId((prev) => (prev === id ? null : id));
          }}
          onLongPress={() => handleLongPress(item.id)}
          onReactionPress={(emoji) => { void handleReactionSelect(item.id, emoji); }}
          onSwipeReply={() => handleSwipeReply(item)}
          onReplyQuotePress={() => {
            const idx = sortedMessages.findIndex((m) => m.id === item.reply_to_id);
            if (idx >= 0) {
              messageListRef.current?.scrollToIndex({
                index: idx,
                animated: true,
                viewPosition: 0.3,
              });
            }
          }}
        />
      );
    },
    [userId, playingVoiceId, router, messages, reactionsMap, peerName, sortedMessages, handleLongPress, handleReactionSelect, handleSwipeReply],
  );

  const showCallOverlay = !!incomingInvite || !!outgoingMode || callState !== 'off';
  const callStartDisabled = !peerId || !!outgoingMode || callState !== 'off';

  useEffect(() => {
    if (showCallOverlay) setCallOverlayMinimized(false);
  }, [showCallOverlay]);

  if (!conversationId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <Text style={{ color: colors.textSecondary }}>Conversation not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const headerSubtitle = peerIsOnline
    ? 'Online'
    : peerLastSeen
    ? `Last seen ${formatLastSeen(peerLastSeen)}`
    : 'Direct message';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <View style={styles.avatarWrap}>
          {peerAvatarUrl ? (
            <Image source={{ uri: peerAvatarUrl }} style={styles.headerAvatarImage} />
          ) : (
            <View style={[styles.headerAvatarFallback, { backgroundColor: `${colors.primary}16` }]}>
              <Text style={[styles.headerAvatarText, { color: colors.primary }]}>
                {peerName.slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          {peerIsOnline && <View style={[styles.onlineDot, { backgroundColor: '#22c55e' }]} />}
        </View>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {peerName}
          </Text>
          <Text style={[styles.headerSubtitle, { color: peerIsOnline ? '#22c55e' : colors.textSecondary }]}>
            {headerSubtitle}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => void startCall('audio')}
            disabled={callStartDisabled || isBlockedState}
            style={[
              styles.headerActionBtn,
              {
                opacity: callStartDisabled || isBlockedState ? 0.45 : 1,
                backgroundColor: `${colors.primary}14`,
              },
            ]}
          >
            <Ionicons name="call-outline" size={16} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => void startCall('video')}
            disabled={callStartDisabled || isBlockedState}
            style={[
              styles.headerActionBtn,
              {
                opacity: callStartDisabled || isBlockedState ? 0.45 : 1,
                backgroundColor: `${colors.secondary}14`,
              },
            ]}
          >
            <Ionicons name="videocam-outline" size={16} color={colors.secondary} />
          </Pressable>
          <Pressable
            onPress={async () => {
              if (!peerId) return;
              if (isBlockedState) {
                const confirmed = await showConfirm(
                  'Unblock User',
                  `Unblock ${peerName}? You'll need to reconnect before messaging.`,
                  'Unblock',
                );
                if (!confirmed) return;
                try {
                  await unblockUser(peerId);
                  setIsBlockedState(false);
                } catch { /* ignore */ }
              } else {
                const confirmed = await showConfirm(
                  'Block User',
                  `Block ${peerName}? You won't be able to send or receive messages.`,
                  'Block',
                );
                if (!confirmed) return;
                try {
                  await blockUser(peerId);
                  setIsBlockedState(true);
                } catch { /* ignore */ }
              }
            }}
            style={[
              styles.headerActionBtn,
              { backgroundColor: isBlockedState ? `${colors.warning}14` : `${colors.wrong}14` },
            ]}
          >
            <Ionicons
              name={isBlockedState ? 'ban' : 'ban-outline'}
              size={16}
              color={isBlockedState ? colors.warning : colors.wrong}
            />
          </Pressable>
          <Pressable
            onPress={() => setShowDisappearingModal(true)}
            style={[styles.headerActionBtn, { backgroundColor: `${colors.primary}10` }]}
          >
            <Ionicons
              name={disappearingTtl ? 'timer' : 'timer-outline'}
              size={16}
              color={disappearingTtl ? colors.primary : colors.textSecondary}
            />
          </Pressable>
          <Pressable
            onPress={() => setShowReportModal(true)}
            style={[styles.headerActionBtn, { backgroundColor: `${colors.wrong}10` }]}
          >
            <Ionicons name="flag-outline" size={16} color={colors.wrong} />
          </Pressable>
        </View>
      </View>

      <ScreenshotWarningBanner />

      <FullScreenCallOverlay
        visible={showCallOverlay && !callOverlayMinimized}
        onMinimize={() => setCallOverlayMinimized(true)}
        callState={callState}
        activeCallMode={activeCallMode}
        incomingInvite={incomingInvite}
        outgoingMode={outgoingMode}
        peerName={peerName}
        peerAvatarUrl={peerAvatarUrl}
        callMuted={callMuted}
        cameraEnabled={cameraEnabled}
        speakerOn={speakerOn}
        opponentMuted={opponentMuted}
        localStreamUrl={localStreamUrl}
        remoteStreamUrl={remoteStreamUrl}
        onAccept={() => void acceptIncomingCall()}
        onDecline={() => void declineIncomingCall()}
        onEndCall={() => void endCall(true)}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleSpeaker={() => void toggleSpeakerMode()}
      />

      {showCallOverlay && callOverlayMinimized && (
        <Pressable
          onPress={() => setCallOverlayMinimized(false)}
          style={[styles.callBar, { backgroundColor: colors.correct }]}
        >
          <Ionicons name={activeCallMode === 'video' ? 'videocam' : 'call'} size={16} color="#fff" />
          <Text style={styles.callBarText} numberOfLines={1}>
            {activeCallMode === 'video' ? 'Video' : 'Voice'} call with {peerName}
          </Text>
          <Ionicons name="chevron-up" size={18} color="#fff" />
        </Pressable>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <FlatList
            ref={messageListRef}
            style={styles.log}
            contentContainerStyle={[
              styles.logContent,
              { paddingBottom: composerHeight + insets.bottom + spacing.sm },
            ]}
            data={sortedMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            onScroll={onListScroll}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No messages yet. Say hi.</Text>
            }
            ListFooterComponent={
              peerTyping ? (
                <View style={styles.typingRow}>
                  <Text style={[styles.typingText, { color: colors.textSecondary }]}>
                    {peerName} is typing...
                  </Text>
                </View>
              ) : null
            }
          />

          {replyTarget && (
            <View style={[styles.replyBar, { backgroundColor: colors.surfaceVariant, borderTopColor: colors.border, borderLeftColor: colors.primary }]}>
              <View style={styles.replyBarContent}>
                <Text style={[styles.replyBarName, { color: colors.primary }]} numberOfLines={1}>
                  {replyTarget.sender_id === userId ? 'You' : peerName}
                </Text>
                <Text style={[styles.replyBarBody, { color: colors.textSecondary }]} numberOfLines={1}>
                  {(replyTarget.message_type === 'image' ? '[image]'
                    : replyTarget.message_type === 'voice' ? '[voice message]'
                    : replyTarget.message_type === 'file' ? '[file]'
                    : replyTarget.message_type === 'video' ? '[video]'
                    : replyTarget.body) || ''}
                </Text>
              </View>
              <Pressable onPress={clearReply} style={styles.replyBarClose}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}

          <View
            style={[
              styles.composer,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, spacing.sm),
              },
            ]}
            onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
          >
            <Pressable
              onPress={() => setShowEmojiPicker(true)}
              disabled={isBlockedState}
              style={[styles.composerIconBtn, { backgroundColor: `${colors.primary}10`, opacity: isBlockedState ? 0.4 : 1 }]}
            >
              <Ionicons name="happy-outline" size={20} color={colors.textSecondary} />
            </Pressable>

            {isRecording ? (
              <View style={[styles.recordingRow, { backgroundColor: `${colors.wrong}14`, borderColor: `${colors.wrong}30` }]}>
                <View style={[styles.recordingDot, { backgroundColor: colors.wrong }]} />
                <Text style={[styles.recordingTime, { color: colors.wrong }]}>
                  {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </Text>
                <Pressable onPress={stopRecording} style={[styles.composerIconBtn, { backgroundColor: `${colors.wrong}20` }]}>
                  <Ionicons name="stop" size={18} color={colors.wrong} />
                </Pressable>
              </View>
            ) : (
              <TextInput
                value={input}
                onChangeText={onInputChange}
                onFocus={() => setShowEmojiPicker(false)}
                placeholder={isBlockedState ? 'Blocked' : 'Type a message...'}
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceVariant,
                  },
                ]}
                editable={!sending && !isBlockedState}
                onSubmitEditing={onSend}
                returnKeyType="send"
                multiline
              />
            )}

            {!isRecording && !input.trim() && !isBlockedState && (
              <>
                <Pressable
                  onPress={() => pickImage(false)}
                  style={[styles.composerIconBtn, { backgroundColor: `${colors.secondary}10` }]}
                >
                  <Ionicons name="image-outline" size={20} color={colors.secondary} />
                </Pressable>
                <Pressable
                  onPress={startRecording}
                  style={[styles.composerIconBtn, { backgroundColor: `${colors.wrong}10` }]}
                >
                  <Ionicons name="mic-outline" size={20} color={colors.wrong} />
                </Pressable>
              </>
            )}

            {!isRecording && (
              <Pressable
                onPress={onSend}
                disabled={sending || !input.trim() || isBlockedState}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: sending || !input.trim() || isBlockedState ? colors.border : colors.primary,
                  },
                ]}
              >
                <Ionicons name="send" size={16} color="#fff" />
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={(emoji) => setInput((prev) => prev + emoji)}
        onClose={() => setShowEmojiPicker(false)}
      />

      <ReactionPicker
        visible={reactionPickerMessageId !== null}
        onSelect={(emoji) => {
          if (reactionPickerMessageId) {
            void handleReactionSelect(reactionPickerMessageId, emoji);
          }
        }}
        onClose={() => setReactionPickerMessageId(null)}
      />

      {/* Disappearing Messages Modal */}
      <Modal
        visible={showDisappearingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDisappearingModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowDisappearingModal(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>Disappearing Messages</Text>
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
            Messages will be deleted after the selected time.
          </Text>
          {([
            { label: 'Off', value: null },
            { label: '5 minutes', value: 300 },
            { label: '1 hour', value: 3600 },
            { label: '24 hours', value: 86400 },
            { label: '7 days', value: 604800 },
          ] as { label: string; value: number | null }[]).map((opt) => (
            <Pressable
              key={String(opt.value)}
              onPress={async () => {
                if (!conversationId) return;
                try {
                  await setDisappearingMessages(conversationId, opt.value);
                  setDisappearingTtl(opt.value);
                  // Broadcast to peer
                  callChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'dm-settings-update',
                    payload: { fromId: userId, disappearing_ttl: opt.value },
                  }).catch(() => null);
                } catch { /* ignore */ }
                setShowDisappearingModal(false);
              }}
              style={[
                styles.modalOption,
                {
                  backgroundColor: disappearingTtl === opt.value ? `${colors.primary}14` : colors.surfaceVariant,
                  borderColor: disappearingTtl === opt.value ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.modalOptionText, { color: disappearingTtl === opt.value ? colors.primary : colors.text }]}>
                {opt.label}
              </Text>
              {disappearingTtl === opt.value && (
                <Ionicons name="checkmark" size={16} color={colors.primary} />
              )}
            </Pressable>
          ))}
        </View>
      </Modal>

      {/* Report User Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowReportModal(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>Report {peerName}</Text>
          <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
            Select a reason for your report.
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {([
              { label: 'Spam', value: 'spam' },
              { label: 'Harassment', value: 'harassment' },
              { label: 'Inappropriate content', value: 'inappropriate_content' },
              { label: 'Hate speech', value: 'hate_speech' },
              { label: 'Impersonation', value: 'impersonation' },
              { label: 'Other', value: 'other' },
            ] as { label: string; value: ReportReason }[]).map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setReportReason(opt.value)}
                style={[
                  styles.modalOption,
                  {
                    backgroundColor: reportReason === opt.value ? `${colors.wrong}14` : colors.surfaceVariant,
                    borderColor: reportReason === opt.value ? colors.wrong : colors.border,
                  },
                ]}
              >
                <Text style={[styles.modalOptionText, { color: reportReason === opt.value ? colors.wrong : colors.text }]}>
                  {opt.label}
                </Text>
                {reportReason === opt.value && (
                  <Ionicons name="checkmark" size={16} color={colors.wrong} />
                )}
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={async () => {
              if (!peerId) return;
              try {
                await reportUser(peerId, reportReason, undefined, 'dm', conversationId);
                setShowReportModal(false);
                showAlert('Reported', 'Thank you for your report. We will review it shortly.');
              } catch (e: any) {
                showAlert('Error', e?.message ?? 'Could not submit report');
              }
            }}
            style={[styles.reportSubmitBtn, { backgroundColor: colors.wrong }]}
          >
            <Text style={styles.reportSubmitText}>Submit Report</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: { position: 'relative' },
  headerAvatarImage: { width: 34, height: 34, borderRadius: 17 },
  headerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { fontSize: 11, fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  callBarText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  log: { flex: 1 },
  logContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  emptyText: { textAlign: 'center', paddingVertical: spacing.lg, fontSize: 13 },
  typingRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  typingText: { fontSize: 12, fontStyle: 'italic' },
  composer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  composerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    maxHeight: '65%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  modalSubtitle: { fontSize: fontSize.sm, marginBottom: spacing.xs },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalOptionText: { fontSize: fontSize.base },
  reportSubmitBtn: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  reportSubmitText: { color: '#fff', fontSize: fontSize.base, fontWeight: fontWeight.bold },
  recordingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingTime: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderLeftWidth: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  replyBarContent: { flex: 1, gap: 2 },
  replyBarName: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  replyBarBody: { fontSize: fontSize.xs },
  replyBarClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
