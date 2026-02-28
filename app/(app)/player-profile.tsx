import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getPlayerProfile } from '@/lib/playerSearch';
import { getUserAchievements } from '@/lib/achievements';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { BadgeGrid } from '@/components/rewards/BadgeGrid';
import { showAlert } from '@/lib/alert';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { AvailableBadge } from '@/lib/types';

export default function PlayerProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<any>(null);
  const [badges, setBadges] = useState<AvailableBadge[]>([]);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const profile = await getPlayerProfile(id!);
      setPlayer(profile);

      if (profile) {
        const earned = await getUserAchievements(id!);
        setBadges(earned.map((e) => e.badge));
        setEarnedIds(new Set(earned.map((e) => e.badge_id)));
      }
    } catch (e) {
      console.error('Player profile error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid || !id) return;

      const { error } = await supabase.from('user_connections').insert({
        requester_id: uid,
        target_id: id,
        status: 'pending',
      });

      if (error) {
        if (error.code === '23505') {
          showAlert('Already sent', 'Connection request already sent');
        } else {
          throw error;
        }
      } else {
        showAlert('Request sent!', 'Connection request has been sent');
      }
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to send request');
    }
  }

  const initials = player?.display_name
    ? player.display_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Player Profile</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !player ? (
        <View style={styles.loadingWrap}>
          <Text style={[styles.errorText, { color: colors.error }]}>Player not found</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
          showsVerticalScrollIndicator={false}
        >
          <Card padding="lg" style={styles.heroCard}>
            <View style={styles.profileRow}>
              {player.avatar_url ? (
                <Image source={{ uri: player.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.profileInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.profileName, { color: colors.text }]}>
                    {player.display_name || player.username || 'Player'}
                  </Text>
                  {player.is_online && <View style={[styles.onlineDot, { backgroundColor: colors.correct }]} />}
                </View>
                {player.title && (
                  <Text style={[styles.titleText, { color: colors.primary }]}>{player.title}</Text>
                )}
                {player.username && (
                  <Text style={[styles.usernameText, { color: colors.textSecondary }]}>@{player.username}</Text>
                )}
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{player.level ?? 1}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Level</Text>
              </View>
              <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.statValue, { color: colors.warning }]}>{player.total_points}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Points</Text>
              </View>
              <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.statValue, { color: colors.correct }]}>{player.streak_count}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Streak</Text>
              </View>
            </View>
          </Card>

          <View style={styles.actionsRow}>
            <Button title="Connect" onPress={handleConnect} variant="gradient" style={{ flex: 1 }} />
            <Button
              title="Challenge"
              onPress={() => {
                if (!id) return;
                const targetName = player?.display_name || player?.username || 'Player';
                router.push({ pathname: '/pvp', params: { challengePlayerId: id, challengePlayerName: targetName } });
              }}
              variant="outline"
              style={{ flex: 1 }}
            />
          </View>

          {badges.length > 0 && (
            <Card padding="lg" style={styles.badgesCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Badges ({earnedIds.size})</Text>
              <BadgeGrid badges={badges} earnedIds={earnedIds} />
            </Card>
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
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  heroCard: { marginBottom: spacing.md },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  profileName: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  titleText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: 2 },
  usernameText: { fontSize: fontSize.sm, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, padding: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  statLabel: { fontSize: fontSize.xs, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  badgesCard: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: spacing.md },
});
