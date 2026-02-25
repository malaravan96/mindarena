import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalNotifications } from '@/contexts/GlobalNotificationsContext';

export function GlobalMessageToastBanner() {
  const { messageToast, dismissMessageToast } = useGlobalNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const prevToastRef = useRef(messageToast);

  useEffect(() => {
    const prev = prevToastRef.current;
    prevToastRef.current = messageToast;

    if (messageToast && !prev) {
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else if (!messageToast && prev) {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [messageToast, slideAnim]);

  if (!messageToast) return null;

  const { conversationId, senderName, senderAvatarUrl, preview } = messageToast;
  const initials = senderName.slice(0, 2).toUpperCase();
  const topOffset = insets.top + 8;

  const handlePress = () => {
    dismissMessageToast();
    router.push({ pathname: '/chat-thread', params: { conversationId } });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { top: topOffset, transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="box-none"
    >
      <Pressable onPress={handlePress} style={styles.inner}>
        {/* Avatar */}
        {senderAvatarUrl ? (
          <Image source={{ uri: senderAvatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}

        {/* Text */}
        <View style={styles.textWrap}>
          <Text style={styles.senderName} numberOfLines={1}>
            {senderName}
          </Text>
          <Text style={styles.preview} numberOfLines={1}>
            {preview}
          </Text>
        </View>

        {/* Close */}
        <Pressable onPress={dismissMessageToast} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(20,20,35,0.95)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  senderName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  preview: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '400',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
