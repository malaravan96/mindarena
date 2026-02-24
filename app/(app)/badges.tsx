import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getAllBadges, getUserAchievements } from '@/lib/achievements';
import { BadgeGrid } from '@/components/rewards/BadgeGrid';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { AvailableBadge } from '@/lib/types';

type CategoryFilter = 'all' | string;

export default function Badges() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [allBadges, setAllBadges] = useState<AvailableBadge[]>([]);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<CategoryFilter>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;

      const [badges, earned] = await Promise.all([
        getAllBadges(),
        getUserAchievements(uid),
      ]);

      setAllBadges(badges);
      setEarnedIds(new Set(earned.map((e) => e.badge_id)));
    } catch (e) {
      console.error('Badge load error:', e);
    } finally {
      setLoading(false);
    }
  }

  const categories = ['all', ...new Set(allBadges.map((b) => b.category))];
  const filtered = filter === 'all' ? allBadges : allBadges.filter((b) => b.category === filter);
  const earnedCount = allBadges.filter((b) => earnedIds.has(b.id)).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Badge Collection</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {earnedCount}/{allBadges.length} earned
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {categories.map((cat) => {
          const active = filter === cat;
          return (
            <Pressable
              key={cat}
              onPress={() => setFilter(cat)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? `${colors.primary}15` : colors.surface,
                  borderColor: active ? `${colors.primary}40` : colors.border,
                },
              ]}
            >
              <Text style={[styles.filterText, { color: active ? colors.primary : colors.textSecondary }]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
          showsVerticalScrollIndicator={false}
        >
          <BadgeGrid badges={filtered} earnedIds={earnedIds} />
          <View style={{ height: spacing.xxl + 70 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  filterScroll: { flexGrow: 0 },
  filterRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
});
