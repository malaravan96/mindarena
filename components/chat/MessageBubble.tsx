import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import type { DmMessage, DmMessageStatus } from '@/lib/types';

interface MessageBubbleProps {
  item: DmMessage;
  isOwn: boolean;
  onImagePress?: (url: string) => void;
  onVoicePress?: (url: string, messageId: string) => void;
  playingVoiceId?: string | null;
}

function StatusIcon({ status }: { status?: DmMessageStatus }) {
  const { colors } = useTheme();
  if (!status || status === 'sent') {
    return <Ionicons name="checkmark" size={12} color={colors.textTertiary} />;
  }
  if (status === 'delivered') {
    return (
      <View style={{ flexDirection: 'row' }}>
        <Ionicons name="checkmark" size={12} color={colors.textTertiary} />
        <Ionicons name="checkmark" size={12} color={colors.textTertiary} style={{ marginLeft: -6 }} />
      </View>
    );
  }
  // seen
  return (
    <View style={{ flexDirection: 'row' }}>
      <Ionicons name="checkmark" size={12} color={colors.primary} />
      <Ionicons name="checkmark" size={12} color={colors.primary} style={{ marginLeft: -6 }} />
    </View>
  );
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(secs?: number | null): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MessageBubble({ item, isOwn, onImagePress, onVoicePress, playingVoiceId }: MessageBubbleProps) {
  const { colors } = useTheme();
  const msgType = item.message_type ?? 'text';
  const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bubbleBg = isOwn ? `${colors.primary}16` : colors.surfaceVariant;
  const bubbleBorder = isOwn ? `${colors.primary}35` : colors.border;

  const renderContent = () => {
    if (msgType === 'image' && item.attachment_url) {
      return (
        <Pressable onPress={() => onImagePress?.(item.attachment_url!)}>
          <Image
            source={{ uri: item.attachment_url }}
            style={styles.imageThumbnail}
            resizeMode="cover"
          />
          {item.body ? (
            <Text style={[styles.msgBody, { color: colors.text, marginTop: spacing.xs }]}>{item.body}</Text>
          ) : null}
        </Pressable>
      );
    }

    if (msgType === 'voice' && item.attachment_url) {
      const isPlaying = playingVoiceId === item.id;
      return (
        <Pressable
          style={styles.voiceRow}
          onPress={() => onVoicePress?.(item.attachment_url!, item.id)}
        >
          <View style={[styles.voiceIconWrap, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={18}
              color={colors.primary}
            />
          </View>
          <View>
            <Text style={[styles.voiceLabel, { color: colors.text }]}>Voice message</Text>
            {item.attachment_duration ? (
              <Text style={[styles.voiceDuration, { color: colors.textSecondary }]}>
                {formatDuration(item.attachment_duration)}
              </Text>
            ) : null}
          </View>
        </Pressable>
      );
    }

    if (msgType === 'video' && item.attachment_url) {
      return (
        <Pressable
          style={styles.videoThumb}
          onPress={() => onImagePress?.(item.attachment_url!)}
        >
          <View style={[styles.videoOverlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
            <Ionicons name="play-circle" size={36} color="#fff" />
          </View>
          {item.body ? (
            <Text style={[styles.msgBody, { color: colors.text, marginTop: spacing.xs }]}>{item.body}</Text>
          ) : null}
        </Pressable>
      );
    }

    if (msgType === 'file' && item.attachment_url) {
      const filename = item.body || 'File';
      return (
        <Pressable
          style={styles.fileRow}
          onPress={() => Linking.openURL(item.attachment_url!).catch(() => null)}
        >
          <View style={[styles.fileIcon, { backgroundColor: `${colors.secondary}20` }]}>
            <Ionicons name="document-outline" size={20} color={colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={2}>{filename}</Text>
            {item.attachment_size ? (
              <Text style={[styles.fileSize, { color: colors.textSecondary }]}>
                {formatBytes(item.attachment_size)}
              </Text>
            ) : null}
          </View>
          <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
        </Pressable>
      );
    }

    // Default: text
    return (
      <Text style={[styles.msgBody, { color: colors.text }]}>{item.body}</Text>
    );
  };

  return (
    <View style={[styles.msgRow, { alignItems: isOwn ? 'flex-end' : 'flex-start' }]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleBg,
            borderColor: bubbleBorder,
          },
        ]}
      >
        {renderContent()}
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.msgTime, { color: colors.textTertiary }]}>{timeStr}</Text>
        {isOwn && <StatusIcon status={item.status} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  msgRow: { gap: 4 },
  bubble: {
    maxWidth: '84%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  msgBody: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  msgTime: { fontSize: fontSize.xs },
  imageThumbnail: { width: 200, height: 150, borderRadius: borderRadius.md },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  voiceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  voiceDuration: { fontSize: fontSize.xs, marginTop: 2 },
  videoThumb: {
    width: 200,
    height: 150,
    borderRadius: borderRadius.md,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  fileSize: { fontSize: fontSize.xs, marginTop: 2 },
});
