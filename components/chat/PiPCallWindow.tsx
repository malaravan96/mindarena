import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCall } from '@/contexts/CallContext';
import { useCallDurationTimer } from '@/hooks/useCallDurationTimer';
import { RtcVideoView } from '@/components/chat/RtcVideoView';

export function PiPCallWindow() {
  const { activeCall, endCallFromPiP } = useCall();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const duration = useCallDurationTimer(activeCall?.callState ?? 'off');

  const isOnChatThread = pathname.includes('chat-thread');
  if (!activeCall || isOnChatThread || activeCall.isInPiPMode) return null;

  const { conversationId, peerName, peerAvatarUrl, callState, callMode, callMuted, remoteStreamUrl } = activeCall;

  const isLive = callState === 'live';
  const isVideoCall = callMode === 'video' && !!remoteStreamUrl;

  const handleTap = () => {
    router.push({ pathname: '/chat-thread', params: { conversationId } });
  };

  const handleEndCall = () => {
    endCallFromPiP();
  };

  const tabBarBottom = 8 + 62 + (insets.bottom ?? 0);

  return (
    <View
      style={[
        styles.container,
        {
          bottom: tabBarBottom + 8,
          right: 12,
          ...Platform.select({
            ios: { shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
            android: { elevation: 12 },
          }),
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable onPress={handleTap} style={styles.touchable}>
        {/* Video or avatar preview */}
        {isVideoCall ? (
          <View style={styles.videoContainer}>
            <RtcVideoView
              streamURL={remoteStreamUrl}
              style={styles.video}
              emptyLabel=""
            />
            {/* Peer name overlay on video */}
            <View style={styles.videoNameOverlay}>
              <Text style={styles.videoNameText} numberOfLines={1}>{peerName}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.avatarContainer}>
            {peerAvatarUrl ? (
              <Image source={{ uri: peerAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>
                  {peerName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Info row */}
        <View style={styles.infoRow}>
          <View style={styles.infoText}>
            {!isVideoCall && (
              <Text style={styles.peerName} numberOfLines={1}>{peerName}</Text>
            )}
            <View style={styles.statusRow}>
              {isLive ? (
                <View style={styles.liveDot} />
              ) : null}
              <Text style={[styles.statusText, !isLive && styles.statusTextAmber]}>
                {isLive
                  ? duration
                  : callState === 'connecting'
                    ? 'Connecting...'
                    : 'Reconnecting...'}
              </Text>
            </View>
          </View>

          {/* Mute indicator */}
          {callMuted && (
            <View style={styles.muteIcon}>
              <Ionicons name="mic-off" size={12} color="#ff4d4d" />
            </View>
          )}
        </View>

        {/* End call button */}
        <Pressable
          onPress={handleEndCall}
          hitSlop={8}
          style={styles.endButton}
        >
          <Ionicons name="call" size={14} color="#fff" />
          <Text style={styles.endButtonText}>End</Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 180,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
  },
  touchable: {
    flex: 1,
  },
  videoContainer: {
    width: 180,
    height: 120,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
    position: 'relative',
  },
  video: {
    width: 180,
    height: 120,
  },
  videoNameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  videoNameText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  avatarContainer: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  infoText: {
    flex: 1,
  },
  peerName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  statusText: {
    color: '#22c55e',
    fontSize: 11,
  },
  statusTextAmber: {
    color: '#f59e0b',
  },
  muteIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,77,77,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButton: {
    marginHorizontal: 10,
    marginBottom: 8,
    height: 30,
    backgroundColor: '#ef4444',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  endButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
