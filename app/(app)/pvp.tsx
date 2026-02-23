import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  AppState,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { offlinePuzzles, Puzzle } from '@/lib/puzzles';
import { getItem, setItem } from '@/lib/storage';
import { notifyIncomingMatchCall } from '@/lib/push';
import { setSpeaker, startCallAudio, stopCallAudio } from '@/lib/audioRoute';
import { PvpWebRTCCall } from '@/lib/webrtcCall';
import type { CallUiState } from '@/lib/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ── Types ───────────────────────────────────────────────────────────

type Phase =
  | 'lobby'
  | 'invite-sent'
  | 'found'
  | 'countdown'
  | 'playing'
  | 'waiting'
  | 'result';

type PvpStats = { wins: number; losses: number; draws: number };
type MatchResult = 'win' | 'loss' | 'draw';

type PlayerInfo = {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
  total_points: number;
  online: boolean;
};

type PendingInvite = {
  matchId: string;
  puzzleIndex: number;
  fromId: string;
  fromName: string;
};

type ChatMessageType = 'text' | 'emoji' | 'voice';

type PvpChatMessage = {
  id: string;
  match_id: string;
  sender_id: string;
  sender_name: string;
  message_type: ChatMessageType;
  text_content: string | null;
  emoji: string | null;
  voice_url: string | null;
  voice_duration_ms: number | null;
  created_at: string;
};

const STATS_KEY = 'pvp-stats';
const COUNTDOWN_SECS = 3;
const FOUND_DELAY_MS = 1500;
const INVITE_TIMEOUT_MS = 30_000;
const CHAT_TEXT_LIMIT = 160;
const QUICK_REACTIONS = ['🔥', '😂', '👏', '😮', '😈'];

// ── Component ───────────────────────────────────────────────────────

export default function PvpScreen() {
  const { colors } = useTheme();

  // Auth
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('Player');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // State machine
  const [phase, setPhase] = useState<Phase>('lobby');
  const [stats, setStats] = useState<PvpStats>({ wins: 0, losses: 0, draws: 0 });

  // Player list
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // Invite state
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);
  const [invitedPlayer, setInvitedPlayer] = useState<PlayerInfo | null>(null);

  // Match state
  const [matchId, setMatchId] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [opponentAvatarUrl, setOpponentAvatarUrl] = useState<string | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [countdownNum, setCountdownNum] = useState(COUNTDOWN_SECS);

  // Playing state
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);

  // Result state
  const [myReveal, setMyReveal] = useState<{ selectedIndex: number; isCorrect: boolean; msTaken: number } | null>(null);
  const [oppReveal, setOppReveal] = useState<{ selectedIndex: number; isCorrect: boolean; msTaken: number } | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  // Chat + voice state
  const [chatMessages, setChatMessages] = useState<PvpChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [chatBusy, setChatBusy] = useState(false);
  const [reactionToast, setReactionToast] = useState<{ emoji: string; fromName: string } | null>(null);

  // Live call state
  const [callState, setCallState] = useState<CallUiState>('off');
  const [callMuted, setCallMuted] = useState(false);
  const [callSpeakerOn, setCallSpeakerOn] = useState(true);
  const [opponentMuted, setOpponentMuted] = useState(false);

  // Refs for channels and timers
  const lobbyChannelRef = useRef<RealtimeChannel | null>(null);
  const inviteChannelRef = useRef<RealtimeChannel | null>(null);
  const matchChannelRef = useRef<RealtimeChannel | null>(null);
  const chatChannelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inviteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callRef = useRef<PvpWebRTCCall | null>(null);
  const callInitPromiseRef = useRef<Promise<PvpWebRTCCall | null> | null>(null);
  const callSessionIdRef = useRef<string | null>(null);
  const phaseRef = useRef<Phase>('lobby');
  const mySubmittedRef = useRef(false);
  const oppSubmittedRef = useRef(false);
  const myRevealRef = useRef<typeof myReveal>(null);
  const oppRevealRef = useRef<typeof oppReveal>(null);
  const isHostRef = useRef(false);
  const matchIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const opponentIdRef = useRef<string | null>(null);
  const statsRef = useRef<PvpStats>({ wins: 0, losses: 0, draws: 0 });
  const chatOpenRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { matchIdRef.current = matchId; }, [matchId]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { opponentIdRef.current = opponentId; }, [opponentId]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { chatOpenRef.current = chatOpen; }, [chatOpen]);
  useEffect(() => {
    if (!opponentId) return;
    const avatar = players.find((p) => p.id === opponentId)?.avatar_url ?? null;
    if (avatar) setOpponentAvatarUrl(avatar);
  }, [players, opponentId]);

  // ── Init: load user, stats, players, presence ───────────────────

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (uid && mounted) {
        setUserId(uid);
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', uid)
          .maybeSingle<{ username: string; avatar_url: string | null }>();
        if (profile?.username && mounted) setUsername(profile.username);
        if (mounted) setAvatarUrl(profile?.avatar_url ?? null);

        // Join presence + invite channels once we have uid
        joinLobbyPresence(uid, profile?.username ?? 'Player');
        joinInviteChannel(uid);
      }
    })();
    loadStats();
    fetchPlayers();
    return () => { mounted = false; };
  }, []);

  // ── Cleanup on unmount / app background ─────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && phaseRef.current !== 'lobby' && phaseRef.current !== 'result') {
        cleanupMatch();
        setPhase('lobby');
      }
    });
    return () => {
      sub.remove();
      cleanupAll();
    };
  }, []);

  useEffect(() => {
    if (!matchId || !userId) {
      closeChatSubscription();
      return;
    }

    let cancelled = false;
    (async () => {
      await beginMatchMessaging(matchId);
      if (cancelled) closeChatSubscription();
    })();

    return () => {
      cancelled = true;
      closeChatSubscription();
    };
  }, [matchId, userId]);

  useEffect(() => {
    if (chatOpen) setChatUnread(0);
  }, [chatOpen]);

  useFocusEffect(
    React.useCallback(() => {
      void refreshCurrentProfile();
      void fetchPlayers();
      if (opponentId) void loadOpponentAvatar(opponentId);
      return undefined;
    }, [opponentId]),
  );

  // ── Data Loading ────────────────────────────────────────────────

  async function loadStats() {
    const raw = await getItem(STATS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setStats(parsed);
        statsRef.current = parsed;
      } catch { /* ignore */ }
    }
  }

  async function persistStats(next: PvpStats) {
    setStats(next);
    statsRef.current = next;
    await setItem(STATS_KEY, JSON.stringify(next));
  }

  async function fetchPlayers() {
    setLoadingPlayers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, total_points')
        .order('total_points', { ascending: false });
      if (!error && data) {
        setPlayers(
          data.map((p: any) => ({
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url ?? null,
            total_points: p.total_points ?? 0,
            online: false, // updated by presence
          })),
        );
      }
    } catch { /* ignore */ }
    setLoadingPlayers(false);
  }

  async function refreshCurrentProfile() {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;

    setUserId(uid);
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', uid)
      .maybeSingle<{ username: string; avatar_url: string | null }>();

    if (profile?.username) setUsername(profile.username);
    setAvatarUrl(profile?.avatar_url ?? null);
  }

  async function loadOpponentAvatar(targetUserId: string) {
    const cached = players.find((p) => p.id === targetUserId)?.avatar_url;
    if (cached) {
      setOpponentAvatarUrl(cached);
      return;
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', targetUserId)
        .maybeSingle<{ avatar_url: string | null }>();
      setOpponentAvatarUrl(data?.avatar_url ?? null);
    } catch {
      setOpponentAvatarUrl(null);
    }
  }

  function isMatchLifecyclePhase(value: Phase) {
    return value === 'found' || value === 'countdown' || value === 'playing' || value === 'waiting';
  }

  function buildIceServers() {
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
  }

  function sendCallSignal(
    event: 'call-offer' | 'call-answer' | 'call-ice' | 'call-state' | 'call-ended' | 'call-mute',
    payload: Record<string, unknown>,
  ) {
    matchChannelRef.current?.send({
      type: 'broadcast',
      event,
      payload,
    });
  }

  function isValidOpponentPayload(payload: any) {
    if (!payload || payload.matchId !== matchIdRef.current) return false;
    if (!isMatchLifecyclePhase(phaseRef.current)) return false;
    if (payload.playerId === userIdRef.current) return false;
    if (opponentIdRef.current && payload.playerId !== opponentIdRef.current) return false;
    return true;
  }

  async function updateCallSession(status: 'ringing' | 'connected' | 'ended' | 'failed') {
    if (!callSessionIdRef.current) return;
    await supabase
      .from('pvp_call_sessions')
      .update({
        status,
        ended_at: status === 'ended' || status === 'failed' ? new Date().toISOString() : null,
      })
      .eq('id', callSessionIdRef.current);
  }

  async function ensureLiveCallClient() {
    if (Platform.OS === 'web') return null;
    if (callRef.current) return callRef.current;
    if (!matchIdRef.current || !userIdRef.current) return null;
    if (callInitPromiseRef.current) return callInitPromiseRef.current;

    const initPromise: Promise<PvpWebRTCCall | null> = (async () => {
      const client = new PvpWebRTCCall({
        matchId: matchIdRef.current!,
        userId: userIdRef.current!,
        iceServers: buildIceServers(),
        sendSignal: (event, payload) => {
          sendCallSignal(event, payload);
        },
        callbacks: {
          onStateChange: (state) => {
            setCallState(state);
            sendCallSignal('call-state', {
              matchId: matchIdRef.current,
              playerId: userIdRef.current,
              state,
            });
            if (state === 'live') {
              updateCallSession('connected').catch(() => null);
            }
            if (state === 'off') {
              setCallMuted(false);
              setCallSpeakerOn(true);
              void stopCallAudio();
            }
          },
          onError: () => {
            setCallState('reconnecting');
          },
        },
      });

      try {
        await startCallAudio('audio');
        await setSpeaker(callSpeakerOn);
        await client.init();
        callRef.current = client;
        return client;
      } catch {
        setCallState('off');
        await stopCallAudio().catch(() => null);
        return null;
      }
    })();

    callInitPromiseRef.current = initPromise;
    try {
      return await initPromise;
    } finally {
      if (callInitPromiseRef.current === initPromise) {
        callInitPromiseRef.current = null;
      }
    }
  }

  async function createCallSessionIfHost() {
    if (!isHostRef.current) return;
    if (!matchIdRef.current || !userIdRef.current || !opponentIdRef.current) return;
    if (callSessionIdRef.current) return;

    const { data } = await supabase
      .from('pvp_call_sessions')
      .insert({
        match_id: matchIdRef.current,
        caller_id: userIdRef.current,
        callee_id: opponentIdRef.current,
        status: 'ringing',
      })
      .select('id')
      .maybeSingle<{ id: string }>();

    if (data?.id) callSessionIdRef.current = data.id;
    await notifyIncomingMatchCall(matchIdRef.current, opponentIdRef.current, username).catch(() => null);
  }

  async function startLiveMatchCall() {
    if (Platform.OS === 'web') return;
    if (callRef.current || callInitPromiseRef.current) return;
    if (!isHostRef.current) return;

    const client = await ensureLiveCallClient();
    if (!client) return;

    await createCallSessionIfHost();
    await client.startAsCaller();
  }

  async function handleCallOffer(payload: any) {
    if (!isValidOpponentPayload(payload)) return;
    const client = await ensureLiveCallClient();
    if (!client || !payload.offer) return;
    await client.handleOffer(payload.offer);
  }

  async function handleCallAnswer(payload: any) {
    if (!isValidOpponentPayload(payload)) return;
    if (!callRef.current || !payload.answer) return;
    await callRef.current.handleAnswer(payload.answer);
  }

  async function handleCallIce(payload: any) {
    if (!isValidOpponentPayload(payload)) return;
    if (!callRef.current || !payload.candidate) return;
    await callRef.current.handleIceCandidate(payload.candidate);
  }

  async function endLiveMatchCall(sendSignal: boolean, failed = false) {
    const active = callRef.current;
    callRef.current = null;
    callInitPromiseRef.current = null;
    setCallMuted(false);
    setCallSpeakerOn(true);
    setOpponentMuted(false);
    setCallState('off');

    if (active) {
      await active.close(sendSignal, failed ? 'failed' : 'off');
    }

    if (callSessionIdRef.current) {
      await updateCallSession(failed ? 'failed' : 'ended');
      callSessionIdRef.current = null;
    }

    await stopCallAudio();
  }

  async function toggleCallMute() {
    if (!callRef.current) return;
    const muted = callRef.current.toggleMute();
    setCallMuted(muted);
    sendCallSignal('call-mute', {
      matchId: matchIdRef.current,
      playerId: userIdRef.current,
      muted,
    });
  }

  function toggleCallSpeaker() {
    if (Platform.OS === 'web') return;
    setCallSpeakerOn((prev) => {
      const next = !prev;
      void setSpeaker(next);
      return next;
    });
  }

  function clearReactionToast() {
    if (reactionToastTimeoutRef.current) {
      clearTimeout(reactionToastTimeoutRef.current);
      reactionToastTimeoutRef.current = null;
    }
    setReactionToast(null);
  }

  function resetChatState() {
    setChatMessages([]);
    setChatInput('');
    setChatUnread(0);
    setChatBusy(false);
    setChatOpen(false);
    clearReactionToast();
  }

  function closeChatSubscription() {
    if (chatChannelRef.current) {
      supabase.removeChannel(chatChannelRef.current);
      chatChannelRef.current = null;
    }
  }

  async function loadChatHistory(mId: string) {
    const { data, error } = await supabase
      .from('pvp_messages')
      .select('id, match_id, sender_id, sender_name, message_type, text_content, emoji, voice_url, voice_duration_ms, created_at')
      .eq('match_id', mId)
      .order('created_at', { ascending: true })
      .limit(120);

    if (!error && data) {
      setChatMessages((prev) => {
        const byId = new Map(prev.map((item) => [item.id, item]));
        for (const item of data as PvpChatMessage[]) byId.set(item.id, item);
        return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    }
  }

  function handleIncomingMessage(row: PvpChatMessage) {
    setChatMessages((prev) => {
      if (prev.some((item) => item.id === row.id)) return prev;
      const next = [...prev, row];
      next.sort((a, b) => a.created_at.localeCompare(b.created_at));
      return next;
    });

    const fromOpponent = row.sender_id !== userIdRef.current;
    if (!fromOpponent) return;

    if (!chatOpenRef.current) {
      setChatUnread((prev) => prev + 1);
    }

    if (row.message_type === 'emoji' && row.emoji) {
      setReactionToast({ emoji: row.emoji, fromName: row.sender_name || 'Opponent' });
      if (reactionToastTimeoutRef.current) clearTimeout(reactionToastTimeoutRef.current);
      reactionToastTimeoutRef.current = setTimeout(() => setReactionToast(null), 1600);
    }
  }

  function subscribeChatMessages(mId: string) {
    closeChatSubscription();

    const channel = supabase
      .channel(`pvp-chat-${mId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pvp_messages',
          filter: `match_id=eq.${mId}`,
        },
        ({ new: newRow }) => {
          handleIncomingMessage(newRow as PvpChatMessage);
        },
      )
      .subscribe();

    chatChannelRef.current = channel;
  }

  async function beginMatchMessaging(mId: string) {
    setChatUnread(0);
    subscribeChatMessages(mId);
    await loadChatHistory(mId);
  }

  async function persistChatMessage(payload: {
    message_type: ChatMessageType;
    text_content?: string | null;
    emoji?: string | null;
    voice_url?: string | null;
    voice_duration_ms?: number | null;
  }) {
    if (!matchIdRef.current || !userIdRef.current) return;

    const row = {
      match_id: matchIdRef.current,
      sender_id: userIdRef.current,
      sender_name: username,
      message_type: payload.message_type,
      text_content: payload.text_content ?? null,
      emoji: payload.emoji ?? null,
      voice_url: payload.voice_url ?? null,
      voice_duration_ms: payload.voice_duration_ms ?? null,
    };

    const { error } = await supabase.from('pvp_messages').insert(row);
    if (error) throw error;
  }

  async function sendChatText() {
    const text = chatInput.trim();
    if (!text || chatBusy || !matchId || !userId) return;

    setChatBusy(true);
    try {
      await persistChatMessage({
        message_type: 'text',
        text_content: text.slice(0, CHAT_TEXT_LIMIT),
      });
      setChatInput('');
    } catch {
      // ignore when table/policies are not ready
    } finally {
      setChatBusy(false);
    }
  }

  async function sendEmojiReaction(emoji: string) {
    if (chatBusy || !matchId || !userId) return;
    setChatBusy(true);
    try {
      await persistChatMessage({
        message_type: 'emoji',
        emoji,
      });
    } catch {
      // ignore when table/policies are not ready
    } finally {
      setChatBusy(false);
    }
  }

  // ── Lobby Presence Channel ──────────────────────────────────────
  // Tracks who is currently on the Battle tab

  function joinLobbyPresence(uid: string, uname: string) {
    if (lobbyChannelRef.current) return;

    const channel = supabase.channel('pvp-lobby', {
      config: { presence: { key: uid } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set(Object.keys(state));
        setOnlineIds(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ username: uname, joinedAt: Date.now() });
        }
      });

    lobbyChannelRef.current = channel;
  }

  // ── Invite Channel ──────────────────────────────────────────────
  // Each player listens on their personal invite channel

  function joinInviteChannel(uid: string) {
    if (inviteChannelRef.current) return;

    const channel = supabase.channel(`pvp-invite-${uid}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'invite' }, ({ payload }) => {
        // Only show invite if in lobby
        if (phaseRef.current !== 'lobby') return;
        setPendingInvite({
          matchId: payload.matchId,
          puzzleIndex: payload.puzzleIndex,
          fromId: payload.fromId,
          fromName: payload.fromName,
        });
      })
      .on('broadcast', { event: 'invite-cancelled' }, ({ payload }) => {
        setPendingInvite((prev) => (prev?.matchId === payload.matchId ? null : prev));
      })
      .subscribe();

    inviteChannelRef.current = channel;
  }

  // ── Cleanup Helpers ─────────────────────────────────────────────

  function cleanupMatch() {
    // Broadcast disconnect if in a match
    if (matchChannelRef.current && matchIdRef.current) {
      matchChannelRef.current.send({
        type: 'broadcast',
        event: 'disconnected',
        payload: { playerId: userIdRef.current },
      });
    }
    if (matchChannelRef.current) {
      supabase.removeChannel(matchChannelRef.current);
      matchChannelRef.current = null;
    }
    closeChatSubscription();
    void endLiveMatchCall(false);
    clearReactionToast();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (inviteTimeoutRef.current) { clearTimeout(inviteTimeoutRef.current); inviteTimeoutRef.current = null; }
    mySubmittedRef.current = false;
    oppSubmittedRef.current = false;
    myRevealRef.current = null;
    oppRevealRef.current = null;
    isHostRef.current = false;
    callSessionIdRef.current = null;
  }

  function cleanupAll() {
    cleanupMatch();
    if (lobbyChannelRef.current) {
      supabase.removeChannel(lobbyChannelRef.current);
      lobbyChannelRef.current = null;
    }
    if (inviteChannelRef.current) {
      supabase.removeChannel(inviteChannelRef.current);
      inviteChannelRef.current = null;
    }
  }

  function resetToLobby() {
    cleanupMatch();
    resetChatState();
    setPhase('lobby');
    setMatchId(null);
    setOpponentName('Opponent');
    setOpponentId(null);
    setOpponentAvatarUrl(null);
    setPuzzle(null);
    setCountdownNum(COUNTDOWN_SECS);
    setSelected(null);
    setTimeLeft(60);
    setStartedAt(0);
    setOpponentSubmitted(false);
    setMyReveal(null);
    setOppReveal(null);
    setMatchResult(null);
    setInvitedPlayer(null);
    setPendingInvite(null);
    loadStats();
  }

  // ── Send Invite ─────────────────────────────────────────────────

  function sendInvite(player: PlayerInfo) {
    if (!userId) return;

    resetChatState();
    const puzzleIndex = Math.floor(Math.random() * offlinePuzzles.length);
    const newMatchId = Crypto.randomUUID();

    setInvitedPlayer(player);
    setOpponentName(player.username);
    setOpponentId(player.id);
    setOpponentAvatarUrl(player.avatar_url ?? null);
    void loadOpponentAvatar(player.id);
    setMatchId(newMatchId);
    setPuzzle(offlinePuzzles[puzzleIndex]);
    isHostRef.current = true;
    setPhase('invite-sent');

    // Send invite to the target player's invite channel
    const targetChannel = supabase.channel(`pvp-invite-${player.id}`, {
      config: { broadcast: { self: false } },
    });

    targetChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        targetChannel.send({
          type: 'broadcast',
          event: 'invite',
          payload: {
            matchId: newMatchId,
            puzzleIndex,
            fromId: userId,
            fromName: username,
          },
        });
        // Clean up the send-only channel
        supabase.removeChannel(targetChannel);
      }
    });

    // Listen on match channel for acceptance (guest sends "ready")
    joinMatchChannel(newMatchId, true);

    // Timeout after 30s
    inviteTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current === 'invite-sent') {
        // Cancel the invite
        const cancelChannel = supabase.channel(`pvp-invite-${player.id}`, {
          config: { broadcast: { self: false } },
        });
        cancelChannel.subscribe((s) => {
          if (s === 'SUBSCRIBED') {
            cancelChannel.send({
              type: 'broadcast',
              event: 'invite-cancelled',
              payload: { matchId: newMatchId },
            });
            supabase.removeChannel(cancelChannel);
          }
        });
        resetToLobby();
      }
    }, INVITE_TIMEOUT_MS);
  }

  function cancelInvite() {
    if (invitedPlayer && matchId) {
      const cancelChannel = supabase.channel(`pvp-invite-${invitedPlayer.id}`, {
        config: { broadcast: { self: false } },
      });
      cancelChannel.subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          cancelChannel.send({
            type: 'broadcast',
            event: 'invite-cancelled',
            payload: { matchId },
          });
          supabase.removeChannel(cancelChannel);
        }
      });
    }
    resetToLobby();
  }

  // ── Accept / Decline Invite ─────────────────────────────────────

  function acceptInvite() {
    if (!pendingInvite || !userId) return;

    resetChatState();
    const { matchId: mId, puzzleIndex, fromId, fromName } = pendingInvite;
    setMatchId(mId);
    setOpponentName(fromName);
    setOpponentId(fromId);
    setOpponentAvatarUrl(players.find((p) => p.id === fromId)?.avatar_url ?? null);
    void loadOpponentAvatar(fromId);
    setPuzzle(offlinePuzzles[puzzleIndex]);
    isHostRef.current = false;
    setPendingInvite(null);

    setPhase('found');
    setTimeout(() => joinMatchChannel(mId, false), FOUND_DELAY_MS);
  }

  function declineInvite() {
    setPendingInvite(null);
  }

  // ── Match Channel ───────────────────────────────────────────────

  function joinMatchChannel(mId: string, isHost: boolean) {
    // Clean up any existing match channel
    if (matchChannelRef.current) {
      supabase.removeChannel(matchChannelRef.current);
    }

    const channel = supabase.channel(`pvp-match-${mId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'ready' }, () => {
        // Clear invite timeout since opponent accepted
        if (inviteTimeoutRef.current) {
          clearTimeout(inviteTimeoutRef.current);
          inviteTimeoutRef.current = null;
        }

        if (isHost) {
          // Guest joined → show found phase, then countdown
          setPhase('found');
          setTimeout(() => {
            channel.send({
              type: 'broadcast',
              event: 'countdown-start',
              payload: { startTime: Date.now() + 300 },
            });
            beginCountdown();
          }, FOUND_DELAY_MS);
        }
      })
      .on('broadcast', { event: 'countdown-start' }, () => {
        if (!isHost) {
          beginCountdown();
        }
      })
      .on('broadcast', { event: 'submitted' }, ({ payload }) => {
        if (payload.playerId !== userIdRef.current) {
          oppSubmittedRef.current = true;
          setOpponentSubmitted(true);
          if (mySubmittedRef.current) {
            broadcastReveal();
          }
        }
      })
      .on('broadcast', { event: 'reveal' }, ({ payload }) => {
        if (payload.playerId !== userIdRef.current) {
          oppRevealRef.current = {
            selectedIndex: payload.selectedIndex,
            isCorrect: payload.isCorrect,
            msTaken: payload.msTaken,
          };
          setOppReveal(oppRevealRef.current);
          if (myRevealRef.current && oppRevealRef.current) {
            determineWinner(myRevealRef.current, oppRevealRef.current);
          }
        }
      })
      .on('broadcast', { event: 'disconnected' }, ({ payload }) => {
        if (payload.playerId !== userIdRef.current) {
          handleOpponentDisconnect();
        }
      })
      .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
        void handleCallOffer(payload);
      })
      .on('broadcast', { event: 'call-answer' }, ({ payload }) => {
        void handleCallAnswer(payload);
      })
      .on('broadcast', { event: 'call-ice' }, ({ payload }) => {
        void handleCallIce(payload);
      })
      .on('broadcast', { event: 'call-state' }, ({ payload }) => {
        if (!isValidOpponentPayload(payload)) return;
        if (payload.state === 'reconnecting') setCallState('reconnecting');
        if (payload.state === 'off') {
          if (callRef.current) {
            void endLiveMatchCall(false);
          } else {
            setCallState('off');
          }
        }
      })
      .on('broadcast', { event: 'call-ended' }, ({ payload }) => {
        if (!isValidOpponentPayload(payload)) return;
        void endLiveMatchCall(false);
      })
      .on('broadcast', { event: 'call-mute' }, ({ payload }) => {
        if (!isValidOpponentPayload(payload)) return;
        setOpponentMuted(!!payload.muted);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Guest sends ready to signal they've joined
          if (!isHost) {
            channel.send({
              type: 'broadcast',
              event: 'ready',
              payload: { playerId: userIdRef.current },
            });
          }
        }
      });

    matchChannelRef.current = channel;
  }

  function beginCountdown() {
    setPhase('countdown');
    let count = COUNTDOWN_SECS;
    setCountdownNum(count);

    countdownRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        setPhase('playing');
        setStartedAt(Date.now());
        startGameTimer();
        void startLiveMatchCall();
      } else {
        setCountdownNum(count);
      }
    }, 1000);
  }

  function startGameTimer() {
    let remaining = 60;
    setTimeLeft(remaining);
    timerRef.current = setInterval(() => {
      remaining--;
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        if (!mySubmittedRef.current) {
          handleSubmit(-1);
        }
      }
    }, 1000);
  }

  // ── Submit + Anti-Cheat ─────────────────────────────────────────

  function handleSubmit(optionIndex: number) {
    if (mySubmittedRef.current || !puzzle) return;
    mySubmittedRef.current = true;

    const msTaken = Date.now() - startedAt;
    const isCorrect = optionIndex === puzzle.answer_index;
    const sel = optionIndex >= 0 ? optionIndex : -1;
    if (sel >= 0) setSelected(sel);

    myRevealRef.current = { selectedIndex: sel, isCorrect, msTaken };
    setMyReveal(myRevealRef.current);

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    matchChannelRef.current?.send({
      type: 'broadcast',
      event: 'submitted',
      payload: { playerId: userIdRef.current },
    });

    setPhase('waiting');

    if (oppSubmittedRef.current) {
      broadcastReveal();
    }
  }

  function broadcastReveal() {
    if (!myRevealRef.current) return;
    matchChannelRef.current?.send({
      type: 'broadcast',
      event: 'reveal',
      payload: {
        playerId: userIdRef.current,
        selectedIndex: myRevealRef.current.selectedIndex,
        isCorrect: myRevealRef.current.isCorrect,
        msTaken: myRevealRef.current.msTaken,
      },
    });
    if (oppRevealRef.current) {
      determineWinner(myRevealRef.current, oppRevealRef.current);
    }
  }

  // ── Winner Determination ────────────────────────────────────────

  function determineWinner(
    me: { isCorrect: boolean; msTaken: number },
    opp: { isCorrect: boolean; msTaken: number },
  ) {
    let result: MatchResult;
    if (me.isCorrect && opp.isCorrect) {
      result = me.msTaken < opp.msTaken ? 'win' : me.msTaken > opp.msTaken ? 'loss' : 'draw';
    } else if (me.isCorrect) {
      result = 'win';
    } else if (opp.isCorrect) {
      result = 'loss';
    } else {
      result = 'draw';
    }

    setMatchResult(result);
    setPhase('result');

    const next = { ...statsRef.current };
    if (result === 'win') next.wins++;
    else if (result === 'loss') next.losses++;
    else next.draws++;
    persistStats(next);

    if (matchChannelRef.current) {
      supabase.removeChannel(matchChannelRef.current);
      matchChannelRef.current = null;
    }
    void endLiveMatchCall(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function handleOpponentDisconnect() {
    if (phaseRef.current === 'result' || phaseRef.current === 'lobby') return;

    setMatchResult('win');
    setPhase('result');

    const next = { ...statsRef.current, wins: statsRef.current.wins + 1 };
    persistStats(next);

    if (matchChannelRef.current) {
      supabase.removeChannel(matchChannelRef.current);
      matchChannelRef.current = null;
    }
    void endLiveMatchCall(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }

  // ── Render Helpers ──────────────────────────────────────────────

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();
  const formatTime = (ms: number) => (ms / 1000).toFixed(1) + 's';
  const callStateLabel =
    callState === 'live'
      ? 'Live voice'
      : callState === 'connecting'
        ? 'Connecting...'
        : callState === 'reconnecting'
          ? 'Reconnecting...'
          : 'Voice off';
  const callStateColor =
    callState === 'live'
      ? colors.correct
      : callState === 'reconnecting'
        ? colors.warning
        : colors.textSecondary;

  // Merge online status into player list
  const playerList = players
    .filter((p) => p.id !== userId)
    .map((p) => ({ ...p, online: onlineIds.has(p.id) }))
    .sort((a, b) => (a.online === b.online ? 0 : a.online ? -1 : 1));


  const onlineCount = playerList.filter((p) => p.online).length;
  const totalMatches = stats.wins + stats.losses + stats.draws;
  const winRate = totalMatches > 0 ? Math.round((stats.wins / totalMatches) * 100) : 0;
  const matchHasChat = phase !== 'lobby' && !!matchId;
  const showCallControls = phase === 'playing' || phase === 'waiting';
  const unreadLabel = chatUnread > 99 ? '99+' : `${chatUnread}`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.backgroundLayer} pointerEvents="none">
        <View style={[styles.bgOrbTop, { backgroundColor: `${colors.primary}18` }]} />
        <View style={[styles.bgOrbBottom, { backgroundColor: `${colors.secondary}14` }]} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.appTitle, { color: colors.text }]}>Battle Arena</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Real-time 1v1 puzzle duels</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={[styles.headerBadge, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="radio-outline" size={14} color={colors.primary} />
            <Text style={[styles.headerBadgeText, { color: colors.primary }]}>Live</Text>
          </View>
          {matchHasChat && (
            <Pressable
              onPress={() => setChatOpen((prev) => !prev)}
              style={[styles.chatToggleBtn, { borderColor: `${colors.primary}35`, backgroundColor: `${colors.primary}10` }]}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
              {chatUnread > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.wrong }]}>
                  <Text style={styles.unreadBadgeText}>{unreadLabel}</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {pendingInvite && phase === 'lobby' && (
        <View style={[styles.inviteBanner, { borderColor: `${colors.primary}35`, backgroundColor: `${colors.primary}10` }]}>
          <View style={styles.inviteBannerContent}>
            <View style={[styles.inviteIconWrap, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="flash" size={18} color={colors.primary} />
            </View>
            <View style={styles.inviteBannerText}>
              <Text style={[styles.inviteBannerTitle, { color: colors.text }]}>Challenge incoming</Text>
              <Text style={[styles.inviteBannerFrom, { color: colors.textSecondary }]}>
                {pendingInvite.fromName} wants a quick battle
              </Text>
            </View>
          </View>
          <View style={styles.inviteBannerActions}>
            <Pressable onPress={acceptInvite} style={[styles.inviteBtn, { backgroundColor: colors.correct }]}>
              <Text style={styles.inviteBtnText}>Accept</Text>
            </Pressable>
            <Pressable onPress={declineInvite} style={[styles.inviteBtn, { backgroundColor: colors.wrong }]}>
              <Text style={styles.inviteBtnText}>Decline</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {phase === 'lobby' && (
          <>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroGlow} />
              <Text style={styles.heroTitle}>Queue Up</Text>
              <Text style={styles.heroSubtitle}>Invite any online player to start an instant round.</Text>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatPill}>
                  <Text style={styles.heroStatValue}>{onlineCount}</Text>
                  <Text style={styles.heroStatLabel}>Online</Text>
                </View>
                <View style={styles.heroStatPill}>
                  <Text style={styles.heroStatValue}>{totalMatches}</Text>
                  <Text style={styles.heroStatLabel}>Matches</Text>
                </View>
                <View style={styles.heroStatPill}>
                  <Text style={styles.heroStatValue}>{winRate}%</Text>
                  <Text style={styles.heroStatLabel}>Win rate</Text>
                </View>
              </View>
            </LinearGradient>

            <Card style={styles.card} padding="lg">
              <Text style={[styles.statsTitle, { color: colors.text }]}>Record</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.correct }]}>{stats.wins}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Wins</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.wrong }]}>{stats.losses}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Losses</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.warning }]}>{stats.draws}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Draws</Text>
                </View>
              </View>
            </Card>

            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Active Players</Text>
              <Text style={[styles.onlineSummary, { color: colors.textSecondary }]}>{onlineCount} online</Text>
            </View>

            {loadingPlayers ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : playerList.length === 0 ? (
              <Card style={styles.card} padding="lg">
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="people-outline" size={46} color={colors.textTertiary} style={{ marginBottom: spacing.md }} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No players detected yet. Share MindArena and build your battle lobby.</Text>
                </View>
              </Card>
            ) : (
              playerList.map((player) => (
                <Pressable
                  key={player.id}
                  onPress={() => player.online && sendInvite(player)}
                  disabled={!player.online}
                  style={({ pressed }) => [
                    styles.playerRow,
                    {
                      opacity: player.online ? 1 : 0.62,
                      borderColor: player.online ? `${colors.primary}30` : colors.border,
                      backgroundColor: pressed ? `${colors.primary}08` : colors.surface,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.playerAvatar,
                      { backgroundColor: player.online ? `${colors.primary}16` : colors.surfaceVariant },
                    ]}
                  >
                    {player.avatar_url ? (
                      <Image source={{ uri: player.avatar_url }} style={styles.playerAvatarImage} />
                    ) : (
                      <Text
                        style={[
                          styles.playerAvatarText,
                          { color: player.online ? colors.primary : colors.textTertiary },
                        ]}
                      >
                        {getInitials(player.display_name || player.username)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.playerInfo}>
                    <Text style={[styles.playerName, { color: colors.text }]}>
                      {player.display_name || player.username}
                    </Text>
                    <View style={styles.playerMetaRow}>
                      <Ionicons name="star" size={12} color={colors.warning} />
                      <Text style={[styles.playerMeta, { color: colors.textSecondary }]}>
                        {player.total_points} points
                      </Text>
                    </View>
                  </View>

                  <View style={styles.playerAction}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: player.online ? `${colors.correct}16` : `${colors.textTertiary}16` },
                      ]}
                    >
                      <View
                        style={[
                          styles.onlineDot,
                          { backgroundColor: player.online ? colors.correct : colors.textTertiary },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusLabel,
                          { color: player.online ? colors.correct : colors.textSecondary },
                        ]}
                      >
                        {player.online ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                    {player.online && (
                      <View style={[styles.battleAction, { backgroundColor: `${colors.primary}16` }]}>
                        <Ionicons name="flash" size={13} color={colors.primary} />
                        <Text style={[styles.battleActionText, { color: colors.primary }]}>Invite</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))
            )}

            {!userId && (
              <View style={[styles.signInHintWrap, { backgroundColor: `${colors.warning}16` }]}>
                <Ionicons name="log-in-outline" size={18} color={colors.warning} />
                <Text style={[styles.signInHint, { color: colors.warning }]}>Sign in to battle online opponents.</Text>
              </View>
            )}
          </>
        )}

        {phase === 'invite-sent' && (
          <Card style={styles.phaseCard} padding="lg">
            <View style={styles.centeredPhase}>
              <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: spacing.lg }} />
              <Text style={[styles.phaseTitle, { color: colors.text }]}>Invite Sent</Text>
              <Text style={[styles.phaseSubtitle, { color: colors.textSecondary }]}>Waiting for {invitedPlayer?.username ?? 'opponent'} to join...</Text>
              <Button title="Cancel Invite" onPress={cancelInvite} variant="outline" style={{ marginTop: spacing.lg }} />
            </View>
          </Card>
        )}

        {phase === 'found' && (
          <Card style={styles.phaseCard} padding="lg">
            <View style={styles.centeredPhase}>
              <View style={[styles.foundBadge, { backgroundColor: `${colors.primary}16` }]}>
                <Ionicons name="flash" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.foundLabel, { color: colors.primary }]}>Match Found</Text>

              <View style={styles.vsRow}>
                <View style={styles.playerCircleWrap}>
                  <View style={[styles.playerCircle, { backgroundColor: `${colors.primary}16`, borderColor: colors.primary }]}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.playerCircleImage} />
                    ) : (
                      <Text style={[styles.playerInitials, { color: colors.primary }]}>{getInitials(username)}</Text>
                    )}
                  </View>
                  <Text style={[styles.circleLabel, { color: colors.text }]}>You</Text>
                </View>

                <View style={[styles.vsBadge, { backgroundColor: colors.text }]}>
                  <Text style={[styles.vsText, { color: colors.surface }]}>VS</Text>
                </View>

                <View style={styles.playerCircleWrap}>
                  <View style={[styles.playerCircle, { backgroundColor: `${colors.wrong}16`, borderColor: colors.wrong }]}>
                    {opponentAvatarUrl ? (
                      <Image source={{ uri: opponentAvatarUrl }} style={styles.playerCircleImage} />
                    ) : (
                      <Text style={[styles.playerInitials, { color: colors.wrong }]}>{getInitials(opponentName)}</Text>
                    )}
                  </View>
                  <Text style={[styles.circleLabel, { color: colors.text }]}>{opponentName}</Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {phase === 'countdown' && (
          <Card style={styles.phaseCard} padding="lg">
            <View style={styles.centeredPhase}>
              <View style={[styles.countdownCircle, { borderColor: countdownNum >= 2 ? colors.primary : colors.warning }]}>
                <Text style={[styles.countdownNum, { color: countdownNum >= 2 ? colors.primary : colors.warning }]}>
                  {countdownNum}
                </Text>
              </View>
              <Text style={[styles.phaseSubtitle, { color: colors.textSecondary }]}>Starting in...</Text>
            </View>
          </Card>
        )}

        {phase === 'playing' && puzzle && (
          <View style={{ flex: 1 }}>
            <View style={styles.playingHeader}>
              <View style={[styles.timerBadge, { backgroundColor: timeLeft <= 10 ? `${colors.wrong}16` : colors.surfaceVariant }]}>
                <Ionicons name="time-outline" size={16} color={timeLeft <= 10 ? colors.wrong : colors.textSecondary} />
                <Text style={[styles.timerText, { color: timeLeft <= 10 ? colors.wrong : colors.textSecondary }]}>
                  {timeLeft}s
                </Text>
              </View>
              <View style={[styles.opponentStatusBadge, { backgroundColor: opponentSubmitted ? `${colors.warning}16` : `${colors.primary}14` }]}>
                <View style={[styles.statusDot, { backgroundColor: opponentSubmitted ? colors.warning : colors.primary }]} />
                <Text style={[styles.opponentStatusText, { color: opponentSubmitted ? colors.warning : colors.primary }]}>
                  {opponentSubmitted ? 'Opponent finished' : 'Opponent solving'}
                </Text>
              </View>
            </View>

            <Card style={styles.card} padding="lg">
              <Text style={[styles.puzzleTitle, { color: colors.text }]}>Solve Fast</Text>
              <Text style={[styles.puzzlePrompt, { color: colors.text }]}>{puzzle.prompt}</Text>

              <View style={styles.optionsWrap}>
                {puzzle.options.map((opt, i) => {
                  const isSelected = selected === i;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => setSelected(i)}
                      style={({ pressed }) => [
                        styles.option,
                        {
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? `${colors.primary}10` : colors.surface,
                          transform: [{ scale: pressed ? 0.985 : 1 }],
                        },
                      ]}
                    >
                      <View style={styles.optionContent}>
                        <View
                          style={[
                            styles.optionLetter,
                            {
                              borderColor: isSelected ? colors.primary : colors.border,
                              backgroundColor: isSelected ? colors.primary : 'transparent',
                            },
                          ]}
                        >
                          <Text style={[styles.optionLetterText, { color: isSelected ? '#fff' : colors.textSecondary }]}>
                            {['A', 'B', 'C', 'D'][i]}
                          </Text>
                        </View>
                        <Text style={[styles.optionText, { color: colors.text, fontWeight: isSelected ? '700' : '500' }]}>
                          {opt}
                        </Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Button
              title="Submit Answer"
              onPress={() => selected !== null && handleSubmit(selected)}
              disabled={selected === null}
              variant="gradient"
              size="lg"
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}

        {phase === 'waiting' && (
          <Card style={styles.phaseCard} padding="lg">
            <View style={styles.centeredPhase}>
              <View style={[styles.waitingIconWrap, { backgroundColor: `${colors.primary}14` }]}>
                <Ionicons name="checkmark" size={42} color={colors.primary} />
              </View>
              <Text style={[styles.phaseTitle, { color: colors.text, marginTop: spacing.lg }]}>Answer Locked</Text>
              <Text style={[styles.phaseSubtitle, { color: colors.textSecondary }]}>Waiting for {opponentName}...</Text>
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />
            </View>
          </Card>
        )}

        {phase === 'result' && (
          <>
            <Card style={styles.card} padding="lg">
              <View style={styles.resultBanner}>
                {matchResult === 'win' ? (
                  <View style={[styles.resultIconWrap, { backgroundColor: `${colors.correct}15` }]}>
                    <Ionicons name="trophy" size={44} color={colors.correct} />
                  </View>
                ) : matchResult === 'loss' ? (
                  <View style={[styles.resultIconWrap, { backgroundColor: `${colors.wrong}15` }]}>
                    <Ionicons name="sad" size={44} color={colors.wrong} />
                  </View>
                ) : (
                  <View style={[styles.resultIconWrap, { backgroundColor: `${colors.warning}15` }]}>
                    <Ionicons name="hand-right" size={44} color={colors.warning} />
                  </View>
                )}

                <Text
                  style={[
                    styles.resultTitle,
                    {
                      color:
                        matchResult === 'win'
                          ? colors.correct
                          : matchResult === 'loss'
                            ? colors.wrong
                            : colors.warning,
                    },
                  ]}
                >
                  {matchResult === 'win' ? 'You Win' : matchResult === 'loss' ? 'You Lose' : 'Draw'}
                </Text>
              </View>

              {myReveal && (
                <View style={styles.comparisonWrap}>
                  <View style={styles.comparisonCol}>
                    <Text style={[styles.compLabel, { color: colors.textSecondary }]}>You</Text>
                    <View style={[styles.compCircle, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }]}>
                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.compAvatarImage} />
                      ) : (
                        <Text style={[styles.compInitials, { color: colors.primary }]}>{getInitials(username)}</Text>
                      )}
                    </View>
                    <View style={[styles.compBadge, { backgroundColor: myReveal.isCorrect ? `${colors.correct}14` : `${colors.wrong}14` }]}>
                      <Text style={{ color: myReveal.isCorrect ? colors.correct : colors.wrong, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
                        {myReveal.isCorrect ? 'Correct' : 'Wrong'}
                      </Text>
                    </View>
                    <Text style={[styles.compTime, { color: colors.textSecondary }]}>{formatTime(myReveal.msTaken)}</Text>
                  </View>

                  <View style={[styles.vsBadgeSmall, { backgroundColor: colors.text }]}>
                    <Text style={[styles.vsTextSmall, { color: colors.surface }]}>VS</Text>
                  </View>

                  <View style={styles.comparisonCol}>
                    <Text style={[styles.compLabel, { color: colors.textSecondary }]}>{opponentName}</Text>
                    <View style={[styles.compCircle, { backgroundColor: `${colors.wrong}15`, borderColor: colors.wrong }]}>
                      {opponentAvatarUrl ? (
                        <Image source={{ uri: opponentAvatarUrl }} style={styles.compAvatarImage} />
                      ) : (
                        <Text style={[styles.compInitials, { color: colors.wrong }]}>{getInitials(opponentName)}</Text>
                      )}
                    </View>
                    {oppReveal ? (
                      <>
                        <View style={[styles.compBadge, { backgroundColor: oppReveal.isCorrect ? `${colors.correct}14` : `${colors.wrong}14` }]}>
                          <Text style={{ color: oppReveal.isCorrect ? colors.correct : colors.wrong, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
                            {oppReveal.isCorrect ? 'Correct' : 'Wrong'}
                          </Text>
                        </View>
                        <Text style={[styles.compTime, { color: colors.textSecondary }]}>{formatTime(oppReveal.msTaken)}</Text>
                      </>
                    ) : (
                      <Text style={[styles.compTime, { color: colors.textTertiary }]}>Disconnected</Text>
                    )}
                  </View>
                </View>
              )}
            </Card>

            <Button
              title="Play Again"
              onPress={resetToLobby}
              variant="gradient"
              size="lg"
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          </>
        )}

        {showCallControls && (
          <Card style={styles.card} padding="md">
            <View style={styles.callHeaderRow}>
              <View style={[styles.callStatePill, { backgroundColor: `${callStateColor}16` }]}>
                <View style={[styles.callStateDot, { backgroundColor: callStateColor }]} />
                <Text style={[styles.callStateText, { color: callStateColor }]}>{callStateLabel}</Text>
              </View>
              {opponentMuted && (
                <Text style={[styles.remoteMuteText, { color: colors.textSecondary }]}>Opponent muted</Text>
              )}
            </View>

            {Platform.OS === 'web' ? (
              <Text style={[styles.voiceUnavailable, { color: colors.textSecondary }]}>
                Live voice call is available on Android/iOS dev build or release build.
              </Text>
            ) : (
              <View style={styles.callControlsRow}>
                <Pressable
                  onPress={() => toggleCallMute()}
                  style={[
                    styles.callControlBtn,
                    {
                      backgroundColor: callMuted ? `${colors.warning}16` : `${colors.primary}14`,
                      borderColor: callMuted ? `${colors.warning}35` : `${colors.primary}30`,
                    },
                  ]}
                >
                  <Ionicons
                    name={callMuted ? 'mic-off-outline' : 'mic-outline'}
                    size={16}
                    color={callMuted ? colors.warning : colors.primary}
                  />
                  <Text style={[styles.callControlText, { color: callMuted ? colors.warning : colors.primary }]}>
                    {callMuted ? 'Unmute' : 'Mute'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={toggleCallSpeaker}
                  style={[
                    styles.callControlBtn,
                    {
                      backgroundColor: callSpeakerOn ? `${colors.primary}14` : colors.surfaceVariant,
                      borderColor: callSpeakerOn ? `${colors.primary}30` : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={callSpeakerOn ? 'volume-high-outline' : 'volume-low-outline'}
                    size={16}
                    color={callSpeakerOn ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.callControlText, { color: callSpeakerOn ? colors.primary : colors.textSecondary }]}>
                    {callSpeakerOn ? 'Speaker' : 'Earpiece'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => endLiveMatchCall(true)}
                  style={[
                    styles.callControlBtn,
                    {
                      backgroundColor: `${colors.wrong}14`,
                      borderColor: `${colors.wrong}30`,
                    },
                  ]}
                >
                  <Ionicons name="call-outline" size={16} color={colors.wrong} />
                  <Text style={[styles.callControlText, { color: colors.wrong }]}>Leave Voice</Text>
                </Pressable>
              </View>
            )}
          </Card>
        )}

        {matchHasChat && (
          <Card style={styles.card} padding="md">
            <Pressable
              onPress={() => setChatOpen((prev) => !prev)}
              style={styles.chatHeaderRow}
            >
              <View style={styles.chatHeaderTitleRow}>
                <Ionicons name="chatbox-ellipses-outline" size={16} color={colors.text} />
                <Text style={[styles.chatTitle, { color: colors.text }]}>Match Chat</Text>
              </View>
              <View style={styles.chatHeaderRight}>
                {chatUnread > 0 && !chatOpen && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.wrong }]}>
                    <Text style={styles.unreadBadgeText}>{unreadLabel}</Text>
                  </View>
                )}
                <Ionicons name={chatOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
              </View>
            </Pressable>

            {reactionToast && (
              <View style={[styles.reactionToast, { backgroundColor: `${colors.primary}16`, borderColor: `${colors.primary}30` }]}>
                <Text style={styles.reactionToastEmoji}>{reactionToast.emoji}</Text>
                <Text style={[styles.reactionToastText, { color: colors.text }]}>
                  {reactionToast.fromName} reacted
                </Text>
              </View>
            )}

            {chatOpen && (
              <>
                <View style={styles.reactionRow}>
                  {QUICK_REACTIONS.map((emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => sendEmojiReaction(emoji)}
                      disabled={chatBusy}
                      style={[styles.reactionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                    >
                      <Text style={styles.reactionBtnText}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>

                <ScrollView style={styles.chatLog} contentContainerStyle={styles.chatLogContent} nestedScrollEnabled>
                  {chatMessages.length === 0 ? (
                    <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>
                      No messages yet. Send a reaction or text.
                    </Text>
                  ) : (
                    chatMessages.map((msg) => {
                      const mine = msg.sender_id === userId;
                      const bubbleColor = mine ? `${colors.primary}18` : colors.surfaceVariant;
                      const bubbleBorder = mine ? `${colors.primary}35` : colors.border;
                      return (
                        <View
                          key={msg.id}
                          style={[styles.chatMessageRow, { alignItems: mine ? 'flex-end' : 'flex-start' }]}
                        >
                          <Text style={[styles.chatSender, { color: colors.textSecondary }]}>
                            {mine ? 'You' : msg.sender_name || opponentName}
                          </Text>
                          <View style={[styles.chatBubble, { backgroundColor: bubbleColor, borderColor: bubbleBorder }]}>
                            {msg.message_type === 'text' && !!msg.text_content && (
                              <Text style={[styles.chatMessageText, { color: colors.text }]}>{msg.text_content}</Text>
                            )}
                            {msg.message_type === 'emoji' && !!msg.emoji && (
                              <Text style={styles.chatEmojiOnly}>{msg.emoji}</Text>
                            )}
                            {msg.message_type === 'voice' && (
                              <Text style={[styles.chatMessageText, { color: colors.textSecondary }]}>
                                Voice clip
                              </Text>
                            )}
                          </View>
                          <Text style={[styles.chatTime, { color: colors.textTertiary }]}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                <View style={styles.chatComposerRow}>
                  <TextInput
                    value={chatInput}
                    onChangeText={setChatInput}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.textTertiary}
                    maxLength={CHAT_TEXT_LIMIT}
                    editable={!chatBusy}
                    returnKeyType="send"
                    onSubmitEditing={sendChatText}
                    style={[
                      styles.chatInput,
                      { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceVariant },
                    ]}
                  />
                  <Pressable
                    onPress={sendChatText}
                    disabled={chatBusy || !chatInput.trim()}
                    style={[
                      styles.chatSendBtn,
                      {
                        backgroundColor: chatBusy || !chatInput.trim() ? colors.border : colors.primary,
                      },
                    ]}
                  >
                    <Ionicons name="send" size={15} color="#fff" />
                  </Pressable>
                </View>
              </>
            )}
          </Card>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundLayer: { ...StyleSheet.absoluteFillObject },
  bgOrbTop: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -90,
    right: -70,
  },
  bgOrbBottom: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    bottom: 120,
    left: -90,
  },

  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerTitleWrap: { flex: 1 },
  appTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  headerSubtitle: { fontSize: fontSize.sm, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  chatToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -7,
    right: -8,
  },
  unreadBadgeText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold },

  inviteBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  inviteBannerContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  inviteIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteBannerText: { flex: 1 },
  inviteBannerTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  inviteBannerFrom: { fontSize: fontSize.sm, marginTop: 2 },
  inviteBannerActions: { flexDirection: 'row', gap: spacing.sm },
  inviteBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  inviteBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    alignSelf: 'center',
    width: '100%',
  },

  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    top: -65,
    right: -50,
    backgroundColor: 'rgba(255,255,255,0.17)',
  },
  heroTitle: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  heroStatsRow: { flexDirection: 'row', gap: spacing.sm },
  heroStatPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.17)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  heroStatValue: { color: '#fff', fontSize: fontSize.lg, fontWeight: fontWeight.black },
  heroStatLabel: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.xs },

  card: { marginBottom: spacing.md, borderRadius: borderRadius.xl },
  statsTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: spacing.md, textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  statLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, marginTop: 2 },
  statDivider: { width: 1, height: 34 },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionLabel: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  onlineSummary: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  emptyText: { fontSize: fontSize.sm, textAlign: 'center' },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  playerAvatarText: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  playerInfo: { flex: 1, marginLeft: spacing.md },
  playerName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  playerMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 },
  playerMeta: { fontSize: fontSize.xs },
  playerAction: { alignItems: 'flex-end', gap: spacing.xs },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  battleAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  battleActionText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  signInHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  signInHint: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  phaseCard: { marginBottom: spacing.md, borderRadius: borderRadius.xl },
  centeredPhase: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl + spacing.md },
  phaseTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, textAlign: 'center' },
  phaseSubtitle: { fontSize: fontSize.base, textAlign: 'center', marginTop: spacing.sm },

  foundBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  foundLabel: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, marginBottom: spacing.lg },
  vsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  playerCircleWrap: { alignItems: 'center', gap: spacing.sm },
  playerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  playerCircleImage: {
    width: '100%',
    height: '100%',
  },
  playerInitials: { fontSize: fontSize['3xl'], fontWeight: fontWeight.black },
  circleLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  vsBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  vsText: { fontSize: fontSize.lg, fontWeight: fontWeight.black },

  countdownCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  countdownNum: { fontSize: fontSize['5xl'] * 1.3, fontWeight: fontWeight.black },

  playingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  timerText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  opponentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  opponentStatusText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  puzzleTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, marginBottom: spacing.sm },
  puzzlePrompt: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    lineHeight: fontSize.lg * 1.5,
    marginBottom: spacing.lg,
  },
  optionsWrap: { gap: spacing.sm },
  option: {
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  optionText: { fontSize: fontSize.base, flex: 1 },

  waitingIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultBanner: { alignItems: 'center', marginBottom: spacing.lg },
  resultIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  resultTitle: { fontSize: fontSize['3xl'], fontWeight: fontWeight.black },

  comparisonWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  comparisonCol: { flex: 1, alignItems: 'center', gap: spacing.sm },
  compLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  compCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  compAvatarImage: {
    width: '100%',
    height: '100%',
  },
  compInitials: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  compBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  compTime: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  vsBadgeSmall: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  vsTextSmall: { fontSize: fontSize.base, fontWeight: fontWeight.bold },

  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  chatHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chatTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  chatHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 20, paddingRight: spacing.xs },
  reactionToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  reactionToastEmoji: { fontSize: fontSize.lg },
  reactionToastText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  reactionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  reactionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBtnText: { fontSize: fontSize.lg },
  chatLog: { maxHeight: 230, marginBottom: spacing.sm },
  chatLogContent: { gap: spacing.sm, paddingVertical: spacing.xs },
  emptyChatText: { fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.md },
  chatMessageRow: { gap: 4 },
  chatSender: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  chatBubble: {
    maxWidth: '88%',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chatMessageText: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  chatEmojiOnly: { fontSize: 28, lineHeight: 34 },
  chatTime: { fontSize: fontSize.xs },
  chatComposerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  callStatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  callStateDot: { width: 8, height: 8, borderRadius: 4 },
  callStateText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  remoteMuteText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  voiceUnavailable: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.45 },
  callControlsRow: { flexDirection: 'row', gap: spacing.sm },
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
});
