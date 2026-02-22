import { Platform } from 'react-native';
import type { CallUiState } from '@/lib/types';

type AnyCandidate = Record<string, unknown>;
type AnySessionDescription = { type: 'offer' | 'answer'; sdp: string };
type AnyMediaStream = any;

type WebRTCModule = {
  registerGlobals?: () => void;
  RTCPeerConnection: new (config: { iceServers: { urls: string; username?: string; credential?: string }[] }) => any;
  RTCSessionDescription: new (description: AnySessionDescription) => AnySessionDescription;
  RTCIceCandidate: new (candidate: AnyCandidate) => AnyCandidate;
  mediaDevices: {
    getUserMedia: (constraints: { audio: boolean; video: boolean }) => Promise<any>;
  };
};

let cachedModule: WebRTCModule | null = null;
let globalsRegistered = false;

function getWebRTCModule() {
  if (Platform.OS === 'web') {
    throw new Error('WebRTC voice call is not supported on web');
  }
  if (!cachedModule) {
    cachedModule = require('react-native-webrtc') as WebRTCModule;
    if (!globalsRegistered && cachedModule.registerGlobals) {
      cachedModule.registerGlobals();
      globalsRegistered = true;
    }
  }
  return cachedModule;
}

type CallSignalSender = (event: 'call-offer' | 'call-answer' | 'call-ice' | 'call-state' | 'call-ended' | 'call-mute', payload: Record<string, unknown>) => void;

type WebRTCCallCallbacks = {
  onStateChange: (state: CallUiState) => void;
  onError?: (message: string) => void;
};

type WebRTCCallOptions = {
  matchId: string;
  userId: string;
  sendSignal: CallSignalSender;
  iceServers: { urls: string; username?: string; credential?: string }[];
  callbacks: WebRTCCallCallbacks;
};

type DmMediaMode = 'audio' | 'video';

type DmCallSignalSender = (
  event: 'call-offer' | 'call-answer' | 'call-ice' | 'call-state' | 'call-ended' | 'call-mute',
  payload: Record<string, unknown>,
) => void;

type DmWebRTCCallCallbacks = {
  onStateChange: (state: CallUiState) => void;
  onLocalStream?: (stream: AnyMediaStream | null) => void;
  onRemoteStream?: (stream: AnyMediaStream | null) => void;
  onError?: (message: string) => void;
};

type DmWebRTCCallOptions = {
  conversationId: string;
  userId: string;
  mediaMode: DmMediaMode;
  sendSignal: DmCallSignalSender;
  iceServers: { urls: string; username?: string; credential?: string }[];
  callbacks: DmWebRTCCallCallbacks;
};

const RECONNECT_TIMEOUT_MS = 15_000;

export class PvpWebRTCCall {
  private readonly options: WebRTCCallOptions;
  private pc: any = null;
  private localStream: any = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private muted = false;
  private closed = false;

  constructor(options: WebRTCCallOptions) {
    this.options = options;
  }

  get isMuted() {
    return this.muted;
  }

  async init() {
    if (this.closed || this.pc) return;
    const WebRTC = getWebRTCModule();

    this.localStream = await WebRTC.mediaDevices.getUserMedia({ audio: true, video: false });
    this.pc = new WebRTC.RTCPeerConnection({ iceServers: this.options.iceServers });

    this.localStream.getTracks().forEach((track: any) => {
      this.pc.addTrack(track, this.localStream);
    });

    this.pc.onicecandidate = (event: { candidate: AnyCandidate | null }) => {
      if (!event.candidate) return;
      this.options.sendSignal('call-ice', {
        matchId: this.options.matchId,
        playerId: this.options.userId,
        candidate: event.candidate,
      });
    };

    const handleConnectionChange = () => {
      const state = this.pc?.connectionState || this.pc?.iceConnectionState;
      if (state === 'connected') {
        this.clearReconnectTimer();
        this.emitState('live');
        return;
      }
      if (state === 'disconnected' || state === 'failed') {
        this.startReconnectWindow();
        return;
      }
      if (state === 'closed') {
        this.emitState('off');
      }
    };

    this.pc.onconnectionstatechange = handleConnectionChange;
    this.pc.oniceconnectionstatechange = handleConnectionChange;
  }

  async startAsCaller() {
    if (this.closed) return;
    await this.init();
    if (!this.pc) return;

    this.emitState('connecting');
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true });
    await this.pc.setLocalDescription(offer);

    this.options.sendSignal('call-offer', {
      matchId: this.options.matchId,
      playerId: this.options.userId,
      offer,
    });
  }

  async handleOffer(offer: AnySessionDescription) {
    if (this.closed) return;
    await this.init();
    if (!this.pc) return;

    const WebRTC = getWebRTCModule();
    this.emitState('connecting');
    await this.pc.setRemoteDescription(new WebRTC.RTCSessionDescription(offer));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.options.sendSignal('call-answer', {
      matchId: this.options.matchId,
      playerId: this.options.userId,
      answer,
    });
  }

  async handleAnswer(answer: AnySessionDescription) {
    if (this.closed || !this.pc) return;
    const WebRTC = getWebRTCModule();
    await this.pc.setRemoteDescription(new WebRTC.RTCSessionDescription(answer));
  }

  async handleIceCandidate(candidate: AnyCandidate) {
    if (this.closed || !this.pc) return;
    try {
      const WebRTC = getWebRTCModule();
      await this.pc.addIceCandidate(new WebRTC.RTCIceCandidate(candidate));
    } catch {
      // Some ICE candidates may arrive before remote description is fully set.
    }
  }

  toggleMute() {
    if (!this.localStream) return this.muted;
    const tracks = this.localStream.getAudioTracks?.() ?? [];
    this.muted = !this.muted;
    tracks.forEach((track: { enabled: boolean }) => {
      track.enabled = !this.muted;
    });
    return this.muted;
  }

  async close(sendEndedSignal: boolean, finalState: 'off' | 'failed' = 'off') {
    if (this.closed) return;
    this.closed = true;
    this.clearReconnectTimer();

    if (sendEndedSignal) {
      this.options.sendSignal('call-ended', {
        matchId: this.options.matchId,
        playerId: this.options.userId,
      });
    }

    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }

    if (this.localStream) {
      try {
        this.localStream.getTracks?.().forEach((track: { stop: () => void }) => track.stop());
      } catch {
        // ignore
      }
      this.localStream = null;
    }

    this.emitState(finalState === 'failed' ? 'off' : finalState);
  }

  private emitState(state: CallUiState) {
    this.options.callbacks.onStateChange(state);
  }

  private startReconnectWindow() {
    if (this.reconnectTimer || this.closed) return;
    this.emitState('reconnecting');
    this.options.sendSignal('call-state', {
      matchId: this.options.matchId,
      playerId: this.options.userId,
      state: 'reconnecting',
    });

    try {
      this.pc?.restartIce?.();
    } catch {
      // ignore restart errors and rely on timeout fallback.
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.options.callbacks.onError?.('Voice reconnect timeout');
      this.close(false, 'failed').catch(() => null);
    }, RECONNECT_TIMEOUT_MS);
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}

export class DmWebRTCCall {
  private readonly options: DmWebRTCCallOptions;
  private pc: any = null;
  private localStream: any = null;
  private remoteStream: any = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private muted = false;
  private closed = false;
  private videoEnabled = true;

  constructor(options: DmWebRTCCallOptions) {
    this.options = options;
    this.videoEnabled = options.mediaMode === 'video';
  }

  get isMuted() {
    return this.muted;
  }

  get hasVideo() {
    return this.options.mediaMode === 'video';
  }

  async init() {
    if (this.closed || this.pc) return;
    const WebRTC = getWebRTCModule();

    this.remoteStream = null;
    this.localStream = await WebRTC.mediaDevices.getUserMedia({
      audio: true,
      video: this.options.mediaMode === 'video',
    });
    this.options.callbacks.onLocalStream?.(this.localStream);
    this.pc = new WebRTC.RTCPeerConnection({ iceServers: this.options.iceServers });

    this.localStream.getTracks().forEach((track: any) => {
      this.pc.addTrack(track, this.localStream);
    });

    this.pc.onicecandidate = (event: { candidate: AnyCandidate | null }) => {
      if (!event.candidate) return;
      this.options.sendSignal('call-ice', {
        conversationId: this.options.conversationId,
        userId: this.options.userId,
        candidate: event.candidate,
      });
    };

    this.pc.ontrack = (event: { streams?: AnyMediaStream[]; track?: any }) => {
      const nextStream = event.streams?.[0];
      if (nextStream && this.remoteStream?.id !== nextStream.id) {
        this.remoteStream = nextStream;
        this.options.callbacks.onRemoteStream?.(nextStream);
      }

      if (event.track) {
        event.track.onended = () => {
          const tracks = this.remoteStream?.getTracks?.() ?? [];
          const hasActive = tracks.some((track: { readyState?: string }) => track.readyState !== 'ended');
          if (!hasActive) {
            this.remoteStream = null;
            this.options.callbacks.onRemoteStream?.(null);
          }
        };
      }
    };

    const handleConnectionChange = () => {
      const state = this.pc?.connectionState || this.pc?.iceConnectionState;
      if (state === 'connected') {
        this.clearReconnectTimer();
        this.emitState('live');
        return;
      }
      if (state === 'disconnected' || state === 'failed') {
        this.startReconnectWindow();
        return;
      }
      if (state === 'closed') {
        this.emitState('off');
      }
    };

    this.pc.onconnectionstatechange = handleConnectionChange;
    this.pc.oniceconnectionstatechange = handleConnectionChange;
  }

  async startAsCaller() {
    if (this.closed) return;
    await this.init();
    if (!this.pc) return;

    this.emitState('connecting');
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.options.mediaMode === 'video',
    });
    await this.pc.setLocalDescription(offer);

    this.options.sendSignal('call-offer', {
      conversationId: this.options.conversationId,
      userId: this.options.userId,
      offer,
      mediaMode: this.options.mediaMode,
    });
  }

  async handleOffer(offer: AnySessionDescription) {
    if (this.closed) return;
    await this.init();
    if (!this.pc) return;

    const WebRTC = getWebRTCModule();
    this.emitState('connecting');
    await this.pc.setRemoteDescription(new WebRTC.RTCSessionDescription(offer));

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.options.sendSignal('call-answer', {
      conversationId: this.options.conversationId,
      userId: this.options.userId,
      answer,
    });
  }

  async handleAnswer(answer: AnySessionDescription) {
    if (this.closed || !this.pc) return;
    const WebRTC = getWebRTCModule();
    await this.pc.setRemoteDescription(new WebRTC.RTCSessionDescription(answer));
  }

  async handleIceCandidate(candidate: AnyCandidate) {
    if (this.closed || !this.pc) return;
    try {
      const WebRTC = getWebRTCModule();
      await this.pc.addIceCandidate(new WebRTC.RTCIceCandidate(candidate));
    } catch {
      // Some ICE candidates may arrive before remote description is fully set.
    }
  }

  toggleMute() {
    if (!this.localStream) return this.muted;
    const tracks = this.localStream.getAudioTracks?.() ?? [];
    this.muted = !this.muted;
    tracks.forEach((track: { enabled: boolean }) => {
      track.enabled = !this.muted;
    });
    return this.muted;
  }

  toggleVideoEnabled() {
    if (!this.localStream || this.options.mediaMode !== 'video') return this.videoEnabled;
    const tracks = this.localStream.getVideoTracks?.() ?? [];
    this.videoEnabled = !this.videoEnabled;
    tracks.forEach((track: { enabled: boolean }) => {
      track.enabled = this.videoEnabled;
    });
    return this.videoEnabled;
  }

  async close(sendEndedSignal: boolean, finalState: 'off' | 'failed' = 'off') {
    if (this.closed) return;
    this.closed = true;
    this.clearReconnectTimer();

    if (sendEndedSignal) {
      this.options.sendSignal('call-ended', {
        conversationId: this.options.conversationId,
        userId: this.options.userId,
      });
    }

    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }

    if (this.localStream) {
      try {
        this.localStream.getTracks?.().forEach((track: { stop: () => void }) => track.stop());
      } catch {
        // ignore
      }
      this.localStream = null;
    }

    this.remoteStream = null;
    this.options.callbacks.onLocalStream?.(null);
    this.options.callbacks.onRemoteStream?.(null);

    this.emitState(finalState === 'failed' ? 'off' : finalState);
  }

  private emitState(state: CallUiState) {
    this.options.callbacks.onStateChange(state);
  }

  private startReconnectWindow() {
    if (this.reconnectTimer || this.closed) return;
    this.emitState('reconnecting');
    this.options.sendSignal('call-state', {
      conversationId: this.options.conversationId,
      userId: this.options.userId,
      state: 'reconnecting',
    });

    try {
      this.pc?.restartIce?.();
    } catch {
      // ignore restart errors and rely on timeout fallback.
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.options.callbacks.onError?.('Call reconnect timeout');
      this.close(false, 'failed').catch(() => null);
    }, RECONNECT_TIMEOUT_MS);
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
}
