import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable,
         ActivityIndicator, Image, TextInput, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';
import { getCurrentUserId, getOrCreateConversation, listConversations, listMessageTargets } from '@/lib/dm';
import { useGlobalNotifications } from '@/contexts/GlobalNotificationsContext';
import { listGroupConversations } from '@/lib/groupChat';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_CHAT_LIST_PREFS,
  hasChatListPrefsValues,
  parseChatListPrefs,
  queueChatListPrefsSave,
  readChatListPrefs,
  type ChatListPrefs,
} from '@/lib/chatListPrefs';
import type { ConnectionWithProfile, DmConversation, GroupConversation } from '@/lib/types';
import { listConnections, acceptChatRequest, declineChatRequest } from '@/lib/connections';
import { getItem, setItem } from '@/lib/storage';

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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'dms' | 'groups'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chatPrefs, setChatPrefs] = useState<ChatListPrefs>(DEFAULT_CHAT_LIST_PREFS);

  const prefsKey = useMemo(
    () => (userId ? `chat_list_prefs_${userId}` : null),
    [userId],
  );
  const pinnedDmSet = useMemo(() => new Set(chatPrefs.pinnedDmIds), [chatPrefs.pinnedDmIds]);
  const mutedDmSet = useMemo(() => new Set(chatPrefs.mutedDmIds), [chatPrefs.mutedDmIds]);
  const archivedDmSet = useMemo(() => new Set(chatPrefs.archivedDmIds), [chatPrefs.archivedDmIds]);
  const pinnedGroupSet = useMemo(() => new Set(chatPrefs.pinnedGroupIds), [chatPrefs.pinnedGroupIds]);
  const mutedGroupSet = useMemo(() => new Set(chatPrefs.mutedGroupIds), [chatPrefs.mutedGroupIds]);
  const archivedGroupSet = useMemo(
    () => new Set(chatPrefs.archivedGroupIds),
    [chatPrefs.archivedGroupIds],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!prefsKey || !userId) return;
    let active = true;

    (async () => {
      const localPrefs = parseChatListPrefs(await getItem(prefsKey));
      if (!active) return;
      setChatPrefs(localPrefs);

      try {
        const serverPrefs = await readChatListPrefs(userId);
        if (!active) return;
        if (serverPrefs) {
          setChatPrefs(serverPrefs);
          void setItem(prefsKey, JSON.stringify(serverPrefs));
          return;
        }
        if (hasChatListPrefsValues(localPrefs)) {
          void queueChatListPrefsSave(userId, localPrefs).catch(() => undefined);
        }
      } catch {
        // Keep local fallback if server read fails.
      }
    })();

    return () => {
      active = false;
    };
  }, [prefsKey, userId]);

  const searchTerm = debouncedSearchQuery.toLowerCase().trim();

  const titleCount = useMemo(
    () =>
      conversations.reduce((sum, c) => {
        if (archivedDmSet.has(c.id) || mutedDmSet.has(c.id)) return sum;
        return sum + c.unread_count;
      }, 0) +
      groups.reduce((sum, g) => {
        if (archivedGroupSet.has(g.id) || mutedGroupSet.has(g.id)) return sum;
        return sum + (g.unread_count ?? 0);
      }, 0),
    [archivedDmSet, archivedGroupSet, conversations, groups, mutedDmSet, mutedGroupSet],
  );

  const visibleConversations = useMemo(
    () =>
      conversations.filter((c) =>
        showArchived ? archivedDmSet.has(c.id) : !archivedDmSet.has(c.id),
      ),
    [archivedDmSet, conversations, showArchived],
  );

  const visibleGroups = useMemo(
    () =>
      groups.filter((g) =>
        showArchived ? archivedGroupSet.has(g.id) : !archivedGroupSet.has(g.id),
      ),
    [archivedGroupSet, groups, showArchived],
  );

  const filteredConversations = useMemo(() => {
    const searched = !searchTerm
      ? visibleConversations
      : visibleConversations.filter(
          (c) =>
            c.peer_name.toLowerCase().includes(searchTerm) ||
            (c.last_message ?? '').toLowerCase().includes(searchTerm),
        );

    return [...searched].sort((a, b) => {
      const pinDelta = Number(pinnedDmSet.has(b.id)) - Number(pinnedDmSet.has(a.id));
      if (pinDelta !== 0) return pinDelta;
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [pinnedDmSet, searchTerm, visibleConversations]);

  const filteredGroups = useMemo(() => {
    const searched = !searchTerm
      ? visibleGroups
      : visibleGroups.filter(
          (g) =>
            g.name.toLowerCase().includes(searchTerm) ||
            (g.last_message ?? '').toLowerCase().includes(searchTerm),
        );

    return [...searched].sort((a, b) => {
      const pinDelta = Number(pinnedGroupSet.has(b.id)) - Number(pinnedGroupSet.has(a.id));
      if (pinDelta !== 0) return pinDelta;
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [pinnedGroupSet, searchTerm, visibleGroups]);

  const quickStartTargets = useMemo(() => {
    if (!searchTerm) return targets.slice(0, 12);
    return targets
      .filter((peer) => {
        const name = (peer.display_name || peer.username || '').toLowerCase();
        return name.includes(searchTerm);
      })
      .slice(0, 8);
  }, [searchTerm, targets]);

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

  const updatePrefs = useCallback((updater: (prev: ChatListPrefs) => ChatListPrefs) => {
    setChatPrefs((prev) => {
      const next = updater(prev);
      if (prefsKey) {
        void setItem(prefsKey, JSON.stringify(next));
      }
      if (userId) {
        void queueChatListPrefsSave(userId, next).catch(() => undefined);
      }
      return next;
    });
  }, [prefsKey, userId]);

  const toggleListValue = useCallback(
    (key: keyof ChatListPrefs, id: string) => {
      updatePrefs((prev) => {
        const source = prev[key];
        const exists = source.includes(id);
        const nextValues = exists
          ? source.filter((value) => value !== id)
          : [...source, id];
        return { ...prev, [key]: nextValues };
      });
    },
    [updatePrefs],
  );

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
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'group_messages' },
          () => loadData(uid),
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_list_preferences',
            filter: `user_id=eq.${uid}`,
          },
          () => {
            void readChatListPrefs(uid)
              .then((prefs) => {
                if (!mounted || !prefs) return;
                setChatPrefs(prefs);
                void setItem(`chat_list_prefs_${uid}`, JSON.stringify(prefs));
              })
              .catch(() => undefined);
          },
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
    try {
      const id = await getOrCreateConversation(peerUserId);
      router.push({ pathname: '/chat-thread', params: { conversationId: id } });
    } catch {
      if (userId) loadData(userId);
    }
  }

  function smartFormatTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 86400000);
    if (date >= startOfToday)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (date >= startOfYesterday) return 'Yesterday';
    if (date >= startOfWeek) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function renderAvatarWithDot(
    avatarUrl: string | null | undefined,
    name: string,
    isOnline: boolean | undefined,
  ) {
    return (
      <View style={styles.avatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}20` }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {(name || 'P').slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.onlineDot,
            {
              backgroundColor: isOnline ? '#22c55e' : colors.textTertiary,
              borderColor: colors.surface,
            },
          ]}
        />
      </View>
    );
  }

  const toggleDmArchive = useCallback((id: string) => {
    updatePrefs((prev) => {
      const isArchived = prev.archivedDmIds.includes(id);
      return {
        ...prev,
        archivedDmIds: isArchived
          ? prev.archivedDmIds.filter((value) => value !== id)
          : [...prev.archivedDmIds, id],
        pinnedDmIds: prev.pinnedDmIds.filter((value) => value !== id),
      };
    });
  }, [updatePrefs]);

  const toggleGroupArchive = useCallback((id: string) => {
    updatePrefs((prev) => {
      const isArchived = prev.archivedGroupIds.includes(id);
      return {
        ...prev,
        archivedGroupIds: isArchived
          ? prev.archivedGroupIds.filter((value) => value !== id)
          : [...prev.archivedGroupIds, id],
        pinnedGroupIds: prev.pinnedGroupIds.filter((value) => value !== id),
      };
    });
  }, [updatePrefs]);

  function renderSwipeActions(
    accent: string,
    actions: Array<{
      key: string;
      icon: React.ComponentProps<typeof Ionicons>['name'];
      label: string;
      onPress: () => void;
    }>,
  ) {
    return (
      <View style={styles.swipeActionRow}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            style={[styles.swipeActionBtn, { backgroundColor: `${accent}14`, borderColor: `${accent}3a` }]}
          >
            <Ionicons name={action.icon} size={16} color={accent} />
            <Text style={[styles.swipeActionText, { color: accent }]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const uid = userId ?? (await getCurrentUserId());
      if (uid) {
        if (!userId) setUserId(uid);
        await loadData(uid);
        refreshUnread();
      }
    } finally {
      setRefreshing(false);
    }
  }, [userId, loadData, refreshUnread]);

  const showDms = activeTab === 'all' || activeTab === 'dms';
  const showGroups = activeTab === 'all' || activeTab === 'groups';
  const hasDms = filteredConversations.length > 0;
  const hasGroups = filteredGroups.length > 0;
  const hasTargets = quickStartTargets.length > 0;
  const isCompletelyEmpty =
    !loading &&
    conversations.length === 0 &&
    groups.length === 0 &&
    targets.length === 0 &&
    pendingRequests.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chat</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {titleCount > 0 && (
            <View style={[styles.unreadPill, { backgroundColor: `${colors.primary}16` }]}>
              <Ionicons name="mail-unread-outline" size={13} color={colors.primary} />
              <Text style={[styles.unreadPillText, { color: colors.primary }]}>{titleCount} unread</Text>
            </View>
          )}
          <Pressable
            onPress={() => router.push('/create-group')}
            style={[styles.iconBtn, { backgroundColor: `${colors.secondary}16` }]}
          >
            <Ionicons name="people-outline" size={18} color={colors.secondary} />
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
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
      {searchQuery !== debouncedSearchQuery && (
        <Text style={[styles.searchingText, { color: colors.textSecondary }]}>Searching…</Text>
      )}

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        {(['all', 'dms', 'groups'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabPill,
              activeTab === tab
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.surfaceVariant, borderColor: colors.border, borderWidth: 1 },
            ]}
          >
            <Text
              style={[
                styles.tabPillText,
                { color: activeTab === tab ? '#fff' : colors.textSecondary },
              ]}
            >
              {tab === 'all' ? 'All' : tab === 'dms' ? 'DMs' : 'Groups'}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setShowArchived((prev) => !prev)}
          style={[
            styles.archiveTogglePill,
            showArchived
              ? { backgroundColor: `${colors.warning}16`, borderColor: `${colors.warning}4a` }
              : { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name={showArchived ? 'archive' : 'archive-outline'}
            size={13}
            color={showArchived ? colors.warning : colors.textSecondary}
          />
          <Text
            style={[
              styles.archiveToggleText,
              { color: showArchived ? colors.warning : colors.textSecondary },
            ]}
          >
            {showArchived ? 'Archived' : 'Inbox'}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Chat Requests */}
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

          {/* Direct Messages — BUG FIX: renders filteredConversations */}
          {showDms && (
            <Card style={styles.blockCard} padding="md">
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: colors.text, marginBottom: 0 }]}>Direct Messages</Text>
                <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>
                  Swipe left for actions
                </Text>
              </View>
              {hasDms
                ? filteredConversations.map((conv) => {
                    const isPinned = pinnedDmSet.has(conv.id);
                    const isMuted = mutedDmSet.has(conv.id);
                    const isUnread = conv.unread_count > 0;
                    const row = (
                      <Pressable
                        onPress={() =>
                          router.push({ pathname: '/chat-thread', params: { conversationId: conv.id } })
                        }
                        style={[
                          styles.row,
                          {
                            borderColor:
                              isPinned
                                ? `${colors.warning}45`
                                : isUnread
                                  ? `${colors.primary}40`
                                  : colors.border,
                            backgroundColor: isUnread ? `${colors.primary}08` : colors.surfaceVariant,
                          },
                        ]}
                      >
                        {renderAvatarWithDot(conv.peer_avatar_url, conv.peer_name, conv.peer_is_online)}
                        <View style={styles.rowMain}>
                          <View style={styles.rowTitleLine}>
                            {isPinned && (
                              <Ionicons name="pin" size={12} color={colors.warning} />
                            )}
                            <Text
                              style={[
                                styles.rowTitle,
                                {
                                  color: colors.text,
                                  fontWeight: isUnread ? fontWeight.bold : fontWeight.semibold,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {conv.peer_name}
                            </Text>
                            {isMuted && <Ionicons name="volume-mute" size={13} color={colors.textTertiary} />}
                          </View>
                          <Text
                            style={[
                              styles.rowSubtitle,
                              {
                                color: isUnread ? colors.textSecondary : colors.textTertiary,
                                fontWeight: isUnread ? fontWeight.medium : fontWeight.normal,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {conv.last_message || '[Encrypted]'}
                          </Text>
                        </View>
                        <View style={styles.rowRight}>
                          <Text style={[styles.rowTime, { color: colors.textTertiary }]}>
                            {smartFormatTime(conv.last_message_at)}
                          </Text>
                          {isUnread && !isMuted && (
                            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                              <Text style={styles.badgeText}>
                                {conv.unread_count > 99 ? '99+' : conv.unread_count}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    );

                    if (Platform.OS === 'web') {
                      return <View key={conv.id}>{row}</View>;
                    }

                    return (
                      <Swipeable
                        key={conv.id}
                        overshootRight={false}
                        rightThreshold={28}
                        renderRightActions={() =>
                          renderSwipeActions(colors.primary, [
                            {
                              key: 'pin',
                              icon: isPinned ? 'pin' : 'pin-outline',
                              label: isPinned ? 'Unpin' : 'Pin',
                              onPress: () => toggleListValue('pinnedDmIds', conv.id),
                            },
                            {
                              key: 'mute',
                              icon: isMuted ? 'volume-high-outline' : 'volume-mute-outline',
                              label: isMuted ? 'Unmute' : 'Mute',
                              onPress: () => toggleListValue('mutedDmIds', conv.id),
                            },
                            {
                              key: 'archive',
                              icon: showArchived ? 'archive-outline' : 'archive',
                              label: showArchived ? 'Restore' : 'Archive',
                              onPress: () => toggleDmArchive(conv.id),
                            },
                          ])
                        }
                      >
                        {row}
                      </Swipeable>
                    );
                  })
                : visibleConversations.length === 0
                  ? (
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                      {showArchived
                        ? 'No archived direct messages.'
                        : 'No direct messages yet. Start a conversation below.'}
                    </Text>
                  )
                  : (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No chats matching "{debouncedSearchQuery.trim()}"
                    </Text>
                  )}
            </Card>
          )}

          {/* Group Chats */}
          {showGroups && (
            <Card style={styles.blockCard} padding="md">
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: colors.text, marginBottom: 0 }]}>Group Chats</Text>
                <Text style={[styles.sectionMeta, { color: colors.textSecondary }]}>
                  Swipe left for actions
                </Text>
              </View>
              {hasGroups
                ? filteredGroups.map((group) => {
                    const isPinned = pinnedGroupSet.has(group.id);
                    const isMuted = mutedGroupSet.has(group.id);
                    const unread = (group.unread_count ?? 0) > 0;
                    const row = (
                      <Pressable
                        onPress={() => router.push({ pathname: '/group-chat', params: { groupId: group.id } })}
                        style={[
                          styles.row,
                          {
                            borderColor:
                              isPinned
                                ? `${colors.warning}45`
                                : unread
                                  ? `${colors.secondary}40`
                                  : colors.border,
                            backgroundColor: unread ? `${colors.secondary}08` : colors.surfaceVariant,
                          },
                        ]}
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
                          <View style={styles.rowTitleLine}>
                            {isPinned && (
                              <Ionicons name="pin" size={12} color={colors.warning} />
                            )}
                            <Text
                              style={[
                                styles.rowTitle,
                                {
                                  color: colors.text,
                                  fontWeight: unread ? fontWeight.bold : fontWeight.semibold,
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {group.name}
                            </Text>
                            {isMuted && <Ionicons name="volume-mute" size={13} color={colors.textTertiary} />}
                          </View>
                          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                            {group.last_message || `${group.member_count ?? '?'} members`}
                          </Text>
                        </View>
                        <View style={styles.rowRight}>
                          <Text style={[styles.rowTime, { color: colors.textTertiary }]}>
                            {smartFormatTime(group.last_message_at)}
                          </Text>
                          {unread && !isMuted && (
                            <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                              <Text style={styles.badgeText}>
                                {(group.unread_count ?? 0) > 99 ? '99+' : group.unread_count}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    );

                    if (Platform.OS === 'web') {
                      return <View key={group.id}>{row}</View>;
                    }

                    return (
                      <Swipeable
                        key={group.id}
                        overshootRight={false}
                        rightThreshold={28}
                        renderRightActions={() =>
                          renderSwipeActions(colors.secondary, [
                            {
                              key: 'pin',
                              icon: isPinned ? 'pin' : 'pin-outline',
                              label: isPinned ? 'Unpin' : 'Pin',
                              onPress: () => toggleListValue('pinnedGroupIds', group.id),
                            },
                            {
                              key: 'mute',
                              icon: isMuted ? 'volume-high-outline' : 'volume-mute-outline',
                              label: isMuted ? 'Unmute' : 'Mute',
                              onPress: () => toggleListValue('mutedGroupIds', group.id),
                            },
                            {
                              key: 'archive',
                              icon: showArchived ? 'archive-outline' : 'archive',
                              label: showArchived ? 'Restore' : 'Archive',
                              onPress: () => toggleGroupArchive(group.id),
                            },
                          ])
                        }
                      >
                        {row}
                      </Swipeable>
                    );
                  })
                : (
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {showArchived
                      ? 'No archived groups.'
                      : searchTerm
                        ? `No groups matching "${debouncedSearchQuery.trim()}".`
                        : 'No groups found.'}
                  </Text>
                )}
            </Card>
          )}

          {/* Start a Conversation — horizontal chip scroll */}
          {showDms && (
            <View style={styles.newDmSection}>
              <View style={styles.quickStartHeader}>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: colors.text, marginBottom: 0, paddingHorizontal: spacing.sm },
                  ]}
                >
                  Start a Conversation
                </Text>
                <Pressable
                  onPress={() => router.push('/player-search')}
                  style={[styles.findPlayersBtn, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                >
                  <Ionicons name="search-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.findPlayersText, { color: colors.textSecondary }]}>Find players</Text>
                </Pressable>
              </View>
              {hasTargets ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {quickStartTargets.map((peer) => {
                    const name = peer.display_name || peer.username || 'Player';
                    return (
                      <Pressable key={peer.id} onPress={() => openConversation(peer.id)} style={styles.avatarChip}>
                        {peer.avatar_url ? (
                          <Image source={{ uri: peer.avatar_url }} style={styles.chipAvatar} />
                        ) : (
                          <View style={[styles.chipAvatarPlaceholder, { backgroundColor: `${colors.primary}20` }]}>
                            <Text style={[styles.chipAvatarText, { color: colors.primary }]}>
                              {name.slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text
                          style={[styles.chipName, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          {name.split(' ')[0]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {searchTerm ? 'No players matched this search.' : 'No quick contacts yet.'}
                </Text>
              )}
            </View>
          )}

          {/* Global empty state */}
          {isCompletelyEmpty && !searchTerm && !showArchived && (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={56} color={colors.textTertiary} />
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Chats Yet</Text>
              <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }]}>
                Connect with other players to start messaging.
              </Text>
            </View>
          )}

          {/* Sign in warning */}
          {!userId && (
            <Text style={[styles.emptyText, { color: colors.warning }]}>Sign in to use messaging.</Text>
          )}
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
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  searchingText: {
    fontSize: fontSize.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  tabPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tabPillText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  archiveTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  archiveToggleText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  scrollContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  blockCard: { borderRadius: borderRadius.xl },
  sectionLabel: { fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionMeta: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  emptyText: { fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.md },
  swipeActionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  swipeActionBtn: {
    minWidth: 64,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  swipeActionText: { fontSize: 10, fontWeight: fontWeight.semibold },
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
  rowMain: { flex: 1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  newDmSection: { gap: spacing.xs },
  quickStartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: spacing.sm,
    gap: spacing.sm,
  },
  findPlayersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  findPlayersText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  chipRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
    flexDirection: 'row',
  },
  avatarChip: { alignItems: 'center', gap: spacing.xs, width: 60 },
  chipAvatar: { width: 48, height: 48, borderRadius: 24 },
  chipAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  chipName: { fontSize: fontSize.xs, textAlign: 'center', maxWidth: 56 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl * 2, gap: spacing.sm },
  emptyStateTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  emptyStateSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
