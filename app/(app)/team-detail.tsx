import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getTeam, getTeamMembers, joinTeam, leaveTeam } from '@/lib/teams';
import { getTeamChallenges } from '@/lib/teamChallenges';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { showAlert, showConfirm } from '@/lib/alert';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { Team, TeamMember, TeamChallenge } from '@/lib/types';

export default function TeamDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [challenges, setChallenges] = useState<(TeamChallenge & { challenger_team?: Team; opponent_team?: Team })[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      setUid(userId);

      const [teamData, membersData, challengesData] = await Promise.all([
        getTeam(id!),
        getTeamMembers(id!),
        getTeamChallenges(id!),
      ]);

      setTeam(teamData);
      setMembers(membersData);
      setChallenges(challengesData);

      if (userId && membersData.length > 0) {
        const myMembership = membersData.find((m) => m.user_id === userId);
        setIsMember(!!myMembership);
        setIsOwner(myMembership?.role === 'owner');
      }
    } catch (e) {
      console.error('Team detail error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    try {
      await joinTeam(id!);
      showAlert('Joined!', 'You are now a team member');
      await loadData();
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to join team');
    }
  }

  async function handleLeave() {
    const confirmed = await showConfirm('Leave Team', 'Are you sure you want to leave this team?', 'Leave');
    if (!confirmed) return;
    try {
      await leaveTeam(id!);
      showAlert('Left', 'You have left the team');
      router.back();
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to leave team');
    }
  }

  function getRoleColor(role: string) {
    if (role === 'owner') return colors.warning;
    if (role === 'admin') return colors.primary;
    return colors.textSecondary;
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Team</Text>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Team</Text>
        </View>
        <View style={styles.loadingWrap}>
          <Text style={[styles.errorText, { color: colors.error }]}>Team not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{team.name}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        <Card padding="lg" style={styles.heroCard}>
          <View style={styles.teamRow}>
            <View style={[styles.teamAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.teamAvatarText}>{team.name[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.teamInfo}>
              <Text style={[styles.teamName, { color: colors.text }]}>{team.name}</Text>
              {team.description ? (
                <Text style={[styles.teamDesc, { color: colors.textSecondary }]}>{team.description}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{team.member_count}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Members</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.statValue, { color: colors.warning }]}>{team.total_points}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Points</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.statValue, { color: colors.correct }]}>
                {challenges.filter((c) => c.winner_team_id === team.id).length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Wins</Text>
            </View>
          </View>
        </Card>

        {isMember ? (
          <View style={styles.actionsRow}>
            <Button
              title="Team Chat"
              onPress={() => router.push({ pathname: '/team-chat', params: { id: team.id, name: team.name } })}
              variant="gradient"
              style={{ flex: 1 }}
            />
            <Button title="Leave" onPress={handleLeave} variant="outline" style={{ flex: 1 }} />
          </View>
        ) : (
          <Button
            title="Join Team"
            onPress={handleJoin}
            variant="gradient"
            fullWidth
            style={{ marginBottom: spacing.md }}
          />
        )}

        <Card padding="lg" style={styles.membersCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Members ({members.length})</Text>
          {members.map((member) => {
            const name = member.profile?.display_name || member.profile?.username || 'Player';
            const initials = name[0]?.toUpperCase() ?? '?';
            return (
              <View key={member.id} style={[styles.memberRow, { borderColor: colors.border }]}>
                {member.profile?.avatar_url ? (
                  <Image source={{ uri: member.profile.avatar_url }} style={styles.memberAvatar} />
                ) : (
                  <View style={[styles.memberAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                    <Text style={styles.memberAvatarText}>{initials}</Text>
                  </View>
                )}
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.text }]}>{name}</Text>
                  <Text style={[styles.memberRole, { color: getRoleColor(member.role) }]}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </Text>
                </View>
                {member.user_id !== uid && (
                  <Pressable
                    onPress={() => router.push({ pathname: '/player-profile', params: { id: member.user_id } })}
                  >
                    <Ionicons name="person-outline" size={16} color={colors.textTertiary} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>

        {challenges.length > 0 && (
          <Card padding="lg" style={styles.challengesCard}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Challenges</Text>
            {challenges.slice(0, 5).map((challenge) => {
              const isChallenger = challenge.challenger_team_id === team.id;
              const opponentName = isChallenger
                ? challenge.opponent_team?.name ?? 'Unknown'
                : challenge.challenger_team?.name ?? 'Unknown';
              const myScore = isChallenger ? challenge.challenger_score : challenge.opponent_score;
              const theirScore = isChallenger ? challenge.opponent_score : challenge.challenger_score;
              const won = challenge.winner_team_id === team.id;

              return (
                <View key={challenge.id} style={[styles.challengeRow, { borderColor: colors.border }]}>
                  <View style={styles.challengeInfo}>
                    <Text style={[styles.challengeVs, { color: colors.text }]}>vs {opponentName}</Text>
                    <Text style={[styles.challengeScore, { color: colors.textSecondary }]}>
                      {myScore} - {theirScore}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.challengeStatus,
                      {
                        backgroundColor:
                          challenge.status === 'completed'
                            ? won ? `${colors.correct}15` : `${colors.wrong}15`
                            : `${colors.warning}15`,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.challengeStatusText,
                        {
                          color:
                            challenge.status === 'completed'
                              ? won ? colors.correct : colors.wrong
                              : colors.warning,
                        },
                      ]}
                    >
                      {challenge.status === 'completed' ? (won ? 'Won' : 'Lost') : challenge.status}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        <View style={{ height: spacing.xxl + 70 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black, flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  heroCard: { marginBottom: spacing.md },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  teamAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  teamAvatarText: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  teamInfo: { flex: 1 },
  teamName: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  teamDesc: { fontSize: fontSize.sm, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, padding: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  statValue: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  statLabel: { fontSize: fontSize.xs, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  membersCard: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: spacing.md },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  memberAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: '#fff', fontSize: fontSize.base, fontWeight: fontWeight.bold },
  memberInfo: { flex: 1 },
  memberName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  memberRole: { fontSize: fontSize.xs, marginTop: 2, fontWeight: fontWeight.medium },
  challengesCard: { marginBottom: spacing.md },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  challengeInfo: { flex: 1 },
  challengeVs: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  challengeScore: { fontSize: fontSize.xs, marginTop: 2 },
  challengeStatus: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  challengeStatusText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
});
