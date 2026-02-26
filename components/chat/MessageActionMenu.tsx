import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import type { DmMessage, GroupMessage } from '@/lib/types';

type AnyMessage = DmMessage | GroupMessage;

interface MessageActionMenuProps {
  visible: boolean;
  message: AnyMessage | null;
  isOwn: boolean;
  isPinned?: boolean;
  onClose: () => void;
  onReact: () => void;
  onReply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onForward?: () => void;
}

interface ActionItem {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color?: string;
  onPress: () => void;
}

export function MessageActionMenu({
  visible,
  message,
  isOwn,
  isPinned,
  onClose,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onForward,
}: MessageActionMenuProps) {
  const { colors } = useTheme();

  if (!message) return null;

  const isDeleted = (message as DmMessage).is_deleted === true;
  const msgType = (message as DmMessage).message_type ?? 'text';

  const actions: ActionItem[] = [];

  if (!isDeleted) {
    actions.push({ key: 'react', icon: 'happy-outline', label: 'React', onPress: () => { onClose(); onReact(); } });
    actions.push({ key: 'reply', icon: 'return-up-back-outline', label: 'Reply', onPress: () => { onClose(); onReply(); } });

    if (isOwn && (msgType === 'text' || msgType === 'poll') && onEdit) {
      actions.push({ key: 'edit', icon: 'pencil-outline', label: 'Edit', onPress: () => { onClose(); onEdit(); } });
    }

    if (onPin) {
      actions.push({
        key: 'pin',
        icon: isPinned ? 'pin' : 'pin-outline',
        label: isPinned ? 'Unpin' : 'Pin',
        onPress: () => { onClose(); onPin(); },
      });
    }

    if (onForward) {
      actions.push({ key: 'forward', icon: 'arrow-redo-outline', label: 'Forward', onPress: () => { onClose(); onForward(); } });
    }
  }

  if (isOwn && onDelete) {
    actions.push({
      key: 'delete',
      icon: 'trash-outline',
      label: 'Delete',
      color: colors.wrong,
      onPress: () => { onClose(); onDelete(); },
    });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.textSecondary }]}>Message actions</Text>
        <View style={styles.grid}>
          {actions.map((action) => (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              style={[styles.actionItem, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            >
              <Ionicons name={action.icon} size={22} color={action.color ?? colors.primary} />
              <Text style={[styles.actionLabel, { color: action.color ?? colors.text }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
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
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 72,
  },
  actionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});
