import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import BottomSheet from '@/components/chat/BottomSheet';
import { getCurrentUserId, listConversations, sendMessage } from '@/lib/dm';
import { listGroupConversations, sendGroupMessage } from '@/lib/groupChat';
import { showAlert } from '@/lib/alert';
import type { DmConversation, DmMessage, GroupConversation, GroupMessage } from '@/lib/types';

type AnyMessage = DmMessage | GroupMessage;

interface ForwardMessageSheetProps {
  visible: boolean;
  message: AnyMessage | null;
  onClose: () => void;
}

type DestItem =
  | { type: 'dm'; conversation: DmConversation }
  | { type: 'group'; group: GroupConversation };

export function ForwardMessageSheet({ visible, message, onClose }: ForwardMessageSheetProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DestItem[]>([]);
  const [forwarding, setForwarding] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      const uid = await getCurrentUserId();
      if (!uid || !mounted) return;
      const [convs, groups] = await Promise.all([
        listConversations(uid).catch(() => [] as DmConversation[]),
        listGroupConversations(uid).catch(() => [] as GroupConversation[]),
      ]);
      if (!mounted) return;
      const destItems: DestItem[] = [
        ...convs.map((c) => ({ type: 'dm' as const, conversation: c })),
        ...groups.map((g) => ({ type: 'group' as const, group: g })),
      ];
      setItems(destItems);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [visible]);

  async function forward(dest: DestItem) {
    if (!message || forwarding) return;
    const id = dest.type === 'dm' ? dest.conversation.id : dest.group.id;
    setForwarding(id);
    try {
      const isDeleted = (message as DmMessage).is_deleted;
      const body = isDeleted ? '' : `↪ Forwarded:\n${message.body}`;
      if (dest.type === 'dm') {
        await sendMessage(dest.conversation.id, body);
      } else {
        await sendGroupMessage(dest.group.id, body);
      }
      onClose();
    } catch (e: any) {
      showAlert('Forward failed', e?.message ?? 'Could not forward message');
    } finally {
      setForwarding(null);
    }
  }

  function renderItem({ item }: { item: DestItem }) {
    const id = item.type === 'dm' ? item.conversation.id : item.group.id;
    const name = item.type === 'dm' ? item.conversation.peer_name : item.group.name;
    const avatarUrl = item.type === 'dm' ? item.conversation.peer_avatar_url : item.group.avatar_url;
    const isForwarding = forwarding === id;

    return (
      <Pressable
        onPress={() => forward(item)}
        style={[styles.destItem, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
        disabled={!!forwarding}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: item.type === 'dm' ? `${colors.primary}16` : `${colors.secondary}16` }]}>
            <Text style={[styles.avatarText, { color: item.type === 'dm' ? colors.primary : colors.secondary }]}>
              {(name || '?').slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.destInfo}>
          <Text style={[styles.destName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.destType, { color: colors.textSecondary }]}>
            {item.type === 'dm' ? 'Direct message' : 'Group chat'}
          </Text>
        </View>
        {isForwarding ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="arrow-redo-outline" size={18} color={colors.textSecondary} />
        )}
      </Pressable>
    );
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Forward to..." maxHeight="65%">
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No conversations to forward to.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.type === 'dm' ? item.conversation.id : item.group.id}
          renderItem={renderItem}
          style={styles.list}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center' },
  emptyText: { textAlign: 'center', fontSize: fontSize.sm, paddingVertical: spacing.lg },
  list: { flex: 1 },
  destItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: fontWeight.bold },
  destInfo: { flex: 1 },
  destName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  destType: { fontSize: fontSize.xs, marginTop: 2 },
});
