import React from 'react';
import { Image, Modal, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalNotifications } from '@/contexts/GlobalNotificationsContext';

const BG_COLOR = '#1a1a2e';

export function GlobalIncomingCallOverlay() {
  const { incomingCall, acceptIncomingCall, declineIncomingCall } = useGlobalNotifications();
  const insets = useSafeAreaInsets();

  if (!incomingCall) return null;

  const { fromName, fromAvatarUrl, mode } = incomingCall;
  const initials = fromName.slice(0, 2).toUpperCase();
  const modeLabel = mode === 'video' ? 'Incoming Video Call' : 'Incoming Audio Call';

  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
      <View style={[styles.root, { backgroundColor: BG_COLOR }]}>
        {/* Top spacer */}
        <View style={{ height: insets.top + 24 }} />

        {/* Center content */}
        <View style={styles.center}>
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
            <Pressable onPress={declineIncomingCall} style={[styles.btn, styles.declineBtn]}>
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.btnLabel}>Decline</Text>
            </Pressable>

            {/* Accept */}
            <Pressable onPress={acceptIncomingCall} style={[styles.btn, styles.acceptBtn]}>
              <Ionicons name="call" size={28} color="#fff" />
              <Text style={styles.btnLabel}>Accept</Text>
            </Pressable>
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
  btn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  btnLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    position: 'absolute',
    bottom: -24,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  declineBtn: {
    backgroundColor: '#e74c3c',
  },
  acceptBtn: {
    backgroundColor: '#2ecc71',
  },
});
