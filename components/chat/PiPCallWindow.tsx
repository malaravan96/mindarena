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
  if (!activeCall || isOnChatThread) return null;

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
            <Text style={styles.peerName} numberOfLines={1}>{peerName}</Text>
            <View style={styles.statusRow}>
              {isLive ? (
                <View style={styles.liveDot} />
              ) : null}
              <Text style={[styles.statusText, !isLive && styles.statusTextAmber]}>
                {isLive ? duration : callState === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
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
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 160,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
  },
  touchable: {
    flex: 1,
  },
  videoContainer: {
    width: 160,
    height: 90,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  video: {
    width: 160,
    height: 90,
  },
  avatarContainer: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 18,
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
    height: 28,
    backgroundColor: '#ef4444',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
});
