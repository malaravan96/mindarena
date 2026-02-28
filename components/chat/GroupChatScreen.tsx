import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import {
  getGroupInfo,
  listGroupMessages,
  markGroupRead,
  sendGroupMessage,
  editGroupMessage,
  deleteGroupMessage,
  pinGroupMessage,
  unpinGroupMessage,
  listPinnedGroupMessages,
} from '@/lib/groupChat';
import { supabase } from '@/lib/supabase';
import { showAlert, showConfirm } from '@/lib/alert';
import type { GroupConversation, GroupMessage, DmMessage } from '@/lib/types';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { GroupMembersSheet } from '@/components/chat/GroupMembersSheet';
import { MessageActionMenu } from '@/components/chat/MessageActionMenu';
import { PinnedMessagesSheet } from '@/components/chat/PinnedMessagesSheet';
import { ForwardMessageSheet } from '@/components/chat/ForwardMessageSheet';
import { PollCreatorSheet } from '@/components/chat/PollCreatorSheet';
import { MessageSearchSheet } from '@/components/chat/MessageSearchSheet';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { setActiveGroupId } from '@/lib/notificationState';
import { getItem, setItem } from '@/lib/storage';

const TYPING_RESET_MS = 4000;

function formatLastMessage(msg: GroupMessage): string {
  const senderName = msg.sender_profile?.display_name || msg.sender_profile?.username || 'Someone';
  if (msg.message_type === 'text') return `${senderName}: ${msg.body}`;
  return `${senderName}: [${msg.message_type}]`;
}

export function GroupChatScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupConversation | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [actionMenuMessage, setActionMenuMessage] = useState<GroupMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<GroupMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<GroupMessage | null>(null);
  const [showPinnedSheet, setShowPinnedSheet] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<GroupMessage[]>([]);
  const [forwardingMessage, setForwardingMessage] = useState<GroupMessage | null>(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [composerHeight, setComposerHeight] = useState(56);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const messageListRef = useRef<FlatList<GroupMessage> | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => { userIdRef.current = userId; }, [userId]);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages],
  );
  const draftKey = useMemo(
    () => (groupId ? `group_chat_draft_${groupId}` : null),
    [groupId],
  );

  useEffect(() => {
    if (!draftKey) return;
    let mounted = true;
    setInput('');
    setShowJumpToLatest(false);
    getItem(draftKey).then((raw) => {
      if (!mounted || !raw) return;
      setInput(raw);
    });
    return () => {
      mounted = false;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    const timer = setTimeout(() => {
      void setItem(draftKey, input);
    }, 220);
    return () => clearTimeout(timer);
  }, [draftKey, input]);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    const timer = setTimeout(() => {
      messageListRef.current?.scrollToEnd({ animated: true });
    }, 30);
    return () => clearTimeout(timer);
  }, [sortedMessages.length]);

  const onListScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const nearBottom = distanceFromBottom < 120;
    shouldAutoScrollRef.current = nearBottom;
    setShowJumpToLatest((prev) => {
      if (nearBottom && prev) return false;
      if (!nearBottom && !prev) return true;
      return prev;
    });
  }, []);

  const scrollToLatest = useCallback(() => {
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    messageListRef.current?.scrollToEnd({ animated: true });
  }, []);

  const loadThread = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      setUserId(uid);

      const [info, rows] = await Promise.all([
        getGroupInfo(groupId),
        listGroupMessages(groupId),
        markGroupRead(groupId),
      ]);

      setGroup(info);
      setMessages(rows);

      // Load pinned messages
      if (groupId) {
        listPinnedGroupMessages(groupId).then(setPinnedMessages).catch(() => null);
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadThread().catch(() => null);
  }, [loadThread]);

  useFocusEffect(
    useCallback(() => {
      if (groupId) markGroupRead(groupId).catch(() => null);
      return undefined;
    }, [groupId]),
  );

  // Track active group so push banners are suppressed while viewing this chat
  useEffect(() => {
    if (!groupId) return;
    setActiveGroupId(groupId);
    return () => setActiveGroupId(null);
  }, [groupId]);

  // Realtime subscription
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        ({ new: row }) => {
          const msg = row as GroupMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            // Fetch sender profile
            supabase
              .from('profiles')
              .select('id, username, display_name, avatar_url')
              .eq('id', msg.sender_id)
              .maybeSingle()
              .then(({ data: profile }) => {
                setMessages((p) =>
                  p.map((m) =>
                    m.id === msg.id
                      ? { ...m, sender_profile: profile ?? undefined }
                      : m,
                  ),
                );
              }, () => null);

            const next = [...prev, msg];
            next.sort((a, b) => a.created_at.localeCompare(b.created_at));
            return next;
          });

          if (msg.sender_id !== userIdRef.current) {
            markGroupRead(groupId).catch(() => null);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${groupId}`,
        },
        ({ new: row }) => {
          const updated = row as GroupMessage;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? {
                    ...m,
                    body: updated.is_deleted ? '' : (updated.edited_at ? updated.body : m.body),
                    edited_at: updated.edited_at,
                    is_deleted: updated.is_deleted,
                    pinned_at: updated.pinned_at,
                    pinned_by: updated.pinned_by,
                  }
                : m,
            ),
          );
          if (updated.pinned_at !== undefined) {
            listPinnedGroupMessages(groupId).then(setPinnedMessages).catch(() => null);
          }
        },
      )
      .on('broadcast', { event: 'group-typing' }, ({ payload }) => {
        const p = (payload ?? {}) as Record<string, unknown>;
        const fromId = typeof p.fromId === 'string' ? p.fromId : null;
        const fromName = typeof p.fromName === 'string' ? p.fromName : 'Someone';
        if (!fromId || fromId === userIdRef.current) return;

        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(fromId, fromName);
          return next;
        });

        const existing = typingTimersRef.current.get(fromId);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(fromId);
            return next;
          });
        }, TYPING_RESET_MS);
        typingTimersRef.current.set(fromId, timer);
      })
      .on('broadcast', { event: 'group-typing-stop' }, ({ payload }) => {
        const p = (payload ?? {}) as Record<string, unknown>;
        const fromId = typeof p.fromId === 'string' ? p.fromId : null;
        if (!fromId) return;
        const existing = typingTimersRef.current.get(fromId);
        if (existing) clearTimeout(existing);
        typingTimersRef.current.delete(fromId);
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(fromId);
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [groupId]);

  useEffect(() => {
    return () => {
      for (const timer of typingTimersRef.current.values()) clearTimeout(timer);
    };
  }, []);

  async function onSend() {
    if (!groupId || sending || !input.trim()) return;
    const body = input.trim();
    shouldAutoScrollRef.current = true;

    // Stop typing
    channelRef.current?.send({
      type: 'broadcast',
      event: 'group-typing-stop',
      payload: { fromId: userId },
    }).catch(() => null);

    // Handle edit mode
    if (editingMessage) {
      setSending(true);
      try {
        await editGroupMessage(editingMessage.id, body);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editingMessage.id ? { ...m, body, edited_at: new Date().toISOString() } : m,
          ),
        );
        setInput('');
        setEditingMessage(null);
      } catch (e: any) {
        showAlert('Edit failed', e?.message ?? 'Could not edit message');
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      const replyToId = replyTarget?.id ?? null;
      const msg = await sendGroupMessage(groupId, body, replyToId ? { replyToId } : undefined);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const next = [...prev, msg];
        next.sort((a, b) => a.created_at.localeCompare(b.created_at));
        return next;
      });
      setInput('');
      setReplyTarget(null);
    } catch (e: any) {
      showAlert('Send failed', e?.message ?? 'Could not send message');
    } finally {
      setSending(false);
    }
  }

  function onInputChange(text: string) {
    setInput(text);
    if (!channelRef.current || !userId) return;
    if (text.length > 0) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'group-typing',
        payload: { fromId: userId, fromName: 'You' },
      }).catch(() => null);
    } else {
      channelRef.current.send({
        type: 'broadcast',
        event: 'group-typing-stop',
        payload: { fromId: userId },
      }).catch(() => null);
    }
  }

  const renderItem = useCallback(
    ({ item }: { item: GroupMessage }) => {
      const isOwn = item.sender_id === userId;
      const senderName = item.sender_profile?.display_name || item.sender_profile?.username || 'Player';
      const avatarUrl = item.sender_profile?.avatar_url;

      if (item.message_type === 'system') {
        return (
          <View style={styles.systemRow}>
            <Text style={[styles.systemText, { color: colors.textSecondary }]}>{item.body}</Text>
          </View>
        );
      }

      const replyTo = item.reply_to_id
        ? (messages.find((m) => m.id === item.reply_to_id) as DmMessage | undefined) ?? null
        : null;

      return (
        <View>
          {!isOwn && (
            <View style={[styles.senderRow, { justifyContent: 'flex-start' }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.senderAvatar} />
              ) : (
                <View style={[styles.senderAvatarFallback, { backgroundColor: `${colors.secondary}16` }]}>
                  <Text style={[styles.senderAvatarText, { color: colors.secondary }]}>
                    {senderName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={[styles.senderName, { color: colors.textSecondary }]}>{senderName}</Text>
            </View>
          )}
          <MessageBubble
            item={item as unknown as DmMessage}
            isOwn={isOwn}
            currentUserId={userId ?? undefined}
            isPinned={!!item.pinned_at}
            replyTo={replyTo}
            onLongPress={() => setActionMenuMessage(item)}
            onSwipeReply={() => setReplyTarget(item)}
            onReplyQuotePress={() => {
              const idx = sortedMessages.findIndex((m) => m.id === item.reply_to_id);
              if (idx >= 0) {
                messageListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
              }
            }}
          />
        </View>
      );
    },
    [userId, colors, messages, sortedMessages],
  );

  const typingLabel = useMemo(() => {
    const names = Array.from(typingUsers.values());
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names.length} people are typing...`;
  }, [typingUsers]);

  if (!groupId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <Text style={{ color: colors.textSecondary }}>Group not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        {group?.avatar_url ? (
          <Image source={{ uri: group.avatar_url }} style={styles.headerAvatar} />
        ) : (
          <View style={[styles.headerAvatarFallback, { backgroundColor: `${colors.secondary}16` }]}>
            <Text style={[styles.headerAvatarText, { color: colors.secondary }]}>
              {(group?.name ?? 'G').slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {group?.name ?? 'Group Chat'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Group chat
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <Pressable
            onPress={() => setShowSearch(true)}
            style={[styles.membersBtn, { backgroundColor: `${colors.primary}10` }]}
          >
            <Ionicons name="search-outline" size={18} color={colors.primary} />
          </Pressable>
          {pinnedMessages.length > 0 && (
            <Pressable
              onPress={() => setShowPinnedSheet(true)}
              style={[styles.membersBtn, { backgroundColor: `${colors.primary}10` }]}
            >
              <Ionicons name="pin" size={18} color={colors.primary} />
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowMembers(true)}
            style={[styles.membersBtn, { backgroundColor: `${colors.secondary}14` }]}
          >
            <Ionicons name="people-outline" size={18} color={colors.secondary} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <FlatList
            ref={messageListRef}
            style={styles.log}
            contentContainerStyle={[styles.logContent, { paddingBottom: 80 + insets.bottom }]}
            data={sortedMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            onScroll={onListScroll}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No messages yet. Say hi!</Text>
            }
            ListFooterComponent={
              typingLabel ? (
                <View style={styles.typingRow}>
                  <Text style={[styles.typingText, { color: colors.textSecondary }]}>{typingLabel}</Text>
                </View>
              ) : null
            }
          />

          {showJumpToLatest && sortedMessages.length > 0 && (
            <Pressable
              onPress={scrollToLatest}
              style={[
                styles.jumpToLatestBtn,
                {
                  backgroundColor: colors.secondary,
                  bottom: composerHeight + Math.max(insets.bottom, spacing.sm) + spacing.sm,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Jump to latest messages"
            >
              <Ionicons name="arrow-down" size={16} color="#fff" />
              <Text style={styles.jumpToLatestText}>Latest</Text>
            </Pressable>
          )}

          {editingMessage && (
            <View style={[styles.replyBar, { backgroundColor: `${colors.warning}10`, borderTopColor: colors.border, borderLeftColor: colors.warning }]}>
              <View style={styles.replyBarContent}>
                <Text style={[styles.replyBarName, { color: colors.warning }]} numberOfLines={1}>Edit message</Text>
                <Text style={[styles.replyBarBody, { color: colors.textSecondary }]} numberOfLines={1}>{editingMessage.body}</Text>
              </View>
              <Pressable onPress={() => { setEditingMessage(null); setInput(''); }} style={styles.replyBarClose}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}

          {replyTarget && (
            <View style={[styles.replyBar, { backgroundColor: colors.surfaceVariant, borderTopColor: colors.border, borderLeftColor: colors.secondary }]}>
              <View style={styles.replyBarContent}>
                <Text style={[styles.replyBarName, { color: colors.secondary }]} numberOfLines={1}>
                  {replyTarget.sender_profile?.display_name || replyTarget.sender_profile?.username || 'Someone'}
                </Text>
                <Text style={[styles.replyBarBody, { color: colors.textSecondary }]} numberOfLines={1}>
                  {replyTarget.body || `[${replyTarget.message_type}]`}
                </Text>
              </View>
              <Pressable onPress={() => setReplyTarget(null)} style={styles.replyBarClose}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}

          <View
            style={[
              styles.composer,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, spacing.sm),
              },
            ]}
            onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
          >
            <Pressable
              onPress={() => setShowEmojiPicker(true)}
              style={[styles.composerIconBtn, { backgroundColor: `${colors.primary}10` }]}
            >
              <Ionicons name="happy-outline" size={20} color={colors.textSecondary} />
            </Pressable>
            <TextInput
              value={input}
              onChangeText={onInputChange}
              onFocus={() => setShowEmojiPicker(false)}
              placeholder="Message group..."
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceVariant,
                },
              ]}
              editable={!sending}
              onSubmitEditing={onSend}
              returnKeyType="send"
              multiline
            />
            {!input.trim() && (
              <Pressable
                onPress={() => setShowPollCreator(true)}
                style={[styles.composerIconBtn, { backgroundColor: `${colors.primary}10` }]}
              >
                <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
              </Pressable>
            )}
            {!!input.trim() && (
              <Pressable
                onPress={() => setInput('')}
                style={[styles.composerIconBtn, { backgroundColor: `${colors.border}70` }]}
                accessibilityRole="button"
                accessibilityLabel="Clear message"
              >
                <Ionicons name="close-outline" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
            <Pressable
              onPress={onSend}
              disabled={sending || !input.trim()}
              style={[
                styles.sendBtn,
                { backgroundColor: sending || !input.trim() ? colors.border : colors.secondary },
              ]}
            >
              <Ionicons name="send" size={16} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={(emoji) => setInput((prev) => prev + emoji)}
        onClose={() => setShowEmojiPicker(false)}
      />

      <GroupMembersSheet
        visible={showMembers}
        groupId={groupId}
        groupName={group?.name ?? 'Group'}
        currentUserId={userId}
        onClose={() => setShowMembers(false)}
        onGroupDeleted={() => router.replace('/chat')}
      />

      <MessageActionMenu
        visible={!!actionMenuMessage}
        message={actionMenuMessage as unknown as import('@/lib/types').DmMessage | null}
        isOwn={actionMenuMessage?.sender_id === userId}
        isPinned={!!actionMenuMessage?.pinned_at}
        onClose={() => setActionMenuMessage(null)}
        onReact={() => { /* groups don't have reactions yet — no-op */ }}
        onReply={() => { if (actionMenuMessage) setReplyTarget(actionMenuMessage); }}
        onEdit={
          actionMenuMessage && !actionMenuMessage.is_deleted && actionMenuMessage.message_type === 'text'
            ? () => { setEditingMessage(actionMenuMessage); setInput(actionMenuMessage.body); }
            : undefined
        }
        onDelete={actionMenuMessage ? () => {
          const msg = actionMenuMessage;
          showConfirm('Delete message?', 'This cannot be undone.', 'Delete').then((confirmed) => {
            if (!confirmed) return;
            deleteGroupMessage(msg.id)
              .then(() => setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, is_deleted: true, body: '' } : m)))
              .catch((e: any) => showAlert('Failed', e?.message ?? 'Could not delete'));
          });
        } : undefined}
        onPin={
          actionMenuMessage && !actionMenuMessage.is_deleted
            ? () => {
                const msg = actionMenuMessage;
                const fn = msg.pinned_at ? unpinGroupMessage : pinGroupMessage;
                fn(msg.id)
                  .then(() => {
                    const now = new Date().toISOString();
                    setMessages((prev) =>
                      prev.map((m) => m.id === msg.id ? { ...m, pinned_at: msg.pinned_at ? null : now } : m),
                    );
                    return groupId ? listPinnedGroupMessages(groupId).then(setPinnedMessages) : Promise.resolve();
                  })
                  .catch((e: any) => showAlert('Failed', e?.message ?? 'Could not pin'));
              }
            : undefined
        }
        onForward={actionMenuMessage && !actionMenuMessage.is_deleted ? () => setForwardingMessage(actionMenuMessage) : undefined}
      />

      <PinnedMessagesSheet
        visible={showPinnedSheet}
        pinnedMessages={pinnedMessages as unknown as import('@/lib/types').DmMessage[]}
        onClose={() => setShowPinnedSheet(false)}
        onJumpTo={(messageId) => {
          const idx = sortedMessages.findIndex((m) => m.id === messageId);
          if (idx >= 0) {
            messageListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
          }
        }}
      />

      <ForwardMessageSheet
        visible={!!forwardingMessage}
        message={forwardingMessage as unknown as import('@/lib/types').DmMessage | null}
        onClose={() => setForwardingMessage(null)}
      />

      <PollCreatorSheet
        visible={showPollCreator}
        groupId={groupId}
        onClose={() => setShowPollCreator(false)}
        onPollCreated={() => { /* messages arrive via realtime */ }}
      />

      <MessageSearchSheet
        visible={showSearch}
        messages={sortedMessages as unknown as import('@/lib/types').DmMessage[]}
        onClose={() => setShowSearch(false)}
        onJumpTo={(messageId) => {
          const idx = sortedMessages.findIndex((m) => m.id === messageId);
          if (idx >= 0) {
            messageListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  headerAvatar: { width: 34, height: 34, borderRadius: 17 },
  headerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { fontSize: 11, fontWeight: '700' },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  membersBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  log: { flex: 1 },
  logContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  emptyText: { textAlign: 'center', paddingVertical: spacing.lg, fontSize: 13 },
  msgRow: { gap: 4 },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 2 },
  senderAvatar: { width: 20, height: 20, borderRadius: 10 },
  senderAvatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderAvatarText: { fontSize: 8, fontWeight: '700' },
  senderName: { fontSize: 11, fontWeight: '600' },
  bubble: {
    maxWidth: '84%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  msgBody: { fontSize: 13, lineHeight: 20 },
  systemText: { fontSize: 11, fontStyle: 'italic', textAlign: 'center' },
  msgTime: { fontSize: 11 },
  typingRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  typingText: { fontSize: 12, fontStyle: 'italic' },
  composer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  composerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpToLatestBtn: {
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
  jumpToLatestText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  systemRow: { alignItems: 'center', paddingVertical: 4 },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderLeftWidth: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  replyBarContent: { flex: 1, gap: 2 },
  replyBarName: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  replyBarBody: { fontSize: fontSize.xs },
  replyBarClose: { padding: 4 },
});
