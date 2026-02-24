import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { CallUiState } from '@/lib/types';
import { useCallDurationTimer } from '@/hooks/useCallDurationTimer';
import { CallControlButton } from '@/components/chat/CallControlButton';
import { PulsingAvatar } from '@/components/chat/PulsingAvatar';
import { RtcVideoView } from '@/components/chat/RtcVideoView';

type CallMode = 'audio' | 'video';
type IncomingInvite = { fromId: string; fromName: string; mode: CallMode };

type Props = {
  visible: boolean;
  onMinimize: () => void;

  // Call state
  callState: CallUiState;
  activeCallMode: CallMode;
  incomingInvite: IncomingInvite | null;
  outgoingMode: CallMode | null;

  // Peer info
  peerName: string;
  peerAvatarUrl: string | null;

  // Media state
  callMuted: boolean;
  cameraEnabled: boolean;
  speakerOn: boolean;
  opponentMuted: boolean;
  localStreamUrl: string | null;
  remoteStreamUrl: string | null;

  // Actions
  onAccept: () => void;
  onDecline: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
};

const BG_COLOR = '#1a1a2e';

export function FullScreenCallOverlay({
  visible,
  onMinimize,
  callState,
  activeCallMode,
  incomingInvite,
  outgoingMode,
  peerName,
  peerAvatarUrl,
  callMuted,
  cameraEnabled,
  speakerOn,
  opponentMuted,
  localStreamUrl,
  remoteStreamUrl,
  onAccept,
  onDecline,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
}: Props) {
  const insets = useSafeAreaInsets();
  const duration = useCallDurationTimer(callState);

  const isIncoming = !!incomingInvite;
  const isOutgoing = !!outgoingMode && callState === 'off';
  const isConnecting = callState === 'connecting';
  const isLive = callState === 'live';
  const isReconnecting = callState === 'reconnecting';
  const isVideoLive = isLive && activeCallMode === 'video';
  const isAudioLive = isLive && activeCallMode === 'audio';
  const showVideoBackground =
    activeCallMode === 'video' && (isLive || isConnecting || isReconnecting);

  const displayName = isIncoming ? incomingInvite!.fromName : peerName;
  const displayMode = isIncoming ? incomingInvite!.mode : (outgoingMode ?? activeCallMode);

  const statusText = isIncoming
    ? `${displayMode === 'video' ? 'Video' : 'Audio'} Call`
    : isOutgoing
      ? 'Calling...'
      : isConnecting
        ? 'Connecting...'
        : isReconnecting
          ? 'Reconnecting...'
          : isLive
            ? duration
            : '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onMinimize}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
      <View style={[styles.root, { backgroundColor: BG_COLOR }]}>
        {/* ── Video background ── */}
        {showVideoBackground && (
          <View style={StyleSheet.absoluteFill}>
            <RtcVideoView
              streamURL={remoteStreamUrl}
              style={StyleSheet.absoluteFill}
              emptyLabel=""
            />
            {/* Gradient overlay for controls readability */}
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.7)']}
              locations={[0, 0.25, 0.6, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        )}

        {/* ── Top bar ── */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onMinimize} style={styles.minimizeBtn}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </Pressable>
          {opponentMuted && (isLive || isReconnecting) && (
            <View style={styles.peerMutedBadge}>
              <Ionicons name="mic-off" size={14} color="#fbbf24" />
              <Text style={styles.peerMutedText}>Peer muted</Text>
            </View>
          )}
        </View>

        {/* ── Center content ── */}
        <View style={styles.center}>
          {!showVideoBackground && (
            <>
              {(isIncoming || isOutgoing) ? (
                <PulsingAvatar
                  avatarUrl={peerAvatarUrl}
                  name={displayName}
                  size={120}
                />
              ) : (
                <PulsingAvatar
                  avatarUrl={peerAvatarUrl}
                  name={displayName}
                  size={100}
                />
              )}
              <Text style={styles.peerNameText}>{displayName}</Text>
              <Text style={styles.statusText}>{statusText}</Text>
              {isConnecting && (
                <ActivityIndicator color="#fff" size="small" style={{ marginTop: 8 }} />
              )}
            </>
          )}

          {showVideoBackground && (
            <>
              <Text style={styles.peerNameText}>{displayName}</Text>
              <Text style={styles.statusText}>{statusText}</Text>
            </>
          )}
        </View>

        {/* ── Local PIP (video mode) ── */}
        {showVideoBackground && (
          <View style={[styles.pip, { top: insets.top + 56 }]}>
            <RtcVideoView
              streamURL={localStreamUrl}
              style={styles.pipVideo}
              mirror
              emptyLabel={cameraEnabled ? '' : 'Cam off'}
            />
          </View>
        )}

        {/* ── Controls ── */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
          {isIncoming && (
            <View style={styles.incomingRow}>
              <CallControlButton
                icon="close"
                label="Decline"
                backgroundColor="#e74c3c"
                onPress={onDecline}
                size={64}
              />
              <CallControlButton
                icon="call"
                label="Accept"
                backgroundColor="#2ecc71"
                onPress={onAccept}
                size={64}
              />
            </View>
          )}

          {isOutgoing && (
            <View style={styles.controlRow}>
              <CallControlButton
                icon="call"
                label="End"
                backgroundColor="#e74c3c"
                onPress={onEndCall}
                size={64}
              />
            </View>
          )}

          {(isLive || isConnecting || isReconnecting) && (
            <View style={styles.controlRow}>
              <CallControlButton
                icon={callMuted ? 'mic-off' : 'mic'}
                label={callMuted ? 'Unmute' : 'Mute'}
                onPress={onToggleMute}
                active={callMuted}
              />
              {activeCallMode === 'video' && (
                <CallControlButton
                  icon={cameraEnabled ? 'videocam' : 'videocam-off'}
                  label={cameraEnabled ? 'Camera' : 'Cam Off'}
                  onPress={onToggleCamera}
                  active={!cameraEnabled}
                />
              )}
              <CallControlButton
                icon={speakerOn ? 'volume-high' : 'volume-mute'}
                label={speakerOn ? 'Speaker' : 'Speaker'}
                onPress={onToggleSpeaker}
                active={speakerOn}
              />
              <CallControlButton
                icon="call"
                label="End"
                backgroundColor="#e74c3c"
                onPress={onEndCall}
                size={56}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  minimizeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerMutedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    backgroundColor: 'rgba(251,191,36,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  peerMutedText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  peerNameText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '500',
  },
  pip: {
    position: 'absolute',
    right: 16,
    width: 120,
    height: 170,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: '#000',
    zIndex: 10,
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },
  controls: {
    paddingHorizontal: 24,
  },
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
});
