import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  AppState,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { offlinePuzzles, Puzzle } from '@/lib/puzzles';
import { getItem, setItem } from '@/lib/storage';
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
  total_points: number;
  online: boolean;
};

type PendingInvite = {
  matchId: string;
  puzzleIndex: number;
  fromId: string;
  fromName: string;
};

const STATS_KEY = 'pvp-stats';
const COUNTDOWN_SECS = 3;
const FOUND_DELAY_MS = 1500;
const INVITE_TIMEOUT_MS = 30_000;

// ── Component ───────────────────────────────────────────────────────

export default function PvpScreen() {
  const { colors } = useTheme();

  // Auth
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('Player');

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

  // Refs for channels and timers
  const lobbyChannelRef = useRef<RealtimeChannel | null>(null);
  const inviteChannelRef = useRef<RealtimeChannel | null>(null);
  const matchChannelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inviteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>('lobby');
  const mySubmittedRef = useRef(false);
  const oppSubmittedRef = useRef(false);
  const myRevealRef = useRef<typeof myReveal>(null);
  const oppRevealRef = useRef<typeof oppReveal>(null);
  const isHostRef = useRef(false);
  const matchIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const statsRef = useRef<PvpStats>({ wins: 0, losses: 0, draws: 0 });

  // Keep refs in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { matchIdRef.current = matchId; }, [matchId]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { statsRef.current = stats; }, [stats]);

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
          .select('username')
          .eq('id', uid)
          .maybeSingle<{ username: string }>();
        if (profile?.username && mounted) setUsername(profile.username);

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
        .select('id, username, display_name, total_points')
        .order('total_points', { ascending: false });
      if (!error && data) {
        setPlayers(
          data.map((p: any) => ({
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            total_points: p.total_points ?? 0,
            online: false, // updated by presence
          })),
        );
      }
    } catch { /* ignore */ }
    setLoadingPlayers(false);
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
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    if (inviteTimeoutRef.current) { clearTimeout(inviteTimeoutRef.current); inviteTimeoutRef.current = null; }
    mySubmittedRef.current = false;
    oppSubmittedRef.current = false;
    myRevealRef.current = null;
    oppRevealRef.current = null;
    isHostRef.current = false;
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
    setPhase('lobby');
    setMatchId(null);
    setOpponentName('Opponent');
    setOpponentId(null);
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

    const puzzleIndex = Math.floor(Math.random() * offlinePuzzles.length);
    const newMatchId = Crypto.randomUUID();

    setInvitedPlayer(player);
    setOpponentName(player.username);
    setOpponentId(player.id);
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

    const { matchId: mId, puzzleIndex, fromId, fromName } = pendingInvite;
    setMatchId(mId);
    setOpponentName(fromName);
    setOpponentId(fromId);
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
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }

  // ── Render Helpers ──────────────────────────────────────────────

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();
  const formatTime = (ms: number) => (ms / 1000).toFixed(1) + 's';

  // Merge online status into player list
  const playerList = players
    .filter((p) => p.id !== userId)
    .map((p) => ({ ...p, online: onlineIds.has(p.id) }))
    .sort((a, b) => (a.online === b.online ? 0 : a.online ? -1 : 1));

  // ── RENDER ──────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.appTitle, { color: colors.text }]}>Battle Mode</Text>
        <View style={[styles.headerBadge, { backgroundColor: `${colors.primary}20` }]}>
          <Ionicons name="flash" size={16} color={colors.primary} />
          <Text style={[styles.headerBadgeText, { color: colors.primary }]}>1v1</Text>
        </View>
      </View>

      {/* ── Incoming Invite Banner ── */}
      {pendingInvite && phase === 'lobby' && (
        <View style={[styles.inviteBanner, { backgroundColor: `${colors.primary}15`, borderBottomColor: colors.border }]}>
          <View style={styles.inviteBannerContent}>
            <Ionicons name="flash" size={20} color={colors.primary} />
            <View style={styles.inviteBannerText}>
              <Text style={[styles.inviteBannerTitle, { color: colors.text }]}>
                Battle Invite!
              </Text>
              <Text style={[styles.inviteBannerFrom, { color: colors.textSecondary }]}>
                {pendingInvite.fromName} wants to battle you
              </Text>
            </View>
          </View>
          <View style={styles.inviteBannerActions}>
            <Pressable
              onPress={acceptInvite}
              style={[styles.inviteBtn, { backgroundColor: colors.correct }]}
            >
              <Text style={styles.inviteBtnText}>Accept</Text>
            </Pressable>
            <Pressable
              onPress={declineInvite}
              style={[styles.inviteBtn, { backgroundColor: colors.wrong }]}
            >
              <Text style={styles.inviteBtnText}>Decline</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── LOBBY ── */}
        {phase === 'lobby' && (
          <>
            {/* Stats Card */}
            <Card style={styles.card} padding="lg">
              <Text style={[styles.statsTitle, { color: colors.text }]}>Your Battle Stats</Text>
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

            {/* Player List */}
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              Players ({playerList.filter((p) => p.online).length} online)
            </Text>

            {loadingPlayers ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : playerList.length === 0 ? (
              <Card style={styles.card} padding="lg">
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No other players found. Invite your friends to join MindArena!
                </Text>
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
                      backgroundColor: pressed ? `${colors.primary}08` : colors.surface,
                      borderColor: colors.border,
                      opacity: player.online ? 1 : 0.5,
                    },
                  ]}
                >
                  {/* Avatar */}
                  <View
                    style={[
                      styles.playerAvatar,
                      { backgroundColor: player.online ? `${colors.primary}20` : colors.surfaceVariant },
                    ]}
                  >
                    <Text
                      style={[
                        styles.playerAvatarText,
                        { color: player.online ? colors.primary : colors.textTertiary },
                      ]}
                    >
                      {getInitials(player.username)}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={styles.playerInfo}>
                    <Text style={[styles.playerName, { color: colors.text }]}>
                      {player.display_name || player.username}
                    </Text>
                    <Text style={[styles.playerMeta, { color: colors.textSecondary }]}>
                      {player.total_points} pts
                    </Text>
                  </View>

                  {/* Status / Action */}
                  <View style={styles.playerAction}>
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.onlineDot,
                          { backgroundColor: player.online ? colors.correct : colors.textTertiary },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusLabel,
                          { color: player.online ? colors.correct : colors.textTertiary },
                        ]}
                      >
                        {player.online ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                    {player.online && (
                      <Ionicons name="flash" size={18} color={colors.primary} />
                    )}
                  </View>
                </Pressable>
              ))
            )}

            {!userId && (
              <Text style={[styles.signInHint, { color: colors.textTertiary }]}>
                Sign in to play against others
              </Text>
            )}
          </>
        )}

        {/* ── INVITE SENT ── */}
        {phase === 'invite-sent' && (
          <View style={styles.centeredPhase}>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginBottom: spacing.lg }} />
            <Text style={[styles.phaseTitle, { color: colors.text }]}>Invite Sent!</Text>
            <Text style={[styles.phaseSubtitle, { color: colors.textSecondary }]}>
              Waiting for {invitedPlayer?.username ?? 'opponent'} to accept...
            </Text>
            <Button
              title="Cancel"
              onPress={cancelInvite}
              variant="outline"
              style={{ marginTop: spacing.xl }}
            />
          </View>
        )}

        {/* ── FOUND ── */}
        {phase === 'found' && (
          <View style={styles.centeredPhase}>
            <Text style={[styles.foundLabel, { color: colors.primary }]}>Match Starting!</Text>
            <View style={styles.vsRow}>
              <View style={[styles.playerCircle, { backgroundColor: `${colors.primary}20` }]}>
                <Text style={[styles.playerInitials, { color: colors.primary }]}>
                  {getInitials(username)}
                </Text>
              </View>
              <Text style={[styles.vsText, { color: colors.textTertiary }]}>VS</Text>
              <View style={[styles.playerCircle, { backgroundColor: `${colors.wrong}20` }]}>
                <Text style={[styles.playerInitials, { color: colors.wrong }]}>
                  {getInitials(opponentName)}
                </Text>
              </View>
            </View>
            <Text style={[styles.phaseSubtitle, { color: colors.textSecondary }]}>Get ready...</Text>
          </View>
        )}

        {/* ── COUNTDOWN ── */}
        {phase === 'countdown' && (
          <View style={styles.centeredPhase}>
            <Text
              style={[
                styles.countdownNum,
                { color: countdownNum >= 2 ? colors.primary : colors.warning },
              ]}
            >
              {countdownNum}
            </Text>
            <Text style={[styles.phaseSubtitle, { color: colors.textSecondary }]}>Get ready...</Text>
          </View>
        )}

        {/* ── PLAYING ── */}
        {phase === 'playing' && puzzle && (
          <>
            <View style={styles.playingHeader}>
              <View style={[styles.timerBadge, { backgroundColor: timeLeft <= 10 ? `${colors.wrong}20` : colors.surfaceVariant }]}>
                <Ionicons name="time-outline" size={16} color={timeLeft <= 10 ? colors.wrong : colors.textSecondary} />
                <Text style={[styles.timerText, { color: timeLeft <= 10 ? colors.wrong : colors.textSecondary }]}>
                  {timeLeft}s
                </Text>
              </View>
              <View style={styles.opponentStatus}>
                <View style={[styles.statusDot, { backgroundColor: opponentSubmitted ? colors.warning : colors.correct }]} />
                <Text style={[styles.opponentStatusText, { color: colors.textSecondary }]}>
                  {opponentSubmitted ? 'Opponent finished' : 'Opponent solving...'}
                </Text>
              </View>
            </View>

            <Card style={styles.card} padding="lg">
              <Text style={[styles.puzzleTitle, { color: colors.text }]}>{puzzle.title}</Text>
              <Text style={[styles.puzzlePrompt, { color: colors.text }]}>{puzzle.prompt}</Text>

              <View style={styles.optionsWrap}>
                {puzzle.options.map((opt, i) => {
                  const active = selected === i;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => setSelected(i)}
                      style={[
                        styles.option,
                        {
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? `${colors.primary}08` : colors.surface,
                        },
                      ]}
                    >
                      <View style={styles.optionContent}>
                        <View style={[styles.optionLetter, { borderColor: active ? colors.primary : colors.border }]}>
                          <Text style={[styles.optionLetterText, { color: active ? colors.primary : colors.text }]}>
                            {String.fromCharCode(65 + i)}
                          </Text>
                        </View>
                        <Text style={[styles.optionText, { color: active ? colors.primary : colors.text }]}>
                          {opt}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Button
                title="Submit Answer"
                onPress={() => handleSubmit(selected ?? -1)}
                disabled={selected === null}
                fullWidth
                size="lg"
                style={{ marginTop: spacing.lg }}
              />
            </Card>
          </>
        )}

        {/* ── WAITING ── */}
        {phase === 'waiting' && (
          <View style={styles.centeredPhase}>
            <Ionicons name="checkmark-circle" size={48} color={colors.correct} />
            <Text style={[styles.phaseTitle, { color: colors.text, marginTop: spacing.md }]}>
              Answer Locked In!
            </Text>
            <Text style={[styles.phaseSubtitle, { color: colors.textSecondary }]}>
              Waiting for opponent to finish...
            </Text>
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          </View>
        )}

        {/* ── RESULT ── */}
        {phase === 'result' && (
          <>
            <Card style={styles.card} padding="lg">
              <View style={styles.resultBanner}>
                <Text style={styles.resultEmoji}>
                  {matchResult === 'win' ? '🏆' : matchResult === 'loss' ? '😔' : '🤝'}
                </Text>
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
                  {matchResult === 'win' ? 'You Win!' : matchResult === 'loss' ? 'You Lose' : 'Draw!'}
                </Text>
              </View>

              {myReveal && (
                <View style={styles.comparisonWrap}>
                  <View style={styles.comparisonCol}>
                    <Text style={[styles.compLabel, { color: colors.textSecondary }]}>You</Text>
                    <View style={[styles.compCircle, { backgroundColor: `${colors.primary}20` }]}>
                      <Text style={[styles.compInitials, { color: colors.primary }]}>
                        {getInitials(username)}
                      </Text>
                    </View>
                    <View style={[styles.compBadge, { backgroundColor: myReveal.isCorrect ? `${colors.correct}20` : `${colors.wrong}20` }]}>
                      <Text style={{ color: myReveal.isCorrect ? colors.correct : colors.wrong, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
                        {myReveal.isCorrect ? 'Correct' : 'Wrong'}
                      </Text>
                    </View>
                    <Text style={[styles.compTime, { color: colors.textSecondary }]}>
                      {formatTime(myReveal.msTaken)}
                    </Text>
                  </View>

                  <Text style={[styles.vsTextSmall, { color: colors.textTertiary }]}>VS</Text>

                  <View style={styles.comparisonCol}>
                    <Text style={[styles.compLabel, { color: colors.textSecondary }]}>
                      {opponentName}
                    </Text>
                    <View style={[styles.compCircle, { backgroundColor: `${colors.wrong}20` }]}>
                      <Text style={[styles.compInitials, { color: colors.wrong }]}>
                        {getInitials(opponentName)}
                      </Text>
                    </View>
                    {oppReveal ? (
                      <>
                        <View style={[styles.compBadge, { backgroundColor: oppReveal.isCorrect ? `${colors.correct}20` : `${colors.wrong}20` }]}>
                          <Text style={{ color: oppReveal.isCorrect ? colors.correct : colors.wrong, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
                            {oppReveal.isCorrect ? 'Correct' : 'Wrong'}
                          </Text>
                        </View>
                        <Text style={[styles.compTime, { color: colors.textSecondary }]}>
                          {formatTime(oppReveal.msTaken)}
                        </Text>
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

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  appTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  headerBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%', paddingBottom: spacing.xl },

  card: { marginBottom: spacing.md },

  // Invite banner
  inviteBanner: {
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  inviteBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  inviteBannerText: { flex: 1 },
  inviteBannerTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  inviteBannerFrom: { fontSize: fontSize.sm },
  inviteBannerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inviteBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  inviteBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  // Stats
  statsTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginBottom: spacing.md, textAlign: 'center' },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  statLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, marginTop: 2 },
  statDivider: { width: 1, height: 32 },

  // Section label
  sectionLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },

  emptyText: { fontSize: fontSize.sm, textAlign: 'center' },

  // Player list
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerAvatarText: { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  playerInfo: { flex: 1, marginLeft: spacing.md },
  playerName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  playerMeta: { fontSize: fontSize.xs, marginTop: 2 },
  playerAction: { alignItems: 'flex-end', gap: spacing.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },

  signInHint: { fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.md },

  // Centered phases
  centeredPhase: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl * 2 },
  phaseTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, textAlign: 'center' },
  phaseSubtitle: { fontSize: fontSize.base, textAlign: 'center', marginTop: spacing.sm },

  // Found
  foundLabel: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, marginBottom: spacing.xl },
  vsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  playerCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerInitials: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  vsText: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },

  // Countdown
  countdownNum: { fontSize: fontSize['5xl'] * 1.5, fontWeight: fontWeight.black },

  // Playing
  playingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  opponentStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  opponentStatusText: { fontSize: fontSize.sm },

  // Puzzle
  puzzleTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, marginBottom: spacing.sm },
  puzzlePrompt: { fontSize: fontSize.lg, fontWeight: fontWeight.medium, lineHeight: fontSize.lg * 1.6, marginBottom: spacing.lg },
  optionsWrap: { gap: spacing.sm },
  option: {
    borderWidth: 2,
    borderRadius: borderRadius.md,
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
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  optionText: { fontSize: fontSize.base, flex: 1 },

  // Result
  resultBanner: { alignItems: 'center', marginBottom: spacing.lg },
  resultEmoji: { fontSize: 64, marginBottom: spacing.sm },
  resultTitle: { fontSize: fontSize['3xl'], fontWeight: fontWeight.black },

  comparisonWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  comparisonCol: { flex: 1, alignItems: 'center', gap: spacing.sm },
  compLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  compCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compInitials: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  compBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  compTime: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  vsTextSmall: { fontSize: fontSize.base, fontWeight: fontWeight.bold, marginHorizontal: spacing.md },
});
