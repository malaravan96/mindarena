import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import type { DmMessage, GroupMessage } from '@/lib/types';

type AnyMessage = DmMessage | GroupMessage;

interface PinnedMessagesSheetProps {
  visible: boolean;
  pinnedMessages: AnyMessage[];
  onClose: () => void;
  onJumpTo: (messageId: string) => void;
}

function getPreviewText(msg: AnyMessage): string {
  const type = (msg as DmMessage).message_type ?? 'text';
  if (type === 'image') return '[image]';
  if (type === 'voice') return '[voice message]';
  if (type === 'video') return '[video]';
  if (type === 'file') return '[file]';
  if (type === 'poll') return '[poll]';
  return msg.body || '';
}

export function PinnedMessagesSheet({ visible, pinnedMessages, onClose, onJumpTo }: PinnedMessagesSheetProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.titleRow}>
          <Ionicons name="pin" size={16} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Pinned Messages</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        {pinnedMessages.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No pinned messages.</Text>
        ) : (
          <FlatList
            data={pinnedMessages}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => {
              const timeStr = new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              return (
                <Pressable
                  onPress={() => { onClose(); onJumpTo(item.id); }}
                  style={[styles.pinnedItem, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                >
                  <View style={[styles.pinIndicator, { backgroundColor: colors.primary }]} />
                  <View style={styles.pinnedContent}>
                    <Text style={[styles.pinnedBody, { color: colors.text }]} numberOfLines={2}>
                      {getPreviewText(item)}
                    </Text>
                    <Text style={[styles.pinnedTime, { color: colors.textTertiary }]}>{timeStr}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    maxHeight: '60%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  closeBtn: {
    padding: 4,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    paddingVertical: spacing.lg,
  },
  list: { flex: 1 },
  pinnedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  pinIndicator: {
    width: 3,
    alignSelf: 'stretch',
  },
  pinnedContent: {
    flex: 1,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  pinnedBody: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.4 },
  pinnedTime: { fontSize: fontSize.xs },
});
