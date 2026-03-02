import React, { useCallback, useRef, useMemo } from 'react';
import {
  FlatList,
  View,
  Text,
  Pressable,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, fontSize, fontWeight, borderRadius } from '@/constants/theme';
import { DateSeparator } from '@/components/chat/DateSeparator';
import type { DmMessage, DmReactionGroup } from '@/lib/types';

type ListItem =
  | { type: 'date'; key: string; date: string }
  | {
      type: 'message';
      key: string;
      message: DmMessage;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
    };

interface MessageListProps {
  messages: DmMessage[];
  userId: string | null;
  peerName: string;
  peerTyping: boolean;
  reactionsMap: Map<string, DmReactionGroup[]>;
  playingVoiceId: string | null;
  composerHeight: number;
  androidKbHeight: number;
  showJumpToLatest: boolean;
  renderMessageItem: (props: {
    item: DmMessage;
    isFirstInGroup: boolean;
    isLastInGroup: boolean;
  }) => React.ReactElement;
  onScroll: (nearBottom: boolean) => void;
  onScrollToLatest: () => void;
  listRef: React.RefObject<FlatList<ListItem> | null>;
}

function getDateKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function buildListItems(messages: DmMessage[]): ListItem[] {
  const items: ListItem[] = [];
  let lastDateKey = '';

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const dateKey = getDateKey(msg.created_at);

    // Insert date separator when date changes
    if (dateKey !== lastDateKey) {
      items.push({ type: 'date', key: `date-${dateKey}`, date: msg.created_at });
      lastDateKey = dateKey;
    }

    // Determine sender grouping
    const prevMsg = i > 0 ? messages[i - 1] : null;
    const nextMsg = i < messages.length - 1 ? messages[i + 1] : null;

    const sameSenderAsPrev =
      prevMsg &&
      prevMsg.sender_id === msg.sender_id &&
      getDateKey(prevMsg.created_at) === dateKey &&
      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 120000; // 2 min window

    const sameSenderAsNext =
      nextMsg &&
      nextMsg.sender_id === msg.sender_id &&
      getDateKey(nextMsg.created_at) === dateKey &&
      new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime() < 120000;

    items.push({
      type: 'message',
      key: msg.id,
      message: msg,
      isFirstInGroup: !sameSenderAsPrev,
      isLastInGroup: !sameSenderAsNext,
    });
  }

  return items;
}

export function MessageList({
  messages,
  userId,
  peerName,
  peerTyping,
  composerHeight,
  androidKbHeight,
  showJumpToLatest,
  renderMessageItem,
  onScroll,
  onScrollToLatest,
  listRef,
}: MessageListProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const initialScrollDoneRef = useRef(false);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages],
  );

  const listItems = useMemo(() => buildListItems(sortedMessages), [sortedMessages]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      onScroll(distanceFromBottom < 120);
    },
    [onScroll],
  );

  const onContentSizeChange = useCallback(() => {
    if (!initialScrollDoneRef.current && sortedMessages.length > 0) {
      initialScrollDoneRef.current = true;
      (listRef.current as any)?.scrollToEnd?.({ animated: false });
    }
  }, [sortedMessages.length, listRef]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'date') {
        return <DateSeparator date={item.date} />;
      }
      return renderMessageItem({
        item: item.message,
        isFirstInGroup: item.isFirstInGroup,
        isLastInGroup: item.isLastInGroup,
      });
    },
    [renderMessageItem],
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef as any}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: composerHeight + insets.bottom + spacing.sm },
        ]}
        data={listItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        onScroll={handleScroll}
        onContentSizeChange={onContentSizeChange}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No messages yet. Say hi.
          </Text>
        }
        ListFooterComponent={
          peerTyping ? (
            <View style={styles.typingRow}>
              <Text style={[styles.typingText, { color: colors.textSecondary }]}>
                {peerName} is typing...
              </Text>
            </View>
          ) : null
        }
      />

      {showJumpToLatest && sortedMessages.length > 0 && (
        <Pressable
          onPress={onScrollToLatest}
          style={[
            styles.jumpBtn,
            {
              backgroundColor: colors.primary,
              bottom:
                composerHeight +
                (androidKbHeight > 0 ? spacing.sm : Math.max(insets.bottom, spacing.sm)) +
                spacing.sm,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Jump to latest messages"
        >
          <Ionicons name="arrow-down" size={16} color="#fff" />
          <Text style={styles.jumpText}>Latest</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  emptyText: { textAlign: 'center', paddingVertical: spacing.lg, fontSize: 13 },
  typingRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  typingText: { fontSize: 12, fontStyle: 'italic' },
  jumpBtn: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  jumpText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
});
