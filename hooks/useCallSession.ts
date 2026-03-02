import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCall } from '@/contexts/CallContext';
import { DmWebRTCCall } from '@/lib/webrtcCall';
import { setSpeaker, startCallAudio, stopCallAudio } from '@/lib/audioRoute';
import {
  decryptDmCallPayload,
  encryptDmCallPayload,
  isPeerE2eeNotReadyError,
} from '@/lib/dmE2ee';
import { createPendingCall, getPendingCallForCallee, updatePendingCallStatus } from '@/lib/dmCalls';
import { notifyIncomingDmCall } from '@/lib/push';
import { logCallStart, logCallEnd } from '@/lib/callHistory';
import { showAlert } from '@/lib/alert';
import { usePiP } from '@/modules/pip/usePiP';
import {
  setCallActive as nativeSetCallActive,
  updatePiPActions,
  startForegroundService,
  stopForegroundService,
} from '@/modules/pip';
import type { CallUiState } from '@/lib/types';

type CallMode = 'audio' | 'video';
type IncomingInvite = { fromId: string; fromName: string; mode: CallMode };

const OUTGOING_CALL_TIMEOUT_MS = 60_000;
const COUNTDOWN_START_S = 15; // show countdown in last 15 seconds
const DM_SIGNAL_E2EE_ENABLED = true;

interface UseCallSessionOptions {
  conversationId: string | undefined;
  userId: string | null;
  peerId: string | null;
  selfName: string;
  peerName: string;
  peerAvatarUrl: string | null;
  callChannel: RealtimeChannel | null;
  consumePendingIncomingInvite: (convId: string) => IncomingInvite | null;
}

interface UseCallSessionReturn {
  callState: CallUiState;
  activeCallMode: CallMode;
  incomingInvite: IncomingInvite | null;
  outgoingMode: CallMode | null;
  callMuted: boolean;
  cameraEnabled: boolean;
  speakerOn: boolean;
  opponentMuted: boolean;
  localStreamUrl: string | null;
  remoteStreamUrl: string | null;
  callOverlayMinimized: boolean;
  timeoutCountdown: number | null; // seconds remaining, null when not showing
  startCall: (mode: CallMode) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: (sendSignal: boolean) => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => Promise<void>;
  setCallOverlayMinimized: (v: boolean) => void;
  setIncomingInvite: (v: IncomingInvite | null) => void;
  showCallOverlay: boolean;
  callStartDisabled: boolean;
}

function getStreamUrl(stream: any | null) {
  if (!stream || typeof stream.toURL !== 'function') return null;
  return stream.toURL();
}

export function useCallSession({
  conversationId,
  userId,
  peerId,
  selfName,
  peerName,
  peerAvatarUrl,
  callChannel,
  consumePendingIncomingInvite,
}: UseCallSessionOptions): UseCallSessionReturn {
  const { publishCallState, clearCallState, registerEndCallFn, registerToggleMuteFn, setIsInPiPMode } = useCall();

  const [incomingInvite, setIncomingInvite] = useState<IncomingInvite | null>(null);
  const [pendingCallId, setPendingCallId] = useState<string | null>(null);
  const [outgoingMode, setOutgoingMode] = useState<CallMode | null>(null);
  const [activeCallMode, setActiveCallMode] = useState<CallMode>('audio');
  const [callState, setCallState] = useState<CallUiState>('off');
  const [callMuted, setCallMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [opponentMuted, setOpponentMuted] = useState(false);
  const [localStreamUrl, setLocalStreamUrl] = useState<string | null>(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState<string | null>(null);
  const [callOverlayMinimized, setCallOverlayMinimized] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState<number | null>(null);

  const callRef = useRef<DmWebRTCCall | null>(null);
  const callInitPromiseRef = useRef<Promise<DmWebRTCCall | null> | null>(null);
  const pendingIceCandidatesRef = useRef<Record<string, unknown>[]>([]);
  const callInviteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callHistoryIdRef = useRef<string | null>(null);

  const userIdRef = useRef(userId);
  const peerIdRef = useRef(peerId);
  const conversationIdRef = useRef(conversationId);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { peerIdRef.current = peerId; }, [peerId]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  // PiP handlers
  const pipHandlersRef = useRef({
    onToggleMute: () => {},
    onHangUp: () => {},
    onCallKitMute: (_isMuted: boolean) => {},
  });
  const pipHandlers = useMemo(() => ({
    onToggleMute: () => pipHandlersRef.current.onToggleMute(),
    onHangUp: () => pipHandlersRef.current.onHangUp(),
    onCallKitMute: (m: boolean) => pipHandlersRef.current.onCallKitMute(m),
  }), []);
  const { isInPiP } = usePiP(pipHandlers);

  useEffect(() => { setIsInPiPMode(isInPiP); }, [isInPiP, setIsInPiPMode]);

  const clearOutgoingTimer = useCallback(() => {
    if (callInviteTimeoutRef.current) {
      clearTimeout(callInviteTimeoutRef.current);
      callInviteTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setTimeoutCountdown(null);
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

  // ── Encrypted signal helpers ──

  const sendCallSignal = useCallback(async (event: string, payload: Record<string, unknown>) => {
    const channel = callChannel;
    const uid = userIdRef.current;
    const convId = conversationIdRef.current;
    const resolvedPeerId = peerIdRef.current;
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
      try { await sendPlain(); return true; } catch { return false; }
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
        console.warn('Encrypted signal failed; falling back to plaintext', error);
      }
      try { await sendPlain(); return true; } catch { return false; }
    }
  }, [callChannel]);

  const decodePayload = useCallback(
    async (payload: Record<string, unknown>) => {
      if (typeof payload.enc !== 'string' || !DM_SIGNAL_E2EE_ENABLED) return payload;
      const uid = userIdRef.current;
      const convId = typeof payload.conversationId === 'string'
        ? payload.conversationId
        : conversationIdRef.current;
      const resolvedPeerId = peerIdRef.current;
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
    [],
  );

  // ── End call ──

  const endCall = useCallback(
    async (sendEndedSignal: boolean) => {
      clearOutgoingTimer();
      callInitPromiseRef.current = null;
      pendingIceCandidatesRef.current = [];
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

      nativeSetCallActive(false);
      stopForegroundService();

      const active = callRef.current;
      callRef.current = null;
      if (active) {
        if (sendEndedSignal) {
          await sendCallSignal('call-ended', {
            conversationId: conversationIdRef.current,
            fromId: userIdRef.current,
            toId: peerIdRef.current,
          }).catch(() => null);
        }
        await active.close(false).catch(() => null);
      }

      // Log call end
      if (callHistoryIdRef.current) {
        logCallEnd(callHistoryIdRef.current, 'completed').catch(() => null);
        callHistoryIdRef.current = null;
      }
    },
    [clearOutgoingTimer, sendCallSignal],
  );

  // Wire PiP handlers
  pipHandlersRef.current = {
    onToggleMute: () => {
      if (!callRef.current) return;
      const muted = callRef.current.toggleMute();
      setCallMuted(muted);
      updatePiPActions(muted);
      void sendCallSignal('call-mute', {
        conversationId: conversationIdRef.current,
        userId: userIdRef.current,
        toId: peerIdRef.current,
        muted,
      });
    },
    onHangUp: () => { void endCall(true); },
    onCallKitMute: (isMuted: boolean) => {
      if (!callRef.current) return;
      if (callRef.current.isMuted !== isMuted) {
        callRef.current.toggleMute();
        setCallMuted(isMuted);
        void sendCallSignal('call-mute', {
          conversationId: conversationIdRef.current,
          userId: userIdRef.current,
          toId: peerIdRef.current,
          muted: isMuted,
        });
      }
    },
  };

  // ── Init WebRTC client ──

  const ensureCallClient = useCallback(
    async (mode: CallMode): Promise<DmWebRTCCall | null> => {
      if (!conversationIdRef.current || !userIdRef.current) return null;
      if (Platform.OS === 'web') {
        showAlert('Unsupported', 'Audio/video calling is available on Android and iOS builds.');
        return null;
      }
      if (callRef.current) return callRef.current;
      if (callInitPromiseRef.current) return await callInitPromiseRef.current;

      const initPromise: Promise<DmWebRTCCall | null> = (async () => {
        try {
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
        } catch (err: any) {
          // FIX: Handle getUserMedia / init failures gracefully
          console.warn('[useCallSession] WebRTC init failed:', err);
          showAlert('Call failed', err?.message ?? 'Could not initialize audio/video. Check permissions.');
          return null;
        }
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

  // ── Call actions ──

  const startCall = useCallback(
    async (mode: CallMode) => {
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
        showAlert('Call failed', 'Unable to send call invite.');
        return;
      }

      void notifyIncomingDmCall(conversationId, peerId, selfName, mode).catch(() => null);
      createPendingCall(conversationId, userId, peerId, selfName, mode).catch(() => null);

      // Log call start
      logCallStart(conversationId, userId, peerId, mode)
        .then((id) => { callHistoryIdRef.current = id; })
        .catch(() => null);

      // Outgoing timeout with countdown
      clearOutgoingTimer();
      const timeoutS = OUTGOING_CALL_TIMEOUT_MS / 1000;
      let elapsed = 0;
      countdownIntervalRef.current = setInterval(() => {
        elapsed += 1;
        const remaining = timeoutS - elapsed;
        if (remaining <= COUNTDOWN_START_S) {
          setTimeoutCountdown(remaining);
        }
        if (remaining <= 0) {
          clearOutgoingTimer();
          setOutgoingMode(null);
          showAlert('No answer', `${peerName} did not answer.`);
          if (callHistoryIdRef.current) {
            logCallEnd(callHistoryIdRef.current, 'missed').catch(() => null);
            callHistoryIdRef.current = null;
          }
        }
      }, 1000);
    },
    [conversationId, userId, peerId, selfName, peerName, outgoingMode, callState, sendCallSignal, clearOutgoingTimer],
  );

  /**
   * FIX: Race condition — init WebRTC BEFORE signaling acceptance.
   * OLD: signal accept → then init (could fail after peer thinks we accepted)
   * NEW: init WebRTC → if success → signal accept; if fail → signal decline
   */
  const acceptCall = useCallback(async () => {
    if (!conversationId || !userId || !incomingInvite) return;

    const mode = incomingInvite.mode;
    setActiveCallMode(mode);
    setCameraEnabled(mode === 'video');

    // Step 1: Initialize WebRTC FIRST
    const client = await ensureCallClient(mode);
    if (!client) {
      // WebRTC failed — send decline with reason so peer knows
      await sendCallSignal('dm-call-decline', {
        conversationId,
        fromId: userId,
        toId: incomingInvite.fromId,
        reason: 'init_failed',
      }).catch(() => null);
      showAlert('Call failed', 'Could not initialize audio/video. Check your permissions.');
      setIncomingInvite(null);
      return;
    }

    // Step 2: WebRTC ready — NOW signal acceptance
    const sent = await sendCallSignal('dm-call-accept', {
      conversationId,
      fromId: userId,
      toId: incomingInvite.fromId,
      mode,
    });
    if (!sent) {
      showAlert('Call failed', 'Unable to send call accept signal.');
      await endCall(false);
      return;
    }

    setIncomingInvite(null);

    // Log call start for callee
    logCallStart(conversationId, incomingInvite.fromId, userId, mode)
      .then((id) => { callHistoryIdRef.current = id; })
      .catch(() => null);

    if (pendingCallId) {
      updatePendingCallStatus(pendingCallId, 'accepted').catch(() => null);
      setPendingCallId(null);
    }
  }, [conversationId, userId, incomingInvite, pendingCallId, ensureCallClient, sendCallSignal, endCall]);

  const declineCall = useCallback(async () => {
    if (!conversationId || !userId || !incomingInvite) return;
    await sendCallSignal('dm-call-decline', {
      conversationId,
      fromId: userId,
      fromName: selfName,
      toId: incomingInvite.fromId,
    });
    setIncomingInvite(null);
    if (pendingCallId) {
      updatePendingCallStatus(pendingCallId, 'declined').catch(() => null);
      setPendingCallId(null);
    }
  }, [conversationId, userId, selfName, incomingInvite, pendingCallId, sendCallSignal]);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const muted = callRef.current.toggleMute();
    setCallMuted(muted);
    void sendCallSignal('call-mute', {
      conversationId,
      userId,
      toId: peerId,
      muted,
    });
  }, [conversationId, userId, peerId, sendCallSignal]);

  const toggleCamera = useCallback(() => {
    if (!callRef.current || activeCallMode !== 'video') return;
    const enabled = callRef.current.toggleVideoEnabled();
    setCameraEnabled(enabled);
  }, [activeCallMode]);

  const toggleSpeaker = useCallback(async () => {
    if (callState === 'off') return;
    const next = !speakerOn;
    const ok = await setSpeaker(next);
    if (!ok) {
      showAlert('Audio route', 'Unable to change speaker route on this device.');
      return;
    }
    setSpeakerOn(next);
  }, [callState, speakerOn]);

  // ── Listen for call signals on the broadcast channel ──

  useEffect(() => {
    if (!callChannel || !conversationId || !userId) return;

    const unwrapPayload = async (payload: Record<string, unknown>) => {
      const toId = typeof payload.toId === 'string' ? payload.toId : null;
      if (toId && toId !== userIdRef.current) return null;
      return await decodePayload(payload);
    };

    const subscriptions = [
      callChannel.on('broadcast', { event: 'dm-call-invite' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data || data.fromId === userIdRef.current) return;
          const fromId = typeof data.fromId === 'string' ? data.fromId : null;
          if (!fromId) return;
          setIncomingInvite({
            fromId,
            fromName: typeof data.fromName === 'string' ? data.fromName : 'Player',
            mode: data.mode === 'video' ? 'video' : 'audio',
          });
        })();
      }),

      callChannel.on('broadcast', { event: 'dm-call-accept' }, ({ payload }) => {
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
      }),

      callChannel.on('broadcast', { event: 'dm-call-decline' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data || data.toId !== userIdRef.current) return;
          clearOutgoingTimer();
          setOutgoingMode(null);
          const name = typeof data.fromName === 'string' ? data.fromName : 'Peer';
          showAlert('Call declined', `${name} declined your call.`);
          if (callHistoryIdRef.current) {
            logCallEnd(callHistoryIdRef.current, 'declined').catch(() => null);
            callHistoryIdRef.current = null;
          }
        })();
      }),

      callChannel.on('broadcast', { event: 'call-offer' }, ({ payload }) => {
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
          const pending = pendingIceCandidatesRef.current.splice(0);
          for (const c of pending) await client.handleIceCandidate(c).catch(() => null);
        })();
      }),

      callChannel.on('broadcast', { event: 'call-answer' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data) return;
          if (data.toId && data.toId !== userIdRef.current) return;
          if (!data.answer || !callRef.current) return;
          await callRef.current.handleAnswer(data.answer as { type: 'offer' | 'answer'; sdp: string });
          const pending = pendingIceCandidatesRef.current.splice(0);
          for (const c of pending) await callRef.current?.handleIceCandidate(c).catch(() => null);
        })();
      }),

      callChannel.on('broadcast', { event: 'call-ice' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data) return;
          if (data.toId && data.toId !== userIdRef.current) return;
          if (!data.candidate) return;
          if (!callRef.current) {
            pendingIceCandidatesRef.current.push(data.candidate as Record<string, unknown>);
            return;
          }
          await callRef.current.handleIceCandidate(data.candidate as Record<string, unknown>);
        })();
      }),

      callChannel.on('broadcast', { event: 'call-ended' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data) return;
          if (data.toId && data.toId !== userIdRef.current) return;
          await endCall(false);
        })();
      }),

      callChannel.on('broadcast', { event: 'call-mute' }, ({ payload }) => {
        void (async () => {
          const data = await unwrapPayload((payload ?? {}) as Record<string, unknown>);
          if (!data) return;
          if (data.toId && data.toId !== userIdRef.current) return;
          setOpponentMuted(!!data.muted);
        })();
      }),
    ];

    return () => {
      // Cleanup is handled by the parent channel removal
    };
  }, [callChannel, conversationId, userId, clearOutgoingTimer, decodePayload, ensureCallClient, endCall]);

  // Check for pending calls on mount
  useEffect(() => {
    if (!conversationId || !userId) return;
    const pending = consumePendingIncomingInvite(conversationId);
    if (pending) {
      setIncomingInvite({ fromId: pending.fromId, fromName: pending.fromName, mode: pending.mode });
    } else {
      getPendingCallForCallee(conversationId, userId)
        .then((pc) => {
          if (pc) {
            setPendingCallId(pc.id);
            setIncomingInvite({ fromId: pc.from_id, fromName: pc.from_name, mode: pc.mode });
          }
        })
        .catch(() => null);
    }
  }, [conversationId, userId, consumePendingIncomingInvite]);

  // Register end/mute fns with CallContext
  useEffect(() => {
    registerEndCallFn(() => endCall(true));
    registerToggleMuteFn(() => {
      if (!callRef.current) return;
      const muted = callRef.current.toggleMute();
      setCallMuted(muted);
      updatePiPActions(muted);
    });
    return () => {
      registerEndCallFn(null);
      registerToggleMuteFn(null);
    };
  }, [endCall, registerEndCallFn, registerToggleMuteFn]);

  // Sync call state to CallContext for PiP
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
      isInPiPMode: isInPiP,
    });
  }, [callState, incomingInvite, outgoingMode, callMuted, remoteStreamUrl, localStreamUrl,
    activeCallMode, conversationId, peerId, peerName, peerAvatarUrl, publishCallState, clearCallState, isInPiP]);

  // Native PiP lifecycle
  useEffect(() => {
    if (callState === 'live' && conversationId && peerId) {
      nativeSetCallActive(true, {
        peerName,
        hasVideo: activeCallMode === 'video',
        isMuted: callMuted,
      });
      startForegroundService(peerName);
    } else if (callState === 'off') {
      nativeSetCallActive(false);
      stopForegroundService();
    }
  }, [callState, conversationId, peerId, peerName, activeCallMode, callMuted]);

  // Auto-show overlay on call activity
  useEffect(() => {
    const showOverlay = !!incomingInvite || !!outgoingMode || callState !== 'off';
    if (showOverlay) setCallOverlayMinimized(false);
  }, [incomingInvite, outgoingMode, callState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearOutgoingTimer();
      void endCall(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showCallOverlay = !!incomingInvite || !!outgoingMode || callState !== 'off';
  const callStartDisabled = !peerId || !!outgoingMode || callState !== 'off';

  return {
    callState,
    activeCallMode,
    incomingInvite,
    outgoingMode,
    callMuted,
    cameraEnabled,
    speakerOn,
    opponentMuted,
    localStreamUrl,
    remoteStreamUrl,
    callOverlayMinimized,
    timeoutCountdown,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    setCallOverlayMinimized,
    setIncomingInvite,
    showCallOverlay,
    callStartDisabled,
  };
}
