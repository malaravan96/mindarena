import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import { getCurrentUserId, listMessages, markConversationRead, sendMessage } from '@/lib/dm';
import { notifyDmMessage } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { DmWebRTCCall } from '@/lib/webrtcCall';
import type { CallUiState, DmMessage } from '@/lib/types';

type CallMode = 'audio' | 'video';
type IncomingInvite = { fromId: string; fromName: string; mode: CallMode };

const OUTGOING_CALL_TIMEOUT_MS = 30_000;

export function ChatThreadScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [selfName, setSelfName] = useState('Player');
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState('Player');
  const [peerAvatarUrl, setPeerAvatarUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);
  const [outgoingMode, setOutgoingMode] = useState<CallMode | null>(null);
  const [activeCallMode, setActiveCallMode] = useState<CallMode>('audio');
  const [callState, setCallState] = useState<CallUiState>('off');
  const [callMuted, setCallMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [opponentMuted, setOpponentMuted] = useState(false);

  const callChannelRef = useRef<RealtimeChannel | null>(null);
  const callRef = useRef<DmWebRTCCall | null>(null);
  const callInviteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const sendCallSignal = useCallback((event: string, payload: Record<string, unknown>) => {
    callChannelRef.current?.send({
      type: 'broadcast',
      event,
      payload,
    });
  }, []);

  const endCall = useCallback(
    async (sendEndedSignal: boolean) => {
      clearOutgoingTimer();
      setIncomingInvite(null);
      setOutgoingMode(null);
      setCallState('off');
      setCallMuted(false);
      setOpponentMuted(false);
      setCameraEnabled(true);

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

      const client = new DmWebRTCCall({
        conversationId: conversationIdRef.current,
        userId: userIdRef.current,
        mediaMode: mode,
        iceServers: buildIceServers(),
        sendSignal: (event, payload) => {
          sendCallSignal(event, {
            ...payload,
            toId: peerIdRef.current,
          });
        },
        callbacks: {
          onStateChange: (state) => {
            setCallState(state);
            if (state === 'off') {
              setOutgoingMode(null);
            }
          },
          onError: (message) => {
            showAlert('Call failed', message);
          },
        },
      });

      await client.init();
      callRef.current = client;
      return client;
    },
    [buildIceServers, sendCallSignal],
  );

  const loadThread = useCallback(async () => {
    if (!conversationId) return;

    setLoading(true);
    try {
      const uid = await getCurrentUserId();
      setUserId(uid);

      const [rows] = await Promise.all([
        listMessages(conversationId),
        markConversationRead(conversationId),
      ]);
      setMessages(rows);

      if (!uid) return;

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

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('id', nextPeerId)
        .maybeSingle<{ display_name: string | null; username: string | null; avatar_url: string | null }>();
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
          setMessages((prev) => {
            const next = [...prev, row as DmMessage];
            next.sort((a, b) => a.created_at.localeCompare(b.created_at));
            return next;
          });
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

    channel
      .on('broadcast', { event: 'dm-call-invite' }, ({ payload }) => {
        if (payload?.toId && payload.toId !== userIdRef.current) return;
        if (payload?.fromId === userIdRef.current) return;
        setIncomingInvite({
          fromId: payload?.fromId,
          fromName: payload?.fromName || 'Player',
          mode: payload?.mode === 'video' ? 'video' : 'audio',
        });
      })
      .on('broadcast', { event: 'dm-call-accept' }, ({ payload }) => {
        if (payload?.toId !== userIdRef.current) return;
        const mode: CallMode = payload?.mode === 'video' ? 'video' : 'audio';
        clearOutgoingTimer();
        setOutgoingMode(null);
        setActiveCallMode(mode);
        setCameraEnabled(mode === 'video');
        void (async () => {
          const client = await ensureCallClient(mode);
          if (!client) return;
          await client.startAsCaller();
        })();
      })
      .on('broadcast', { event: 'dm-call-decline' }, ({ payload }) => {
        if (payload?.toId !== userIdRef.current) return;
        clearOutgoingTimer();
        setOutgoingMode(null);
        showAlert('Call declined', `${payload?.fromName || 'Peer'} declined your call.`);
      })
      .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
        if (payload?.toId && payload.toId !== userIdRef.current) return;
        if (payload?.conversationId !== conversationIdRef.current) return;
        if (!payload?.offer) return;

        const mode: CallMode = payload?.mediaMode === 'video' ? 'video' : 'audio';
        setActiveCallMode(mode);
        setCameraEnabled(mode === 'video');
        setIncomingInvite(null);
        void (async () => {
          const client = await ensureCallClient(mode);
          if (!client) return;
          await client.handleOffer(payload.offer);
        })();
      })
      .on('broadcast', { event: 'call-answer' }, ({ payload }) => {
        if (payload?.toId && payload.toId !== userIdRef.current) return;
        if (payload?.conversationId !== conversationIdRef.current) return;
        if (!payload?.answer || !callRef.current) return;
        void callRef.current.handleAnswer(payload.answer);
      })
      .on('broadcast', { event: 'call-ice' }, ({ payload }) => {
        if (payload?.toId && payload.toId !== userIdRef.current) return;
        if (payload?.conversationId !== conversationIdRef.current) return;
        if (!payload?.candidate || !callRef.current) return;
        void callRef.current.handleIceCandidate(payload.candidate);
      })
      .on('broadcast', { event: 'call-ended' }, ({ payload }) => {
        if (payload?.toId && payload.toId !== userIdRef.current) return;
        if (payload?.conversationId !== conversationIdRef.current) return;
        void endCall(false);
      })
      .on('broadcast', { event: 'call-mute' }, ({ payload }) => {
        if (payload?.toId && payload.toId !== userIdRef.current) return;
        if (payload?.conversationId !== conversationIdRef.current) return;
        setOpponentMuted(!!payload?.muted);
      })
      .subscribe();

    callChannelRef.current = channel;

    return () => {
      if (callChannelRef.current) {
        supabase.removeChannel(callChannelRef.current);
        callChannelRef.current = null;
      }
    };
  }, [conversationId, userId, clearOutgoingTimer, ensureCallClient, endCall]);

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

    setSending(true);
    try {
      const row = await sendMessage(conversationId, body);
      setInput('');
      await notifyDmMessage(row.id);
    } catch (e: any) {
      showAlert('Send failed', e?.message ?? 'Could not send message');
    } finally {
      setSending(false);
    }
  }

  function startCall(mode: CallMode) {
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
    sendCallSignal('dm-call-invite', {
      conversationId,
      fromId: userId,
      toId: peerId,
      fromName: selfName,
      mode,
    });

    clearOutgoingTimer();
    callInviteTimeoutRef.current = setTimeout(() => {
      setOutgoingMode(null);
      showAlert('No answer', `${peerName} did not answer.`);
    }, OUTGOING_CALL_TIMEOUT_MS);
  }

  function acceptIncomingCall() {
    if (!conversationId || !userId || !incomingInvite) return;
    setActiveCallMode(incomingInvite.mode);
    setCameraEnabled(incomingInvite.mode === 'video');
    sendCallSignal('dm-call-accept', {
      conversationId,
      fromId: userId,
      toId: incomingInvite.fromId,
      mode: incomingInvite.mode,
    });
    setIncomingInvite(null);
  }

  function declineIncomingCall() {
    if (!conversationId || !userId || !incomingInvite) return;
    sendCallSignal('dm-call-decline', {
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
    sendCallSignal('call-mute', {
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
            onPress={() => startCall('audio')}
            disabled={callStartDisabled}
            style={[
              styles.headerActionBtn,
              {
                opacity: callStartDisabled ? 0.45 : 1,
                backgroundColor: `${colors.primary}14`,
              },
            ]}
          >
            <Ionicons name="call-outline" size={16} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => startCall('video')}
            disabled={callStartDisabled}
            style={[
              styles.headerActionBtn,
              {
                opacity: callStartDisabled ? 0.45 : 1,
                backgroundColor: `${colors.secondary}14`,
              },
            ]}
          >
            <Ionicons name="videocam-outline" size={16} color={colors.secondary} />
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

          {!!incomingInvite && (
            <View style={styles.callInviteRow}>
              <Text style={[styles.callInviteText, { color: colors.text }]}>
                {incomingInvite.fromName} is calling ({incomingInvite.mode})
              </Text>
              <View style={styles.callInviteActions}>
                <Pressable
                  onPress={acceptIncomingCall}
                  style={[styles.callActionBtn, { backgroundColor: colors.correct }]}
                >
                  <Text style={styles.callActionText}>Accept</Text>
                </Pressable>
                <Pressable
                  onPress={declineIncomingCall}
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
                style={[
                  styles.callControlBtn,
                  {
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
                  style={[
                    styles.callControlBtn,
                    {
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
                onPress={() => void endCall(true)}
                style={[
                  styles.callControlBtn,
                  {
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
        <View style={styles.body}>
          <ScrollView contentContainerStyle={styles.logContent} style={styles.log}>
            {sortedMessages.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No messages yet. Say hi.</Text>
            ) : (
              sortedMessages.map((msg) => {
                const mine = msg.sender_id === userId;
                return (
                  <View
                    key={msg.id}
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
                      <Text style={[styles.msgBody, { color: colors.text }]}>{msg.body}</Text>
                    </View>
                    <Text style={[styles.msgTime, { color: colors.textTertiary }]}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={[styles.composer, { borderTopColor: colors.border }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceVariant,
                },
              ]}
              editable={!sending}
              onSubmitEditing={onSend}
              returnKeyType="send"
            />
            <Pressable
              onPress={onSend}
              disabled={sending || !input.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: sending || !input.trim() ? colors.border : colors.primary,
                },
              ]}
            >
              <Ionicons name="send" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
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
  callControlRow: { flexDirection: 'row', gap: spacing.sm },
  callControlBtn: {
    flex: 1,
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
