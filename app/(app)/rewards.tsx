import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getCurrentLevelProgress } from '@/lib/xp';
import { getUserAchievements, getAllBadges } from '@/lib/achievements';
import { getDailyRewardStatus, claimDailyReward } from '@/lib/dailyRewards';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { XPProgressBar } from '@/components/rewards/XPProgressBar';
import { DailyRewardCalendar } from '@/components/rewards/DailyRewardCalendar';
import { BadgeGrid } from '@/components/rewards/BadgeGrid';
import { LevelUpModal } from '@/components/rewards/LevelUpModal';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { AvailableBadge } from '@/lib/types';

export default function Rewards() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [levelInfo, setLevelInfo] = useState({ level: 1, xp: 0, xpForCurrent: 0, xpForNext: 100, progress: 0, title: 'Newcomer' });
  const [dailyStatus, setDailyStatus] = useState<Awaited<ReturnType<typeof getDailyRewardStatus>> | null>(null);
  const [allBadges, setAllBadges] = useState<AvailableBadge[]>([]);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState({ level: 1, title: '' });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      setUserId(uid);

      const [level, daily, badges, earned] = await Promise.all([
        getCurrentLevelProgress(uid),
        getDailyRewardStatus(uid),
        getAllBadges(),
        getUserAchievements(uid),
      ]);

      setLevelInfo(level);
      setDailyStatus(daily);
      setAllBadges(badges);
      setEarnedIds(new Set(earned.map((e) => e.badge_id)));
    } catch (e) {
      console.error('Rewards load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimDaily() {
    if (!userId) return;
    const result = await claimDailyReward(userId);
    if (result) {
      // Refresh data
      await loadData();
    }
  }

  const earnedCount = earnedIds.size;
  const totalCount = allBadges.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.backgroundLayer} pointerEvents="none">
        <View style={[styles.bgOrb, { backgroundColor: `${colors.primary}14` }]} />
      </View>

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Rewards</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Level up, collect badges, and claim daily rewards
        </Text>
      </View>

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
          <Card style={styles.levelCard} padding="lg">
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-half-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Level Progress</Text>
            </View>
            <XPProgressBar {...levelInfo} />
            <View style={styles.xpStatsRow}>
              <View style={[styles.xpStat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.xpStatValue, { color: colors.primary }]}>{levelInfo.xp}</Text>
                <Text style={[styles.xpStatLabel, { color: colors.textSecondary }]}>Total XP</Text>
              </View>
              <View style={[styles.xpStat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.xpStatValue, { color: colors.text }]}>{levelInfo.level}</Text>
                <Text style={[styles.xpStatLabel, { color: colors.textSecondary }]}>Level</Text>
              </View>
            </View>
          </Card>

          {dailyStatus && (
            <Card style={styles.dailyCard} padding="lg">
              <DailyRewardCalendar
                calendar={dailyStatus.calendar}
                onClaim={handleClaimDaily}
                claimable={!dailyStatus.todayClaimed}
              />
              {dailyStatus.loginStreak > 0 && (
                <View style={[styles.streakRow, { backgroundColor: `${colors.warning}12` }]}>
                  <Ionicons name="flame" size={16} color={colors.warning} />
                  <Text style={[styles.streakText, { color: colors.warning }]}>
                    {dailyStatus.loginStreak}-day login streak
                  </Text>
                </View>
              )}
            </Card>
          )}

          <Card style={styles.badgesCard} padding="lg">
            <View style={styles.sectionHeader}>
              <Ionicons name="ribbon-outline" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Badges</Text>
              <Text style={[styles.badgeCount, { color: colors.textSecondary }]}>
                {earnedCount}/{totalCount}
              </Text>
            </View>
            <BadgeGrid badges={allBadges.slice(0, 6)} earnedIds={earnedIds} />
            {allBadges.length > 6 && (
              <Button
                title="View All Badges"
                onPress={() => router.push('/badges')}
                variant="outline"
                fullWidth
                style={{ marginTop: spacing.md }}
              />
            )}
          </Card>

          <Button
            title="Customize Avatar"
            onPress={() => router.push('/avatar-customization')}
            variant="gradient"
            fullWidth
            size="lg"
            style={{ marginBottom: spacing.md }}
          />

          <View style={{ height: spacing.xxl + 70 }} />
        </ScrollView>
      )}

      <LevelUpModal
        visible={showLevelUp}
        level={levelUpData.level}
        title={levelUpData.title}
        onClose={() => setShowLevelUp(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundLayer: { ...StyleSheet.absoluteFillObject },
  bgOrb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -90,
    right: -70,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  levelCard: { marginBottom: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, flex: 1 },
  xpStatsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  xpStat: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  xpStatValue: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  xpStatLabel: { fontSize: fontSize.xs, marginTop: 2 },
  dailyCard: { marginBottom: spacing.md },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  streakText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  badgesCard: { marginBottom: spacing.md },
  badgeCount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
