import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getTournament, getTournamentLeaderboard } from '@/lib/tournaments';
import { TournamentLeaderboard } from '@/components/tournament/TournamentLeaderboard';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { Tournament, TournamentParticipant } from '@/lib/types';

export default function TournamentResults() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [leaderboard, setLeaderboard] = useState<(TournamentParticipant & { username?: string; display_name?: string })[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    if (!id) return;
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      setUserId(userData.user?.id ?? null);

      const [t, lb] = await Promise.all([
        getTournament(id),
        getTournamentLeaderboard(id),
      ]);

      setTournament(t);
      setLeaderboard(lb);
    } catch (e) {
      console.error('Tournament results error:', e);
    } finally {
      setLoading(false);
    }
  }

  const myResult = leaderboard.find((p) => p.user_id === userId);
  const myRank = myResult ? leaderboard.indexOf(myResult) + 1 : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Tournament Results</Text>
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
        >
          {tournament && (
            <Card padding="lg" style={styles.summaryCard}>
              <Ionicons name="trophy" size={48} color="#f59e0b" style={{ alignSelf: 'center' }} />
              <Text style={[styles.tournTitle, { color: colors.text }]}>{tournament.title}</Text>
              <Text style={[styles.tournStatus, { color: colors.textSecondary }]}>
                {tournament.status === 'completed' ? 'Completed' : 'In progress'}
              </Text>
              {myRank && (
                <View style={[styles.myRankCard, { backgroundColor: `${colors.primary}10` }]}>
                  <Text style={[styles.myRankLabel, { color: colors.textSecondary }]}>Your Rank</Text>
                  <Text style={[styles.myRankValue, { color: colors.primary }]}>#{myRank}</Text>
                  <Text style={[styles.myRankScore, { color: colors.textSecondary }]}>Score: {myResult?.total_score ?? 0}</Text>
                </View>
              )}
            </Card>
          )}

          <Card padding="lg" style={styles.leaderboardCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Final Rankings</Text>
            <TournamentLeaderboard participants={leaderboard} currentUserId={userId ?? undefined} />
          </Card>

          <Button title="Back to Tournaments" onPress={() => router.push('/tournaments')} variant="outline" fullWidth />

          <View style={{ height: spacing.xxl + 70 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  summaryCard: { marginBottom: spacing.md, alignItems: 'center', gap: spacing.sm },
  tournTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  tournStatus: { fontSize: fontSize.sm },
  myRankCard: { width: '100%', padding: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.sm },
  myRankLabel: { fontSize: fontSize.sm },
  myRankValue: { fontSize: fontSize['3xl'], fontWeight: fontWeight.black },
  myRankScore: { fontSize: fontSize.sm, marginTop: 2 },
  leaderboardCard: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: spacing.md },
});
