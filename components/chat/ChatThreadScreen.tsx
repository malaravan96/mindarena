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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import { getCurrentUserId, listMessages, markConversationRead, sendMessage } from '@/lib/dm';
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
import type { CallUiState, DmMessage } from '@/lib/types';
import { RtcVideoView } from '@/components/chat/RtcVideoView';

type CallMode = 'audio' | 'video';
type IncomingInvite = { fromId: string; fromName: string; mode: CallMode };

const OUTGOING_CALL_TIMEOUT_MS = 30_000;
const VIDEO_STAGE_HEIGHT = 220;
const DM_SIGNAL_E2EE_ENABLED = false;

function getStreamUrl(stream: any | null) {
  if (!stream || typeof stream.toURL !== 'function') return null;
  return stream.toURL();
}

export function ChatThreadScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selfName, setSelfName] = useState('Player');
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState('Player');
  const [peerAvatarUrl, setPeerAvatarUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isBlockedState, setIsBlockedState] = useState(false);

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

  const callChannelRef = useRef<RealtimeChannel | null>(null);
  const callRef = useRef<DmWebRTCCall | null>(null);
  const callInitPromiseRef = useRef<Promise<DmWebRTCCall | null> | null>(null);
  const callInviteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageListRef = useRef<FlatList<DmMessage> | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const userIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

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
        payload: {
          ...payload,
          conversationId: convId,
          fromId,
          toId,
        },
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
        payload: {
          ...payload,
          conversationId: convId,
          fromId,
          toId,
          enc: envelope,
          v: 1,
        },
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
        // Compatibility path: if sender included plaintext fields, keep processing.
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
            void sendCallSignal(event, {
              ...payload,
              toId: peerIdRef.current,
            });
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
                if (callRef.current === client) {
                  callRef.current = null;
                }
                void stopCallAudio();
              }
            },
            onLocalStream: (stream) => {
              setLocalStreamUrl(getStreamUrl(stream));
            },
            onRemoteStream: (stream) => {
              setRemoteStreamUrl(getStreamUrl(stream));
            },
            onError: (message) => {
              showAlert('Call failed', message);
            },
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
        if (callInitPromiseRef.current === initPromise) {
          callInitPromiseRef.current = null;
        }
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

      // Check block status
      const blocked = await checkIsBlocked(uid, nextPeerId);
      setIsBlockedState(blocked);

      const [rows, , { data: profile }] = await Promise.all([
        listMessages(conversationId, { userId: uid, peerId: nextPeerId }),
        markConversationRead(conversationId),
        supabase
          .from('profiles')
          .select('display_name, username, avatar_url')
          .eq('id', nextPeerId)
          .maybeSingle<{ display_name: string | null; username: string | null; avatar_url: string | null }>(),
      ]);
      setMessages(rows);

      setPeerName(profile?.display_name || profile?.username || 'Player');
      setPeerAvatarUrl(profile?.avatar_url ?? null);
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
          })();
          markConversationRead(conversationId).catch(() => null);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

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
    };
  }, [clearOutgoingTimer, endCall]);

  async function onSend() {
    if (!conversationId || sending) return;
    const body = input.trim();
    if (!body) return;
    shouldAutoScrollRef.current = true;

    setSending(true);
    try {
      const row = await sendMessage(conversationId, body);
      setMessages((prev) => {
        if (prev.some((msg) => msg.id === row.id)) return prev;
        const next = [...prev, row];
        next.sort((a, b) => a.created_at.localeCompare(b.created_at));
        return next;
      });
      setInput('');
      void notifyDmMessage(row.id).catch((error) => {
        console.warn('DM push notify failed', error);
      });
    } catch (e: any) {
      showAlert('Send failed', e?.message ?? 'Could not send message');
    } finally {
      setSending(false);
    }
  }

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
      const mine = item.sender_id === userId;
      return (
        <View
          style={[
            styles.msgRow,
            {
              alignItems: mine ? 'flex-end' : 'flex-start',
            },
          ]}
        >
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: mine ? `${colors.primary}16` : colors.surfaceVariant,
                borderColor: mine ? `${colors.primary}35` : colors.border,
              },
            ]}
          >
            <Text style={[styles.msgBody, { color: colors.text }]}>{item.body}</Text>
          </View>
          <Text style={[styles.msgTime, { color: colors.textTertiary }]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      );
    },
    [colors, userId],
  );

  const callStateLabel =
    callState === 'live'
      ? activeCallMode === 'video'
        ? 'Video call live'
        : 'Voice call live'
      : callState === 'connecting'
        ? 'Connecting...'
        : callState === 'reconnecting'
          ? 'Reconnecting...'
          : outgoingMode
            ? `Calling (${outgoingMode})...`
            : 'Call off';
  const callStateColor =
    callState === 'live'
      ? colors.correct
      : callState === 'reconnecting'
        ? colors.warning
        : outgoingMode
          ? colors.primary
          : colors.textSecondary;
  const showCallPanel = !!incomingInvite || !!outgoingMode || callState !== 'off';
  const callStartDisabled = !peerId || !!outgoingMode || callState !== 'off';
  const canControlCall = callState !== 'off';
  const showVideoStage = activeCallMode === 'video' && (callState === 'connecting' || callState === 'live' || callState === 'reconnecting');

  if (!conversationId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <Text style={{ color: colors.textSecondary }}>Conversation not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        {peerAvatarUrl ? (
          <Image source={{ uri: peerAvatarUrl }} style={styles.headerAvatarImage} />
        ) : (
          <View style={[styles.headerAvatarFallback, { backgroundColor: `${colors.primary}16` }]}>
            <Text style={[styles.headerAvatarText, { color: colors.primary }]}>
              {peerName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {peerName}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Direct message</Text>
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
        </View>
      </View>

      {showCallPanel && (
        <View
          style={[
            styles.callPanel,
            {
              borderBottomColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <View style={[styles.callPill, { backgroundColor: `${callStateColor}16` }]}>
            <View style={[styles.callDot, { backgroundColor: callStateColor }]} />
            <Text style={[styles.callPillText, { color: callStateColor }]}>{callStateLabel}</Text>
          </View>

          {showVideoStage && (
            <View style={[styles.videoStage, { borderColor: colors.border }]}>
              <RtcVideoView
                streamURL={remoteStreamUrl}
                style={styles.remoteVideo}
                emptyLabel={callState === 'connecting' ? 'Connecting video...' : 'Waiting for peer video...'}
              />
              {!remoteStreamUrl && (
                <View style={styles.videoRemoteFallback}>
                  {peerAvatarUrl ? (
                    <Image source={{ uri: peerAvatarUrl }} style={styles.videoRemoteAvatar} />
                  ) : (
                    <View style={[styles.videoRemoteAvatarFallback, { backgroundColor: `${colors.primary}1f` }]}>
                      <Text style={[styles.videoRemoteAvatarText, { color: colors.primary }]}>
                        {peerName.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.videoRemoteLabel, { color: colors.textSecondary }]}>{peerName}</Text>
                </View>
              )}
              <View style={[styles.videoPipWrap, { borderColor: colors.border }]}>
                <RtcVideoView
                  streamURL={localStreamUrl}
                  style={styles.videoPip}
                  mirror
                  emptyLabel={cameraEnabled ? 'Loading camera...' : 'Camera off'}
                />
              </View>
            </View>
          )}

          {!!incomingInvite && (
            <View style={styles.callInviteRow}>
              <Text style={[styles.callInviteText, { color: colors.text }]}>
                {incomingInvite.fromName} is calling ({incomingInvite.mode})
              </Text>
              <View style={styles.callInviteActions}>
                <Pressable
                  onPress={() => void acceptIncomingCall()}
                  style={[styles.callActionBtn, { backgroundColor: colors.correct }]}
                >
                  <Text style={styles.callActionText}>Accept</Text>
                </Pressable>
                <Pressable
                  onPress={() => void declineIncomingCall()}
                  style={[styles.callActionBtn, { backgroundColor: colors.wrong }]}
                >
                  <Text style={styles.callActionText}>Decline</Text>
                </Pressable>
              </View>
            </View>
          )}

          {callState !== 'off' && (
            <View style={styles.callControlRow}>
              <Pressable
                onPress={toggleMute}
                disabled={!canControlCall}
                style={[
                  styles.callControlBtn,
                  {
                    opacity: canControlCall ? 1 : 0.45,
                    borderColor: callMuted ? `${colors.warning}35` : `${colors.primary}35`,
                    backgroundColor: callMuted ? `${colors.warning}14` : `${colors.primary}14`,
                  },
                ]}
              >
                <Ionicons name={callMuted ? 'mic-off-outline' : 'mic-outline'} size={16} color={callMuted ? colors.warning : colors.primary} />
                <Text style={[styles.callControlText, { color: callMuted ? colors.warning : colors.primary }]}>
                  {callMuted ? 'Unmute' : 'Mute'}
                </Text>
              </Pressable>

              {activeCallMode === 'video' && (
                <Pressable
                  onPress={toggleCamera}
                  disabled={!canControlCall || activeCallMode !== 'video'}
                  style={[
                    styles.callControlBtn,
                    {
                      opacity: canControlCall ? 1 : 0.45,
                      borderColor: cameraEnabled ? `${colors.secondary}35` : `${colors.warning}35`,
                      backgroundColor: cameraEnabled ? `${colors.secondary}14` : `${colors.warning}14`,
                    },
                  ]}
                >
                  <Ionicons
                    name={cameraEnabled ? 'videocam-outline' : 'videocam-off-outline'}
                    size={16}
                    color={cameraEnabled ? colors.secondary : colors.warning}
                  />
                  <Text style={[styles.callControlText, { color: cameraEnabled ? colors.secondary : colors.warning }]}>
                    {cameraEnabled ? 'Camera On' : 'Camera Off'}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => void toggleSpeakerMode()}
                disabled={!canControlCall}
                style={[
                  styles.callControlBtn,
                  {
                    opacity: canControlCall ? 1 : 0.45,
                    borderColor: speakerOn ? `${colors.primary}35` : `${colors.border}`,
                    backgroundColor: speakerOn ? `${colors.primary}14` : colors.surfaceVariant,
                  },
                ]}
              >
                <Ionicons
                  name={speakerOn ? 'volume-high-outline' : 'volume-mute-outline'}
                  size={16}
                  color={speakerOn ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.callControlText, { color: speakerOn ? colors.primary : colors.textSecondary }]}>
                  {speakerOn ? 'Speaker On' : 'Speaker Off'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void endCall(true)}
                disabled={!canControlCall}
                style={[
                  styles.callControlBtn,
                  {
                    opacity: canControlCall ? 1 : 0.45,
                    borderColor: `${colors.wrong}35`,
                    backgroundColor: `${colors.wrong}14`,
                  },
                ]}
              >
                <Ionicons name="call-outline" size={16} color={colors.wrong} />
                <Text style={[styles.callControlText, { color: colors.wrong }]}>End</Text>
              </Pressable>
            </View>
          )}

          {callState !== 'off' && opponentMuted && (
            <Text style={[styles.callMetaText, { color: colors.textSecondary }]}>Peer muted microphone</Text>
          )}

          {Platform.OS === 'web' && (
            <Text style={[styles.callMetaText, { color: colors.textSecondary }]}>
              Calling is available on Android/iOS builds.
            </Text>
          )}
        </View>
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
              {
                paddingBottom: composerHeight + insets.bottom + spacing.sm,
              },
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
          />

          <View
            style={[
              styles.composer,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, spacing.sm),
              },
            ]}
            onLayout={(event) => {
              setComposerHeight(event.nativeEvent.layout.height);
            }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
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
            />
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
          </View>
        </KeyboardAvoidingView>
      )}
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
  headerAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  headerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callPanel: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  callPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  callDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  callPillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  videoStage: {
    height: VIDEO_STAGE_HEIGHT,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
  },
  videoRemoteFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  videoRemoteAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  videoRemoteAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoRemoteAvatarText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  videoRemoteLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  videoPipWrap: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 96,
    height: 132,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoPip: {
    width: '100%',
    height: '100%',
  },
  callInviteRow: { gap: spacing.sm },
  callInviteText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  callInviteActions: { flexDirection: 'row', gap: spacing.sm },
  callActionBtn: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  callActionText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  callControlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  callControlBtn: {
    minWidth: '46%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  callControlText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  callMetaText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  log: { flex: 1 },
  logContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  emptyText: { textAlign: 'center', paddingVertical: spacing.lg, fontSize: fontSize.sm },
  msgRow: { gap: 4 },
  bubble: {
    maxWidth: '84%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  msgBody: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  msgTime: { fontSize: fontSize.xs },
  composer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
