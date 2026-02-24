import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getUserTeam, getTopTeams } from '@/lib/teams';
import { createTeamChallenge, getTeamChallenges } from '@/lib/teamChallenges';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { showAlert } from '@/lib/alert';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { Team, TeamChallenge } from '@/lib/types';

export default function TeamChallengeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [challenges, setChallenges] = useState<(TeamChallenge & { challenger_team?: Team; opponent_team?: Team })[]>([]);
  const [challenging, setChallenging] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;

      const team = await getUserTeam(uid);
      setMyTeam(team);

      if (team) {
        const [allTeams, teamChallenges] = await Promise.all([
          getTopTeams(30),
          getTeamChallenges(team.id),
        ]);

        setTeams(allTeams.filter((t) => t.id !== team.id));
        setChallenges(teamChallenges);
      } else {
        const allTeams = await getTopTeams(30);
        setTeams(allTeams);
      }
    } catch (e) {
      console.error('Team challenge error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleChallenge(opponentTeamId: string) {
    if (!myTeam) {
      showAlert('No Team', 'You need to be in a team to challenge others');
      return;
    }
    setChallenging(opponentTeamId);
    try {
      await createTeamChallenge(myTeam.id, opponentTeamId);
      showAlert('Challenge Sent!', 'The team has been challenged');
      await loadData();
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to send challenge');
    } finally {
      setChallenging(null);
    }
  }

  const activeChallenges = challenges.filter((c) => c.status !== 'completed');
  const completedChallenges = challenges.filter((c) => c.status === 'completed');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Team Challenges</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Challenge other teams</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !myTeam ? (
        <View style={styles.loadingWrap}>
          <Card padding="lg" style={styles.emptyCard}>
            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Join a Team First</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              You need to be in a team to participate in team challenges.
            </Text>
            <Button
              title="Find Teams"
              onPress={() => router.push('/teams')}
              variant="gradient"
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
          showsVerticalScrollIndicator={false}
        >
          {activeChallenges.length > 0 && (
            <Card padding="lg" style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Challenges</Text>
              {activeChallenges.map((challenge) => {
                const isChallenger = challenge.challenger_team_id === myTeam.id;
                const opponentName = isChallenger
                  ? challenge.opponent_team?.name ?? 'Unknown'
                  : challenge.challenger_team?.name ?? 'Unknown';

                return (
                  <View key={challenge.id} style={[styles.challengeRow, { borderColor: colors.border }]}>
                    <View style={[styles.challengeIcon, { backgroundColor: `${colors.warning}15` }]}>
                      <Ionicons name="flash-outline" size={16} color={colors.warning} />
                    </View>
                    <View style={styles.challengeInfo}>
                      <Text style={[styles.challengeVs, { color: colors.text }]}>vs {opponentName}</Text>
                      <Text style={[styles.challengeMeta, { color: colors.textSecondary }]}>
                        {challenge.challenger_score} - {challenge.opponent_score} - {challenge.status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          )}

          <Card padding="lg" style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Challenge a Team</Text>
            {teams.map((team) => (
              <View key={team.id} style={[styles.teamRow, { borderColor: colors.border }]}>
                <View style={[styles.teamAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.teamAvatarText}>{team.name[0]?.toUpperCase()}</Text>
                </View>
                <View style={styles.teamInfo}>
                  <Text style={[styles.teamName, { color: colors.text }]}>{team.name}</Text>
                  <Text style={[styles.teamMeta, { color: colors.textSecondary }]}>
                    {team.member_count} members - {team.total_points} pts
                  </Text>
                </View>
                <Button
                  title={challenging === team.id ? '...' : 'Challenge'}
                  onPress={() => handleChallenge(team.id)}
                  variant="outline"
                  disabled={challenging === team.id}
                  size="sm"
                />
              </View>
            ))}
          </Card>

          {completedChallenges.length > 0 && (
            <Card padding="lg" style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Past Challenges</Text>
              {completedChallenges.slice(0, 10).map((challenge) => {
                const isChallenger = challenge.challenger_team_id === myTeam.id;
                const opponentName = isChallenger
                  ? challenge.opponent_team?.name ?? 'Unknown'
                  : challenge.challenger_team?.name ?? 'Unknown';
                const won = challenge.winner_team_id === myTeam.id;
                const myScore = isChallenger ? challenge.challenger_score : challenge.opponent_score;
                const theirScore = isChallenger ? challenge.opponent_score : challenge.challenger_score;

                return (
                  <View key={challenge.id} style={[styles.challengeRow, { borderColor: colors.border }]}>
                    <View
                      style={[
                        styles.challengeIcon,
                        { backgroundColor: won ? `${colors.correct}15` : `${colors.wrong}15` },
                      ]}
                    >
                      <Ionicons
                        name={won ? 'trophy-outline' : 'close-circle-outline'}
                        size={16}
                        color={won ? colors.correct : colors.wrong}
                      />
                    </View>
                    <View style={styles.challengeInfo}>
                      <Text style={[styles.challengeVs, { color: colors.text }]}>vs {opponentName}</Text>
                      <Text style={[styles.challengeMeta, { color: colors.textSecondary }]}>
                        {myScore} - {theirScore}
                      </Text>
                    </View>
                    <Text style={[styles.resultText, { color: won ? colors.correct : colors.wrong }]}>
                      {won ? 'Won' : challenge.winner_team_id ? 'Lost' : 'Draw'}
                    </Text>
                  </View>
                );
              })}
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
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  emptyCard: { alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  emptyDesc: { fontSize: fontSize.base, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  sectionCard: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: spacing.md },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  teamAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  teamAvatarText: { color: '#fff', fontSize: fontSize.base, fontWeight: fontWeight.bold },
  teamInfo: { flex: 1 },
  teamName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  teamMeta: { fontSize: fontSize.xs, marginTop: 2 },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  challengeIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  challengeInfo: { flex: 1 },
  challengeVs: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  challengeMeta: { fontSize: fontSize.xs, marginTop: 2 },
  resultText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
