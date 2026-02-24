import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getTournament, registerForTournament, isRegistered, getTournamentLeaderboard, getTournamentRounds } from '@/lib/tournaments';
import { useTournamentRealtime } from '@/hooks/useTournamentRealtime';
import { TournamentLeaderboard } from '@/components/tournament/TournamentLeaderboard';
import { CountdownTimer } from '@/components/tournament/CountdownTimer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { showAlert } from '@/lib/alert';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { Tournament, TournamentRound } from '@/lib/types';

export default function TournamentDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registered, setRegistered] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const { leaderboard } = useTournamentRealtime(id ?? null);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    if (!id) return;
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);

      const [t, roundsData] = await Promise.all([
        getTournament(id),
        getTournamentRounds(id),
      ]);

      setTournament(t);
      setRounds(roundsData);

      if (uid && t) {
        const reg = await isRegistered(id, uid);
        setRegistered(reg);
      }
    } catch (e) {
      console.error('Tournament detail error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!id || !userId || !tournament) return;
    try {
      const success = await registerForTournament(id, userId);
      if (success) {
        setRegistered(true);
        showAlert('Registered!', `You're registered for ${tournament.title}`);
      } else {
        showAlert('Already registered', 'You are already in this tournament');
      }
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to register');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingWrap}>
          <Text style={[styles.errorText, { color: colors.error }]}>Tournament not found</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const leaderboardWithProfiles = leaderboard.map((p) => ({
    ...p,
    username: undefined,
    display_name: undefined,
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{tournament.title}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        <Card padding="lg" style={styles.infoCard}>
          <Text style={[styles.tournTitle, { color: colors.text }]}>{tournament.title}</Text>
          {tournament.description ? (
            <Text style={[styles.tournDesc, { color: colors.textSecondary }]}>{tournament.description}</Text>
          ) : null}

          <View style={styles.statsRow}>
            <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="people-outline" size={16} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{tournament.participant_count}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Players</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="sparkles-outline" size={16} color={colors.warning} />
              <Text style={[styles.statValue, { color: colors.text }]}>{tournament.prize_xp}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>XP Prize</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="layers-outline" size={16} color={colors.secondary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{rounds.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rounds</Text>
            </View>
          </View>

          <CountdownTimer
            targetDate={tournament.status === 'upcoming' ? tournament.starts_at : tournament.ends_at}
            label={tournament.status === 'upcoming' ? 'Starts in' : 'Ends in'}
          />

          {!registered && tournament.status !== 'completed' && (
            <Button title="Register" onPress={handleRegister} variant="gradient" fullWidth size="lg" style={{ marginTop: spacing.md }} />
          )}
          {registered && (
            <View style={[styles.registeredBadge, { backgroundColor: `${colors.correct}12` }]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.correct} />
              <Text style={[styles.registeredText, { color: colors.correct }]}>Registered</Text>
            </View>
          )}
        </Card>

        <Card padding="lg" style={styles.leaderboardCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Leaderboard</Text>
          {leaderboard.length > 0 ? (
            <TournamentLeaderboard participants={leaderboardWithProfiles} currentUserId={userId ?? undefined} />
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No participants yet</Text>
          )}
        </Card>

        <View style={{ height: spacing.xxl + 70 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  errorText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  infoCard: { marginBottom: spacing.md },
  tournTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black, marginBottom: spacing.xs },
  tournDesc: { fontSize: fontSize.base, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stat: { flex: 1, padding: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center', gap: 4 },
  statValue: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  statLabel: { fontSize: fontSize.xs },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  registeredText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  leaderboardCard: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: spacing.md },
  emptyText: { fontSize: fontSize.base, textAlign: 'center' },
});
