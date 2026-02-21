import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import { getCurrentUserId, listMessages, markConversationRead, sendMessage } from '@/lib/dm';
import { notifyDmMessage } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import type { DmMessage } from '@/lib/types';

export default function MessageThreadScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState('Player');
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages],
  );

  const loadThread = useCallback(async () => {
    if (!conversationId) return;

    setLoading(true);
    const uid = await getCurrentUserId();
    setUserId(uid);

    const [rows] = await Promise.all([
      listMessages(conversationId),
      markConversationRead(conversationId),
    ]);
    setMessages(rows);

    if (uid) {
      const { data: conversation } = await supabase
        .from('dm_conversations')
        .select('user_a, user_b')
        .eq('id', conversationId)
        .maybeSingle<{ user_a: string; user_b: string }>();

      if (conversation) {
        const peerId = conversation.user_a === uid ? conversation.user_b : conversation.user_a;
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', peerId)
          .maybeSingle<{ display_name: string | null; username: string | null }>();
        setPeerName(profile?.display_name || profile?.username || 'Player');
      }
    }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    loadThread().catch(() => null);
  }, [loadThread]);

  useFocusEffect(
    useCallback(() => {
      if (conversationId) {
        markConversationRead(conversationId).catch(() => null);
      }
      return undefined;
    }, [conversationId]),
  );

  useEffect(() => {
    if (!conversationId) return;
    const channel: RealtimeChannel = supabase
      .channel(`dm-thread-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        ({ new: row }) => {
          setMessages((prev) => {
            const next = [...prev, row as DmMessage];
            next.sort((a, b) => a.created_at.localeCompare(b.created_at));
            return next;
          });
          markConversationRead(conversationId).catch(() => null);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function onSend() {
    if (!conversationId || sending) return;
    const body = input.trim();
    if (!body) return;

    setSending(true);
    try {
      const row = await sendMessage(conversationId, body);
      setInput('');
      await notifyDmMessage(row.id);
    } finally {
      setSending(false);
    }
  }

  if (!conversationId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingWrap}>
          <Text style={{ color: colors.textSecondary }}>Conversation not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {peerName}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Direct message</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.body}>
          <ScrollView contentContainerStyle={styles.logContent} style={styles.log}>
            {sortedMessages.map((msg) => {
              const mine = msg.sender_id === userId;
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.msgRow,
                    {
                      alignItems: mine ? 'flex-end' : 'flex-start',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      {
                        backgroundColor: mine ? `${colors.primary}16` : colors.surfaceVariant,
                        borderColor: mine ? `${colors.primary}35` : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.msgBody, { color: colors.text }]}>{msg.body}</Text>
                  </View>
                  <Text style={[styles.msgTime, { color: colors.textTertiary }]}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.composer, { borderTopColor: colors.border }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
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
            />
            <Pressable
              onPress={onSend}
              disabled={sending || !input.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: sending || !input.trim() ? colors.border : colors.primary,
                },
              ]}
            >
              <Ionicons name="send" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}
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
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  log: { flex: 1 },
  logContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  msgRow: { gap: 4 },
  bubble: {
    maxWidth: '84%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  msgBody: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  msgTime: { fontSize: fontSize.xs },
  composer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
