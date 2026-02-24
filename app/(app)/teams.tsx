import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getUserTeam, searchTeams, getTopTeams, getPendingInvites, respondToInvite, createTeam } from '@/lib/teams';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { showAlert } from '@/lib/alert';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';
import type { Team, TeamInvite } from '@/lib/types';

type Tab = 'my-team' | 'discover' | 'invites';

export default function Teams() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('my-team');
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [topTeams, setTopTeams] = useState<Team[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Team[]>([]);
  const [searching, setSearching] = useState(false);
  const [invites, setInvites] = useState<(TeamInvite & { team?: Team })[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      setUid(userId);

      const [team, teams, pendingInvites] = await Promise.all([
        getUserTeam(userId),
        getTopTeams(20),
        getPendingInvites(userId),
      ]);

      setMyTeam(team);
      setTopTeams(teams);
      setInvites(pendingInvites);
    } catch (e) {
      console.error('Teams load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function handleSearch(text: string) {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchTeams(text);
      setSearchResults(results);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
    }
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) {
      showAlert('Error', 'Team name is required');
      return;
    }
    setCreating(true);
    try {
      const team = await createTeam(newTeamName, newTeamDesc);
      setMyTeam(team);
      setShowCreate(false);
      setNewTeamName('');
      setNewTeamDesc('');
      setTab('my-team');
      showAlert('Success', `Team "${team.name}" created!`);
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to create team');
    } finally {
      setCreating(false);
    }
  }

  async function handleInviteResponse(inviteId: string, accept: boolean) {
    try {
      await respondToInvite(inviteId, accept);
      showAlert(accept ? 'Joined!' : 'Declined', accept ? 'You joined the team!' : 'Invite declined');
      await loadData();
    } catch (e: any) {
      showAlert('Error', e?.message ?? 'Failed to respond');
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'my-team', label: 'My Team', icon: 'people-outline' },
    { key: 'discover', label: 'Discover', icon: 'search-outline' },
    { key: 'invites', label: 'Invites', icon: 'mail-outline' },
  ];

  const displayTeams = searchQuery.trim().length >= 2 ? searchResults : topTeams;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Teams</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Compete together</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[
                styles.tabBtn,
                {
                  borderColor: active ? `${colors.primary}40` : colors.border,
                  backgroundColor: active ? `${colors.primary}15` : colors.surface,
                },
              ]}
            >
              <Ionicons name={t.icon} size={14} color={active ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabLabel, { color: active ? colors.primary : colors.text }]}>{t.label}</Text>
              {t.key === 'invites' && invites.length > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.wrong }]}>
                  <Text style={styles.badgeText}>{invites.length}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
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
          {tab === 'my-team' && (
            <>
              {myTeam ? (
                <Pressable onPress={() => router.push({ pathname: '/team-detail', params: { id: myTeam.id } })}>
                  <Card padding="lg" style={styles.teamCard}>
                    <View style={styles.teamRow}>
                      <View style={[styles.teamAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.teamAvatarText}>{myTeam.name[0]?.toUpperCase()}</Text>
                      </View>
                      <View style={styles.teamInfo}>
                        <Text style={[styles.teamName, { color: colors.text }]}>{myTeam.name}</Text>
                        <Text style={[styles.teamDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                          {myTeam.description || 'No description'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </View>
                    <View style={styles.teamStatsRow}>
                      <View style={[styles.teamStat, { backgroundColor: colors.surfaceVariant }]}>
                        <Text style={[styles.teamStatValue, { color: colors.primary }]}>{myTeam.member_count}</Text>
                        <Text style={[styles.teamStatLabel, { color: colors.textSecondary }]}>Members</Text>
                      </View>
                      <View style={[styles.teamStat, { backgroundColor: colors.surfaceVariant }]}>
                        <Text style={[styles.teamStatValue, { color: colors.warning }]}>{myTeam.total_points}</Text>
                        <Text style={[styles.teamStatLabel, { color: colors.textSecondary }]}>Points</Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              ) : (
                <Card padding="lg" style={styles.emptyCard}>
                  <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Team Yet</Text>
                  <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                    Create a team or join one to compete together!
                  </Text>
                  <Button
                    title="Create Team"
                    onPress={() => setShowCreate(true)}
                    variant="gradient"
                    fullWidth
                    style={{ marginTop: spacing.md }}
                  />
                  <Button
                    title="Browse Teams"
                    onPress={() => setTab('discover')}
                    variant="outline"
                    fullWidth
                    style={{ marginTop: spacing.sm }}
                  />
                </Card>
              )}

              {showCreate && (
                <Card padding="lg" style={styles.createCard}>
                  <Text style={[styles.createTitle, { color: colors.text }]}>Create Team</Text>
                  <Input
                    label="Team Name"
                    value={newTeamName}
                    onChangeText={setNewTeamName}
                    placeholder="Enter team name"
                    autoCapitalize="words"
                  />
                  <Input
                    label="Description"
                    value={newTeamDesc}
                    onChangeText={setNewTeamDesc}
                    placeholder="Describe your team"
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.createActions}>
                    <Button
                      title="Cancel"
                      onPress={() => setShowCreate(false)}
                      variant="outline"
                      style={{ flex: 1 }}
                    />
                    <Button
                      title={creating ? 'Creating...' : 'Create'}
                      onPress={handleCreateTeam}
                      variant="gradient"
                      disabled={creating}
                      loading={creating}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              )}
            </>
          )}

          {tab === 'discover' && (
            <>
              <View style={styles.searchWrap}>
                <Input
                  placeholder="Search teams..."
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoCapitalize="none"
                  icon="search-outline"
                />
              </View>

              {searching && (
                <View style={styles.searchingWrap}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}

              {!myTeam && !showCreate && (
                <Button
                  title="Create New Team"
                  onPress={() => { setTab('my-team'); setShowCreate(true); }}
                  variant="outline"
                  fullWidth
                  style={{ marginBottom: spacing.md }}
                />
              )}

              {displayTeams.map((team) => (
                <Pressable
                  key={team.id}
                  onPress={() => router.push({ pathname: '/team-detail', params: { id: team.id } })}
                  style={[styles.discoverRow, { borderColor: colors.border }]}
                >
                  <View style={[styles.discoverAvatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.discoverAvatarText}>{team.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.discoverInfo}>
                    <Text style={[styles.discoverName, { color: colors.text }]}>{team.name}</Text>
                    <Text style={[styles.discoverMeta, { color: colors.textSecondary }]}>
                      {team.member_count} members - {team.total_points} pts
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </Pressable>
              ))}

              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <Text style={[styles.noResults, { color: colors.textSecondary }]}>No teams found</Text>
              )}
            </>
          )}

          {tab === 'invites' && (
            <>
              {invites.length === 0 ? (
                <Card padding="lg" style={styles.emptyCard}>
                  <Ionicons name="mail-open-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Invites</Text>
                  <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                    You have no pending team invites.
                  </Text>
                </Card>
              ) : (
                invites.map((invite) => (
                  <Card key={invite.id} padding="md" style={styles.inviteCard}>
                    <Text style={[styles.inviteTeamName, { color: colors.text }]}>
                      {invite.team?.name ?? 'Unknown Team'}
                    </Text>
                    <Text style={[styles.inviteDesc, { color: colors.textSecondary }]}>
                      {invite.team?.description || 'No description'}
                    </Text>
                    <View style={styles.inviteActions}>
                      <Button
                        title="Decline"
                        onPress={() => handleInviteResponse(invite.id, false)}
                        variant="outline"
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Accept"
                        onPress={() => handleInviteResponse(invite.id, true)}
                        variant="gradient"
                        style={{ flex: 1 }}
                      />
                    </View>
                  </Card>
                ))
              )}
            </>
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
  tabRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  tabLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },
  teamCard: { marginBottom: spacing.md },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  teamAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  teamAvatarText: { color: '#fff', fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  teamInfo: { flex: 1 },
  teamName: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  teamDesc: { fontSize: fontSize.sm, marginTop: 2 },
  teamStatsRow: { flexDirection: 'row', gap: spacing.sm },
  teamStat: { flex: 1, padding: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  teamStatValue: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  teamStatLabel: { fontSize: fontSize.xs, marginTop: 2 },
  emptyCard: { alignItems: 'center', gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  emptyDesc: { fontSize: fontSize.base, textAlign: 'center' },
  createCard: { marginBottom: spacing.md },
  createTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: spacing.md },
  createActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  searchWrap: { marginBottom: spacing.sm },
  searchingWrap: { padding: spacing.md, alignItems: 'center' },
  discoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  discoverAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  discoverAvatarText: { color: '#fff', fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  discoverInfo: { flex: 1 },
  discoverName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  discoverMeta: { fontSize: fontSize.xs, marginTop: 2 },
  noResults: { textAlign: 'center', padding: spacing.lg, fontSize: fontSize.base },
  inviteCard: { marginBottom: spacing.sm },
  inviteTeamName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  inviteDesc: { fontSize: fontSize.sm, marginTop: 2, marginBottom: spacing.md },
  inviteActions: { flexDirection: 'row', gap: spacing.sm },
});
