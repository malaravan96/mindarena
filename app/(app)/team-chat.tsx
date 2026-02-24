import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { listTeamMessages, sendTeamMessage, getTeamMessageSenderProfiles } from '@/lib/teamChat';
import { Input } from '@/components/Input';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { TeamMessage } from '@/lib/types';

type MessageWithProfile = TeamMessage & {
  sender_name: string;
  sender_avatar_url: string | null;
  isMe: boolean;
};

export default function TeamChat() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MessageWithProfile[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id) loadMessages();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`team-chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `team_id=eq.${id}` },
        () => {
          loadMessages();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function loadMessages() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      setUid(userId);

      const msgs = await listTeamMessages(id!);
      const profiles = await getTeamMessageSenderProfiles(msgs);

      setMessages(
        msgs.map((m) => ({
          ...m,
          sender_name: profiles.get(m.sender_id)?.name ?? 'Player',
          sender_avatar_url: profiles.get(m.sender_id)?.avatar_url ?? null,
          isMe: m.sender_id === userId,
        })),
      );
    } catch (e) {
      console.error('Load messages error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!inputText.trim() || sending) return;
    setSending(true);
    try {
      await sendTeamMessage(id!, inputText);
      setInputText('');
    } catch (e: any) {
      console.error('Send error:', e);
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderMessage({ item }: { item: MessageWithProfile }) {
    const isMe = item.isMe;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && (
          <View style={[styles.msgAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.msgAvatarText}>{item.sender_name[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View
          style={[
            styles.msgBubble,
            isMe
              ? [styles.msgBubbleMe, { backgroundColor: colors.primary }]
              : [styles.msgBubbleOther, { backgroundColor: colors.surfaceVariant }],
          ]}
        >
          {!isMe && (
            <Text style={[styles.msgSender, { color: colors.primary }]}>{item.sender_name}</Text>
          )}
          <Text style={[styles.msgBody, { color: isMe ? '#fff' : colors.text }]}>{item.body}</Text>
          <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textTertiary }]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {name || 'Team Chat'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Team chat</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContent, { maxWidth: isDesktop ? 720 : undefined }]}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No messages yet. Say hello to your team!
                </Text>
              </View>
            }
          />
        )}

        <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.inputWrap}>
            <Input
              placeholder="Type a message..."
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              autoCapitalize="sentences"
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[
              styles.sendBtn,
              { backgroundColor: inputText.trim() ? colors.primary : colors.surfaceVariant },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color={inputText.trim() ? '#fff' : colors.textTertiary} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { padding: spacing.xs },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: spacing.md, alignSelf: 'center', width: '100%', flexGrow: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  emptyText: { fontSize: fontSize.base, textAlign: 'center' },
  msgRow: { marginBottom: spacing.sm },
  msgRowMe: { alignItems: 'flex-end' },
  msgRowOther: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  msgAvatarText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  msgBubble: { maxWidth: '75%', padding: spacing.sm, borderRadius: borderRadius.lg },
  msgBubbleMe: { borderBottomRightRadius: 4 },
  msgBubbleOther: { borderBottomLeftRadius: 4 },
  msgSender: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginBottom: 2 },
  msgBody: { fontSize: fontSize.base },
  msgTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  inputWrap: { flex: 1 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
