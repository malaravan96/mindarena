import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, fontSize, fontWeight } from '@/constants/theme';

type CallMode = 'audio' | 'video';

interface ChatHeaderProps {
  peerName: string;
  peerAvatarUrl: string | null;
  peerIsOnline: boolean;
  peerLastSeen: string | null;
  peerTyping: boolean;
  pinnedCount: number;
  isBlocked: boolean;
  callDisabled: boolean;
  onBack: () => void;
  onStartCall: (mode: CallMode) => void;
  onOverflowPress: () => void;
  onPinnedPress: () => void;
}

function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function ChatHeader({
  peerName,
  peerAvatarUrl,
  peerIsOnline,
  peerLastSeen,
  peerTyping,
  pinnedCount,
  isBlocked,
  callDisabled,
  onBack,
  onStartCall,
  onOverflowPress,
  onPinnedPress,
}: ChatHeaderProps) {
  const { colors } = useTheme();

  const subtitle = peerTyping
    ? 'typing...'
    : peerIsOnline
      ? 'Online'
      : peerLastSeen
        ? `Last seen ${formatLastSeen(peerLastSeen)}`
        : 'Direct message';

  const subtitleColor = peerTyping
    ? colors.primary
    : peerIsOnline
      ? '#22c55e'
      : colors.textSecondary;

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      </Pressable>

      <Pressable style={styles.avatarWrap} onPress={onPinnedPress}>
        {peerAvatarUrl ? (
          <Image source={{ uri: peerAvatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: `${colors.primary}16` }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {peerName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        {peerIsOnline && <View style={[styles.onlineDot, { backgroundColor: '#22c55e' }]} />}
      </Pressable>

      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {peerName}
        </Text>
        <Text style={[styles.subtitle, { color: subtitleColor }]}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.actions}>
        {pinnedCount > 0 && (
          <Pressable
            onPress={onPinnedPress}
            style={[styles.actionBtn, { backgroundColor: `${colors.warning}14` }]}
          >
            <Ionicons name="pin" size={14} color={colors.warning} />
            <Text style={[styles.pinnedBadge, { color: colors.warning }]}>{pinnedCount}</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => onStartCall('audio')}
          disabled={callDisabled || isBlocked}
          style={[
            styles.actionBtn,
            {
              opacity: callDisabled || isBlocked ? 0.45 : 1,
              backgroundColor: `${colors.primary}14`,
            },
          ]}
        >
          <Ionicons name="call-outline" size={18} color={colors.primary} />
        </Pressable>

        <Pressable
          onPress={() => onStartCall('video')}
          disabled={callDisabled || isBlocked}
          style={[
            styles.actionBtn,
            {
              opacity: callDisabled || isBlocked ? 0.45 : 1,
              backgroundColor: `${colors.secondary}14`,
            },
          ]}
        >
          <Ionicons name="videocam-outline" size={18} color={colors.secondary} />
        </Pressable>

        <Pressable
          onPress={onOverflowPress}
          style={[styles.actionBtn, { backgroundColor: `${colors.primary}10` }]}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: { position: 'relative' },
  avatarImage: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  titleWrap: { flex: 1 },
  title: { fontSize: 16, fontWeight: fontWeight.bold },
  subtitle: { fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.xs },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  pinnedBadge: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
});
