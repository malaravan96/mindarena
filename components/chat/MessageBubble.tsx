import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Image, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import type { DmMessage, DmMessageStatus, DmReactionGroup } from '@/lib/types';
import { PollBubble } from '@/components/chat/PollBubble';

interface MessageBubbleProps {
  item: DmMessage;
  isOwn: boolean;
  onImagePress?: (url: string) => void;
  onVoicePress?: (url: string, messageId: string) => void;
  playingVoiceId?: string | null;
  reactions?: DmReactionGroup[];
  onReactionPress?: (emoji: string) => void;
  onLongPress?: () => void;
  replyTo?: DmMessage | null;
  onReplyQuotePress?: () => void;
  onSwipeReply?: () => void;
  peerName?: string;
  currentUserId?: string;
  isPinned?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onForward?: () => void;
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

function getReplyPreview(msg: DmMessage): string {
  const type = msg.message_type ?? 'text';
  if (type === 'image') return '[image]';
  if (type === 'voice') return '[voice message]';
  if (type === 'video') return '[video]';
  if (type === 'file') return '[file]';
  return msg.body || '';
}

interface ReplyQuoteBoxProps {
  replyTo: DmMessage;
  senderName: string;
  onPress?: () => void;
  primaryColor: string;
  textColor: string;
  surfaceColor: string;
}

function ReplyQuoteBox({ replyTo, senderName, onPress, primaryColor, textColor, surfaceColor }: ReplyQuoteBoxProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.replyQuoteBox, { borderLeftColor: primaryColor, backgroundColor: surfaceColor }]}
    >
      <Text style={[styles.replyQuoteName, { color: primaryColor }]} numberOfLines={1}>
        {senderName}
      </Text>
      <Text style={[styles.replyQuoteBody, { color: textColor }]} numberOfLines={2}>
        {getReplyPreview(replyTo)}
      </Text>
    </Pressable>
  );
}

interface ReactionPillsRowProps {
  reactions: DmReactionGroup[];
  onReactionPress?: (emoji: string) => void;
  isOwn: boolean;
  primaryColor: string;
  surfaceColor: string;
  borderColor: string;
  textColor: string;
}

function ReactionPillsRow({ reactions, onReactionPress, isOwn, primaryColor, surfaceColor, borderColor, textColor }: ReactionPillsRowProps) {
  return (
    <View style={[styles.reactionRow, { justifyContent: isOwn ? 'flex-end' : 'flex-start' }]}>
      {reactions.map((group) => (
        <Pressable
          key={group.emoji}
          onPress={() => onReactionPress?.(group.emoji)}
          style={[
            styles.reactionPill,
            {
              backgroundColor: group.reactedByMe ? `${primaryColor}18` : surfaceColor,
              borderColor: group.reactedByMe ? primaryColor : borderColor,
            },
          ]}
        >
          <Text style={styles.reactionEmoji}>{group.emoji}</Text>
          {group.count > 1 && (
            <Text style={[styles.reactionCount, { color: group.reactedByMe ? primaryColor : textColor }]}>
              {group.count}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export function MessageBubble({
  item,
  isOwn,
  onImagePress,
  onVoicePress,
  playingVoiceId,
  reactions,
  onReactionPress,
  onLongPress,
  replyTo,
  onReplyQuotePress,
  onSwipeReply,
  peerName,
  currentUserId,
  isPinned,
}: MessageBubbleProps) {
  const { colors } = useTheme();
  const msgType = item.message_type ?? 'text';
  const isDeleted = item.is_deleted === true;
  const isEdited = !isDeleted && !!item.edited_at;
  const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const bubbleBg = isOwn ? `${colors.primary}16` : colors.surfaceVariant;
  const bubbleBorder = isOwn ? `${colors.primary}35` : colors.border;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 12 && Math.abs(g.dy) < 20,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 50) onSwipeReply?.();
      },
    }),
  ).current;

  const replyQuoteSenderName = replyTo
    ? replyTo.sender_id === currentUserId
      ? 'You'
      : peerName ?? 'Peer'
    : '';

  const renderContent = () => {
    if (isDeleted) {
      return (
        <Text style={[styles.deletedText, { color: colors.textSecondary }]}>
          This message was deleted
        </Text>
      );
    }

    if (msgType === 'poll') {
      let pollId: string | null = null;
      try { pollId = JSON.parse(item.body)?.poll_id ?? null; } catch { /* ignore */ }
      if (pollId) {
        return <PollBubble pollId={pollId} currentUserId={currentUserId ?? null} />;
      }
      return <Text style={[styles.msgBody, { color: colors.textSecondary, fontStyle: 'italic' }]}>Poll unavailable</Text>;
    }

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
      <View>
        <Text style={[styles.msgBody, { color: colors.text }]}>{item.body}</Text>
        {isEdited && (
          <Text style={[styles.editedLabel, { color: colors.textTertiary }]}>(edited)</Text>
        )}
      </View>
    );
  };

  const hasReactions = !isDeleted && reactions && reactions.length > 0;

  return (
    <View {...panResponder.panHandlers} style={[styles.msgRow, { alignItems: isOwn ? 'flex-end' : 'flex-start' }]}>
      <Pressable onLongPress={!isDeleted ? onLongPress : undefined} delayLongPress={350}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isDeleted ? `${colors.textTertiary}10` : bubbleBg,
              borderColor: isDeleted ? colors.border : bubbleBorder,
            },
          ]}
        >
          {isPinned && !isDeleted && (
            <View style={styles.pinBadge}>
              <Ionicons name="pin" size={10} color={colors.primary} />
            </View>
          )}
          {replyTo && !isDeleted && (
            <ReplyQuoteBox
              replyTo={replyTo}
              senderName={replyQuoteSenderName}
              onPress={onReplyQuotePress}
              primaryColor={colors.primary}
              textColor={colors.textSecondary}
              surfaceColor={`${colors.primary}0d`}
            />
          )}
          {renderContent()}
        </View>
      </Pressable>
      <View style={styles.metaRow}>
        <Text style={[styles.msgTime, { color: colors.textTertiary }]}>{timeStr}</Text>
        {isOwn && !isDeleted && <StatusIcon status={item.status} />}
      </View>
      {hasReactions && (
        <ReactionPillsRow
          reactions={reactions!}
          onReactionPress={onReactionPress}
          isOwn={isOwn}
          primaryColor={colors.primary}
          surfaceColor={colors.surface}
          borderColor={colors.border}
          textColor={colors.textSecondary}
        />
      )}
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
  deletedText: { fontSize: fontSize.sm, fontStyle: 'italic' },
  editedLabel: { fontSize: 10, fontStyle: 'italic', marginTop: 2, textAlign: 'right' },
  pinBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 1,
  },
  // Reply quote box
  replyQuoteBox: {
    borderLeftWidth: 3,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.xs,
    gap: 2,
  },
  replyQuoteName: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  replyQuoteBody: { fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.4 },
  // Reaction pills
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: '84%',
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, fontWeight: fontWeight.semibold },
});
