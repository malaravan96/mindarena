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
} from '@/lib/groupChat';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import type { GroupConversation, GroupMessage } from '@/lib/types';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { GroupMembersSheet } from '@/components/chat/GroupMembersSheet';

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
    shouldAutoScrollRef.current = distanceFromBottom < 120;
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
              })
              .catch(() => null);

            const next = [...prev, msg];
            next.sort((a, b) => a.created_at.localeCompare(b.created_at));
            return next;
          });

          if (msg.sender_id !== userIdRef.current) {
            markGroupRead(groupId).catch(() => null);
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

    setSending(true);
    try {
      const msg = await sendGroupMessage(groupId, body);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const next = [...prev, msg];
        next.sort((a, b) => a.created_at.localeCompare(b.created_at));
        return next;
      });
      setInput('');
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
      const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return (
        <View style={[styles.msgRow, { alignItems: isOwn ? 'flex-end' : 'flex-start' }]}>
          {!isOwn && (
            <View style={styles.senderRow}>
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
          <View
            style={[
              styles.bubble,
              {
                backgroundColor: isOwn ? `${colors.primary}16` : colors.surfaceVariant,
                borderColor: isOwn ? `${colors.primary}35` : colors.border,
              },
            ]}
          >
            {item.message_type === 'system' ? (
              <Text style={[styles.systemText, { color: colors.textSecondary }]}>{item.body}</Text>
            ) : (
              <Text style={[styles.msgBody, { color: colors.text }]}>{item.body}</Text>
            )}
          </View>
          <Text style={[styles.msgTime, { color: colors.textTertiary }]}>{timeStr}</Text>
        </View>
      );
    },
    [userId, colors],
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
        <Pressable
          onPress={() => setShowMembers(true)}
          style={[styles.membersBtn, { backgroundColor: `${colors.secondary}14` }]}
        >
          <Ionicons name="people-outline" size={18} color={colors.secondary} />
        </Pressable>
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

          <View
            style={[
              styles.composer,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, spacing.sm),
              },
            ]}
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
});
