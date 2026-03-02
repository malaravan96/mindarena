import React, { useEffect, useRef } from 'react';
import { Image, Modal, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalNotifications } from '@/contexts/GlobalNotificationsContext';

const BG_COLOR = '#1a1a2e';
const AUTO_DISMISS_MS = 60_000; // 60s

export function GlobalIncomingCallOverlay() {
  const { incomingCall, acceptIncomingCall, declineIncomingCall } = useGlobalNotifications();
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss after 60 seconds
  useEffect(() => {
    if (incomingCall) {
      timerRef.current = setTimeout(() => {
        declineIncomingCall();
      }, AUTO_DISMISS_MS);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [incomingCall, declineIncomingCall]);

  if (!incomingCall) return null;

  const { fromName, fromAvatarUrl, mode } = incomingCall;
  const initials = fromName.slice(0, 2).toUpperCase();
  const isVideo = mode === 'video';
  const modeLabel = isVideo ? 'Video Call' : 'Audio Call';

  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
      <View style={[styles.root, { backgroundColor: BG_COLOR }]}>
        <View style={{ height: insets.top + 24 }} />

        {/* Center content */}
        <View style={styles.center}>
          {/* Call mode icon */}
          <View style={styles.modeIconWrap}>
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={28}
              color="#fff"
            />
          </View>

          {/* Avatar */}
          {fromAvatarUrl ? (
            <Image source={{ uri: fromAvatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}

          <Text style={styles.callerName}>{fromName}</Text>
          <Text style={styles.callMode}>{modeLabel}</Text>
        </View>

        {/* Controls */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + 40 }]}>
          <View style={styles.buttonRow}>
            {/* Decline */}
            <View style={styles.buttonWrap}>
              <Pressable onPress={declineIncomingCall} style={[styles.btn, styles.declineBtn]}>
                <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
              <Text style={styles.btnLabel}>Decline</Text>
            </View>

            {/* Accept */}
            <View style={styles.buttonWrap}>
              <Pressable onPress={acceptIncomingCall} style={[styles.btn, styles.acceptBtn]}>
                <Ionicons name={isVideo ? 'videocam' : 'call'} size={28} color="#fff" />
              </Pressable>
              <Text style={styles.btnLabel}>Accept</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  modeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
  },
  callerName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  callMode: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 16,
    fontWeight: '500',
  },
  controls: {
    paddingHorizontal: 40,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  buttonWrap: {
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  declineBtn: {
    backgroundColor: '#e74c3c',
  },
  acceptBtn: {
    backgroundColor: '#2ecc71',
  },
});
