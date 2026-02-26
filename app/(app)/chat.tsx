import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import { getCurrentUserId, getOrCreateConversation, listConversations, listMessageTargets } from '@/lib/dm';
import { useGlobalNotifications } from '@/contexts/GlobalNotificationsContext';
import { listGroupConversations } from '@/lib/groupChat';
import { supabase } from '@/lib/supabase';
import type { ConnectionWithProfile, DmConversation, GroupConversation } from '@/lib/types';
import { listConnections, acceptChatRequest, declineChatRequest } from '@/lib/connections';

type MessageTarget = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

export default function ChatScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { refreshUnread } = useGlobalNotifications();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [targets, setTargets] = useState<MessageTarget[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ConnectionWithProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const titleCount = useMemo(
    () => conversations.reduce((sum, item) => sum + item.unread_count, 0),
    [conversations],
  );

  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.peer_name.toLowerCase().includes(q) ||
        (c.last_message ?? '').toLowerCase().includes(q),
    );
  }, [conversations, searchQuery]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.last_message ?? '').toLowerCase().includes(q),
    );
  }, [groups, searchQuery]);

  const loadData = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const [rows, people, pending, groupRows] = await Promise.all([
        listConversations(uid),
        listMessageTargets(uid),
        listConnections(uid, 'pending'),
        listGroupConversations(uid).catch(() => [] as GroupConversation[]),
      ]);
      setConversations(rows);
      setTargets(people);
      setGroups(groupRows);
      // Only show incoming pending requests (where current user is the target)
      setPendingRequests(pending.filter((c) => c.target_id === uid));
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
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_connections' },
          () => loadData(uid),
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (realtime) supabase.removeChannel(realtime);
    };
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const uid = userId ?? (await getCurrentUserId());
        if (!uid || !active) return;
        if (!userId) setUserId(uid);
        await loadData(uid);
        if (active) refreshUnread();
      })();
      return () => {
        active = false;
      };
    }, [userId, loadData, refreshUnread]),
  );

  async function openConversation(peerUserId: string) {
    const id = await getOrCreateConversation(peerUserId);
    router.push({ pathname: '/chat-thread', params: { conversationId: id } });
  }

  const formatPreviewTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chat</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={[styles.unreadPill, { backgroundColor: `${colors.primary}16` }]}>
            <Ionicons name="mail-unread-outline" size={13} color={colors.primary} />
            <Text style={[styles.unreadPillText, { color: colors.primary }]}>{titleCount} unread</Text>
          </View>
          <Pressable
            onPress={() => router.push('/create-group')}
            style={[styles.newGroupBtn, { backgroundColor: `${colors.secondary}16` }]}
          >
            <Ionicons name="people-outline" size={15} color={colors.secondary} />
            <Text style={[styles.newGroupText, { color: colors.secondary }]}>New Group</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}>
        <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search chats..."
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.text }]}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {pendingRequests.length > 0 && (
            <Card style={styles.blockCard} padding="md">
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Chat Requests</Text>
              {pendingRequests.map((req) => (
                <View
                  key={req.id}
                  style={[styles.row, { borderColor: `${colors.secondary}30`, backgroundColor: `${colors.secondary}08` }]}
                >
                  {req.peer_avatar_url ? (
                    <Image source={{ uri: req.peer_avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: `${colors.secondary}16` }]}>
                      <Text style={[styles.avatarText, { color: colors.secondary }]}>
                        {(req.peer_name || 'P').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {req.peer_name}
                    </Text>
                    <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>Wants to connect</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    <Pressable
                      onPress={async () => {
                        try {
                          await acceptChatRequest(req.id);
                          if (userId) await loadData(userId);
                        } catch { /* ignore */ }
                      }}
                      style={[styles.requestBtn, { backgroundColor: colors.correct }]}
                    >
                      <Text style={styles.requestBtnText}>Accept</Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        try {
                          await declineChatRequest(req.id);
                          if (userId) await loadData(userId);
                        } catch { /* ignore */ }
                      }}
                      style={[styles.requestBtn, { backgroundColor: colors.wrong }]}
                    >
                      <Text style={styles.requestBtnText}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </Card>
          )}

          <Card style={styles.blockCard} padding="md">
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Recent Conversations</Text>
            {filteredConversations.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchQuery ? 'No matching conversations.' : 'No conversations yet.'}
              </Text>
            ) : (
              filteredConversations.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push({ pathname: '/chat-thread', params: { conversationId: item.id } })
                  }
                  style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                >
                  <View style={styles.avatarWrap}>
                    {item.peer_avatar_url ? (
                      <Image source={{ uri: item.peer_avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: `${colors.primary}16` }]}>
                        <Text style={[styles.avatarText, { color: colors.primary }]}>
                          {(item.peer_name || 'P').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {item.peer_is_online && (
                      <View style={[styles.onlineDot, { backgroundColor: '#22c55e', borderColor: colors.surfaceVariant }]} />
                    )}
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

          {filteredGroups.length > 0 && (
            <Card style={styles.blockCard} padding="md">
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Group Chats</Text>
              {filteredGroups.map((group) => (
                <Pressable
                  key={group.id}
                  onPress={() => router.push({ pathname: '/group-chat', params: { groupId: group.id } })}
                  style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                >
                  {group.avatar_url ? (
                    <Image source={{ uri: group.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: `${colors.secondary}16` }]}>
                      <Text style={[styles.avatarText, { color: colors.secondary }]}>
                        {(group.name || 'G').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowMain}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {group.name}
                    </Text>
                    <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {group.last_message || `${group.member_count ?? '?'} members`}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowTime, { color: colors.textTertiary }]}>
                      {formatPreviewTime(group.last_message_at)}
                    </Text>
                    {(group.unread_count ?? 0) > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                        <Text style={styles.badgeText}>{(group.unread_count ?? 0) > 99 ? '99+' : group.unread_count}</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))}
            </Card>
          )}

          <Card style={styles.blockCard} padding="md">
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Connected Players</Text>
            {targets.map((peer) => (
              <Pressable
                key={peer.id}
                onPress={() => openConversation(peer.id)}
                style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                {peer.avatar_url ? (
                  <Image source={{ uri: peer.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: `${colors.secondary}16` }]}>
                    <Text style={[styles.avatarText, { color: colors.secondary }]}>
                      {(peer.display_name || peer.username || 'P').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, paddingVertical: 2 },
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
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  newGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  newGroupText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
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
  requestBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestBtnText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
});
