import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import { getCurrentUserId, getOrCreateConversation, listConversations, listMessageTargets } from '@/lib/dm';
import { supabase } from '@/lib/supabase';
import type { DmConversation } from '@/lib/types';

type MessageTarget = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

export default function MessagesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [targets, setTargets] = useState<MessageTarget[]>([]);

  const titleCount = useMemo(
    () => conversations.reduce((sum, item) => sum + item.unread_count, 0),
    [conversations],
  );

  const loadData = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const [rows, people] = await Promise.all([
        listConversations(uid),
        listMessageTargets(uid),
      ]);
      setConversations(rows);
      setTargets(people);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let realtime: RealtimeChannel | null = null;

    (async () => {
      const uid = await getCurrentUserId();
      if (!uid || !mounted) return;
      setUserId(uid);
      await loadData(uid);

      realtime = supabase
        .channel(`dm-list-${uid}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'dm_messages' },
          () => loadData(uid),
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (realtime) supabase.removeChannel(realtime);
    };
  }, [loadData]);

  async function openConversation(peerUserId: string) {
    const id = await getOrCreateConversation(peerUserId);
    router.push(`/messages/${id}`);
  }

  const formatPreviewTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        <View style={[styles.unreadPill, { backgroundColor: `${colors.primary}16` }]}>
          <Ionicons name="mail-unread-outline" size={13} color={colors.primary} />
          <Text style={[styles.unreadPillText, { color: colors.primary }]}>{titleCount} unread</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Card style={styles.blockCard} padding="md">
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Recent Conversations</Text>
            {conversations.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No conversations yet.</Text>
            ) : (
              conversations.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/messages/${item.id}`)}
                  style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                >
                  <View style={[styles.avatar, { backgroundColor: `${colors.primary}16` }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {(item.peer_name || 'P').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.rowMain}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.peer_name}
                    </Text>
                    <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.last_message || 'Say hi'}
                    </Text>
                  </View>

                  <View style={styles.rowRight}>
                    <Text style={[styles.rowTime, { color: colors.textTertiary }]}>
                      {formatPreviewTime(item.last_message_at)}
                    </Text>
                    {item.unread_count > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.wrong }]}>
                        <Text style={styles.badgeText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))
            )}
          </Card>

          <Card style={styles.blockCard} padding="md">
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Start New Chat</Text>
            {targets.map((peer) => (
              <Pressable
                key={peer.id}
                onPress={() => openConversation(peer.id)}
                style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <View style={[styles.avatar, { backgroundColor: `${colors.secondary}16` }]}>
                  <Text style={[styles.avatarText, { color: colors.secondary }]}>
                    {(peer.display_name || peer.username || 'P').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.rowMain}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {peer.display_name || peer.username || 'Player'}
                  </Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Tap to send message</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </Pressable>
            ))}
            {!userId && (
              <Text style={[styles.emptyText, { color: colors.warning }]}>Sign in to use messaging.</Text>
            )}
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  unreadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  unreadPillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  blockCard: { borderRadius: borderRadius.xl },
  sectionLabel: { fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  emptyText: { fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  rowSubtitle: { fontSize: fontSize.sm, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: spacing.xs, minWidth: 44 },
  rowTime: { fontSize: fontSize.xs },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: fontWeight.bold },
});
