import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getFriendsFeed, getEventDescription, getEventIcon } from '@/lib/activityFeed';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { ActivityFeedItem } from '@/lib/types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function ActivityFeed() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const data = await getFriendsFeed(uid);
      setFeed(data);
    } catch (e) {
      console.error('Feed error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Activity Feed</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>See what your friends are up to</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {feed.length === 0 ? (
            <Card padding="lg" style={styles.emptyCard}>
              <Ionicons name="newspaper-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No activity yet</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                Connect with friends to see their puzzle activity here.
              </Text>
            </Card>
          ) : (
            feed.map((event) => (
              <View key={event.id} style={[styles.feedItem, { borderColor: colors.border }]}>
                <View style={[styles.feedIcon, { backgroundColor: `${colors.primary}12` }]}>
                  <Ionicons name={getEventIcon(event.event_type) as IconName} size={18} color={colors.primary} />
                </View>
                <View style={styles.feedContent}>
                  <Text style={[styles.feedText, { color: colors.text }]}>{getEventDescription(event)}</Text>
                  <Text style={[styles.feedTime, { color: colors.textTertiary }]}>{timeAgo(event.created_at)}</Text>
                </View>
              </View>
            ))
          )}
          <View style={{ height: spacing.xxl + 70 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  emptyCard: { alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  emptyDesc: { fontSize: fontSize.base, textAlign: 'center' },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  feedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedContent: { flex: 1 },
  feedText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  feedTime: { fontSize: fontSize.xs, marginTop: 2 },
});
