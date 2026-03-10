import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { showAlert, showConfirm } from '@/lib/alert';
import { getCurrentUserId, getTotalDmUnread } from '@/lib/dm';
import { loadOwnProfileData, getUserActivity } from '@/lib/profileStats';
import { ProfileHeroCard } from '@/components/profile/ProfileHeroCard';
import { ProfileTabBar } from '@/components/profile/ProfileTabBar';
import { ProfileEditForm } from '@/components/profile/ProfileEditForm';
import { ProfileStatsSection } from '@/components/profile/ProfileStatsSection';
import { ProfileAchievementsSection } from '@/components/profile/ProfileAchievementsSection';
import { ProfileActivitySection } from '@/components/profile/ProfileActivitySection';
import { ProfileSettingsSection } from '@/components/profile/ProfileSettingsSection';
import { ProfileShareButton } from '@/components/profile/ProfileShareButton';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, isDesktop } from '@/constants/theme';
import type { ProfileTabKey, AvailableBadge, Team, UserStats, PuzzleAttempt, LevelInfo, ActivityFeedItem } from '@/lib/types';

const PROFILE_TABS = [
  { key: 'overview', label: 'Overview', icon: 'person-outline' as const },
  { key: 'activity', label: 'Activity', icon: 'time-outline' as const },
  { key: 'settings', label: 'Settings', icon: 'settings-outline' as const },
];

export default function Profile() {
  const router = useRouter();
  const { colors, setTheme, theme } = useTheme();

  // Tab state
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('overview');
  const loadedTabs = useRef(new Set<ProfileTabKey>(['overview']));

  // Profile form state
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [initialProfile, setInitialProfile] = useState({ displayName: '', username: '', bio: '' });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data state
  const [stats, setStats] = useState<UserStats>({
    total_attempts: 0, correct_attempts: 0, avg_time: 0, best_time: 0, streak: 0, total_points: 0,
  });
  const [recentAttempts, setRecentAttempts] = useState<PuzzleAttempt[]>([]);
  const [badges, setBadges] = useState<AvailableBadge[]>([]);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [userTitle, setUserTitle] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [connectionCount, setConnectionCount] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Activity tab lazy data
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);

  useEffect(() => { loadProfile(); }, []);

  useFocusEffect(
    useCallback(() => {
      loadDmUnread().catch(() => null);
      return undefined;
    }, []),
  );

  async function loadDmUnread() {
    const uid = await getCurrentUserId();
    if (!uid) { setDmUnread(0); return; }
    const count = await getTotalDmUnread(uid);
    setDmUnread(count);
  }

  async function loadProfile() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email ?? '';
      setEmail(userEmail);
      const uid = userData.user?.id;
      if (!uid) return;

      const data = await loadOwnProfileData(uid, userEmail);

      setUsername(data.username);
      setDisplayName(data.displayName);
      setBio(data.bio);
      setAvatarUrl(data.avatarUrl);
      setInitialProfile({ displayName: data.displayName, username: data.username, bio: data.bio });
      setStats(data.stats);
      setRecentAttempts(data.recentAttempts);
      setBadges(data.badges);
      setEarnedIds(data.earnedIds);
      setLevelInfo(data.levelInfo);
      setUserTitle(data.userTitle);
      setMyTeam(data.team);
      setConnectionCount(data.connectionCount);
      setWinRate(data.winRate);

      await loadDmUnread();
    } catch (e: any) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
    }
  }

  const handleTabChange = useCallback(async (tab: string) => {
    const key = tab as ProfileTabKey;
    setActiveTab(key);
    if (!loadedTabs.current.has(key)) {
      loadedTabs.current.add(key);
      if (key === 'activity') {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const uid = userData.user?.id;
          if (uid) {
            const feed = await getUserActivity(uid);
            setActivityFeed(feed);
          }
        } catch (e) {
          console.error('Activity load error:', e);
        }
      }
    }
  }, []);

  const pickAvatar = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]) return;

      setUploadingAvatar(true);
      const asset = result.assets[0];
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Not signed in');

      const filePath = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ id: uid, avatar_url: publicUrl }, { onConflict: 'id' });
      if (updateError) throw new Error(`Profile update failed: ${updateError.message}`);

      setAvatarUrl(publicUrl);
    } catch (e: any) {
      showAlert('Upload failed', e?.message ?? 'Could not upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  }, []);

  const save = useCallback(async () => {
    const trimmedName = displayName.trim();
    const trimmedUsername = username.trim();
    const trimmedBio = bio.trim();
    if (!trimmedName) { showAlert('Invalid name', 'Display name cannot be empty'); return; }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Not signed in');

      const { error } = await supabase.from('profiles').upsert({
        id: uid,
        display_name: trimmedName,
        username: trimmedUsername || null,
        bio: trimmedBio || null,
      });
      if (error) throw error;
      setInitialProfile({ displayName: trimmedName, username: trimmedUsername, bio: trimmedBio });
      showAlert('Success', 'Profile updated successfully!');
    } catch (e: any) {
      showAlert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [displayName, username, bio]);

  const signOut = useCallback(async () => {
    const confirmed = await showConfirm('Sign out', 'Are you sure you want to sign out?', 'Sign out');
    if (confirmed) await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async () => {
    if (!email) { showAlert('Error', 'No email found. Please sign in again.'); return; }
    const confirmed = await showConfirm(
      'Reset Password',
      `We will send a password reset link to ${email}. Continue?`,
      'Send Link',
    );
    if (!confirmed) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'mindarena://reset-password',
      });
      if (error) throw error;
      showAlert('Check your email', 'We sent you a password reset link.');
    } catch (e: any) {
      showAlert('Reset Failed', e?.message || 'Could not send reset email.');
    }
  }, [email]);

  const hasProfileChanges = useMemo(
    () =>
      displayName.trim() !== initialProfile.displayName ||
      username.trim() !== initialProfile.username ||
      bio.trim() !== initialProfile.bio,
    [displayName, username, bio, initialProfile],
  );

  const completion = useMemo(() => {
    const score = [displayName.trim(), username.trim(), bio.trim(), avatarUrl].filter(Boolean).length;
    return Math.round((score / 4) * 100);
  }, [displayName, username, bio, avatarUrl]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.bgLayer} pointerEvents="none">
        <View style={[styles.bgOrbTop, { backgroundColor: `${colors.primary}14` }]} />
        <View style={[styles.bgOrbBottom, { backgroundColor: `${colors.secondary}12` }]} />
      </View>

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Identity, progress, and puzzle performance
            </Text>
          </View>
          {levelInfo && (
            <ProfileShareButton
              displayName={displayName || 'MindArena Player'}
              username={username || null}
              level={levelInfo.level}
              totalPoints={stats.total_points}
            />
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading profile...</Text>
        </View>
      ) : (
        <>
          <ProfileHeroCard
            avatarUrl={avatarUrl}
            displayName={displayName}
            username={username}
            email={email}
            levelInfo={levelInfo}
            userTitle={userTitle}
            stats={{ totalPoints: stats.total_points, streak: stats.streak, completion }}
            team={myTeam}
            isOwnProfile
            onAvatarPress={pickAvatar}
            uploadingAvatar={uploadingAvatar}
          />

          <ProfileTabBar tabs={PROFILE_TABS} activeTab={activeTab} onTabChange={handleTabChange} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'overview' && (
              <>
                <ProfileEditForm
                  displayName={displayName}
                  username={username}
                  bio={bio}
                  onDisplayNameChange={setDisplayName}
                  onUsernameChange={setUsername}
                  onBioChange={setBio}
                  onSave={save}
                  saving={saving}
                  hasChanges={hasProfileChanges}
                />
                <ProfileStatsSection
                  stats={stats}
                  connectionCount={connectionCount}
                  winRate={winRate}
                  isOwnProfile
                  dmUnread={dmUnread}
                  onChatPress={() => router.push('/chat')}
                />
                <ProfileAchievementsSection
                  badges={badges}
                  earnedIds={earnedIds}
                  isOwnProfile
                  onViewAll={() => router.push('/badges')}
                />
              </>
            )}

            {activeTab === 'activity' && (
              <ProfileActivitySection
                recentAttempts={recentAttempts}
                activityFeed={activityFeed}
                isOwnProfile
              />
            )}

            {activeTab === 'settings' && (
              <ProfileSettingsSection
                theme={theme}
                setTheme={setTheme}
                notificationsEnabled={notificationsEnabled}
                setNotificationsEnabled={setNotificationsEnabled}
                email={email}
                onResetPassword={resetPassword}
                onSignOut={signOut}
              />
            )}

            <View style={{ height: spacing.xl }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgLayer: { ...StyleSheet.absoluteFillObject },
  bgOrbTop: {
    position: 'absolute', top: -120, right: -90, width: 260, height: 260, borderRadius: 130,
  },
  bgOrbBottom: {
    position: 'absolute', bottom: 120, left: -110, width: 220, height: 220, borderRadius: 110,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  loadingWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm,
  },
  loadingText: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.md, alignSelf: 'center', width: '100%', paddingBottom: spacing.xl,
  },
});
