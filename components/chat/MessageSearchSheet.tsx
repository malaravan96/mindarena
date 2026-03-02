import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import BottomSheet from '@/components/chat/BottomSheet';
import type { DmMessage, GroupMessage } from '@/lib/types';

type AnyMessage = DmMessage | GroupMessage;

interface MessageSearchSheetProps {
  visible: boolean;
  messages: AnyMessage[];
  onClose: () => void;
  onJumpTo: (messageId: string) => void;
}

function getBodyText(msg: AnyMessage): string {
  const type = (msg as DmMessage).message_type ?? 'text';
  if (type === 'poll') return '[poll]';
  if (type === 'image') return '[image]';
  if (type === 'voice') return '[voice message]';
  if (type === 'video') return '[video]';
  if (type === 'file') return '[file]';
  return msg.body || '';
}

export function MessageSearchSheet({ visible, messages, onClose, onJumpTo }: MessageSearchSheetProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return messages
      .filter((m) => {
        const isDeleted = (m as DmMessage).is_deleted;
        if (isDeleted) return false;
        return getBodyText(m).toLowerCase().includes(q);
      })
      .slice()
      .reverse()
      .slice(0, 50);
  }, [messages, query]);

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose} maxHeight="70%">
      <View style={styles.searchRow}>
        <View style={[styles.searchInputWrap, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search messages..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.text }]}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={handleClose} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
        </Pressable>
      </View>

      {query.trim().length === 0 ? (
        <View style={styles.hintWrap}>
          <Ionicons name="search-outline" size={32} color={colors.textTertiary} />
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>Type to search messages</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.hintWrap}>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>No results for "{query}"</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          style={styles.list}
          renderItem={({ item }) => {
            const bodyText = getBodyText(item);
            const timeStr = new Date(item.created_at).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            const q = query.toLowerCase();
            const lower = bodyText.toLowerCase();
            const idx = lower.indexOf(q);

            return (
              <Pressable
                onPress={() => { handleClose(); onJumpTo(item.id); }}
                style={[styles.resultItem, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
              >
                <View style={styles.resultContent}>
                  {idx >= 0 ? (
                    <Text style={[styles.resultBody, { color: colors.text }]} numberOfLines={2}>
                      {bodyText.slice(0, idx)}
                      <Text style={{ backgroundColor: `${colors.primary}30`, color: colors.primary }}>
                        {bodyText.slice(idx, idx + q.length)}
                      </Text>
                      {bodyText.slice(idx + q.length)}
                    </Text>
                  ) : (
                    <Text style={[styles.resultBody, { color: colors.text }]} numberOfLines={2}>{bodyText}</Text>
                  )}
                  <Text style={[styles.resultTime, { color: colors.textTertiary }]}>{timeStr}</Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
              </Pressable>
            );
          }}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, paddingVertical: 2 },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  hintWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  hintText: { fontSize: fontSize.sm },
  list: { flex: 1, paddingHorizontal: spacing.md },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  resultContent: { flex: 1, gap: 2 },
  resultBody: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.4 },
  resultTime: { fontSize: fontSize.xs },
});
