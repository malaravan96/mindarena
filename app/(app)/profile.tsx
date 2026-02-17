import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';

type UserStats = {
  total_attempts: number;
  correct_attempts: number;
  avg_time: number;
  best_time: number;
  streak: number;
  total_points: number;
};

type PuzzleAttempt = {
  id: string;
  is_correct: boolean;
  ms_taken: number;
  created_at: string;
  puzzle_title: string;
  puzzle_type: string;
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
};

export default function Profile() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentAttempts, setRecentAttempts] = useState<PuzzleAttempt[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<UserStats>({
    total_attempts: 0,
    correct_attempts: 0,
    avg_time: 0,
    best_time: 0,
    streak: 0,
    total_points: 0,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      setEmail(userData.user?.email ?? '');
      const uid = userData.user?.id;
      if (!uid) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, display_name, total_points, streak_count, avatar_url, bio')
        .eq('id', uid)
        .maybeSingle<{
          username: string | null;
          display_name: string | null;
          total_points: number;
          streak_count: number;
          avatar_url: string | null;
          bio: string | null;
        }>();

      if (profileData) {
        setUsername(profileData.username ?? '');
        setDisplayName(profileData.display_name ?? '');
        setAvatarUrl(profileData.avatar_url ?? null);
        setBio(profileData.bio ?? '');
      }

      const { data: attemptsData } = await supabase
        .from('attempts')
        .select('id, ms_taken, is_correct, created_at, puzzle_id')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(20);

      const allAttempts = attemptsData ?? [];
      const correctAttempts = allAttempts.filter((a) => a.is_correct);
      const avgTime =
        correctAttempts.length > 0
          ? correctAttempts.reduce((sum, a) => sum + a.ms_taken, 0) / correctAttempts.length
          : 0;
      const bestTime =
        correctAttempts.length > 0
          ? Math.min(...correctAttempts.map((a) => a.ms_taken))
          : 0;

      setStats({
        total_attempts: allAttempts.length,
        correct_attempts: correctAttempts.length,
        avg_time: avgTime,
        best_time: bestTime,
        streak: profileData?.streak_count ?? 0,
        total_points: profileData?.total_points ?? 0,
      });

      // Build recent attempts with puzzle info
      if (allAttempts.length > 0) {
        const puzzleIds = [...new Set(allAttempts.map((a) => a.puzzle_id))];
        const { data: puzzlesData } = await supabase
          .from('puzzles')
          .select('id, title, type')
          .in('id', puzzleIds);

        const puzzleMap: Record<string, { title: string; type: string }> = {};
        for (const p of puzzlesData ?? []) {
          puzzleMap[p.id] = { title: p.title, type: p.type };
        }

        setRecentAttempts(
          allAttempts.slice(0, 10).map((a) => ({
            id: a.id,
            is_correct: a.is_correct,
            ms_taken: a.ms_taken,
            created_at: a.created_at,
            puzzle_title: puzzleMap[a.puzzle_id]?.title ?? 'Puzzle',
            puzzle_type: puzzleMap[a.puzzle_id]?.type ?? 'unknown',
          })),
        );
      }

      // Compute achievements
      const totalCorrect = correctAttempts.length;
      const streak = profileData?.streak_count ?? 0;
      const fastSolve = bestTime > 0 && bestTime < 10000;

      setAchievements([
        {
          id: 'first-solve',
          title: 'First Solve',
          description: 'Solve your first puzzle',
          emoji: '🎯',
          unlocked: totalCorrect >= 1,
        },
        {
          id: 'five-streak',
          title: '5-Day Streak',
          description: 'Maintain a 5-day solving streak',
          emoji: '🔥',
          unlocked: streak >= 5,
        },
        {
          id: 'speed-demon',
          title: 'Speed Demon',
          description: 'Solve a puzzle in under 10 seconds',
          emoji: '⚡',
          unlocked: fastSolve,
        },
        {
          id: 'ten-correct',
          title: 'Sharp Mind',
          description: 'Get 10 puzzles correct',
          emoji: '🧠',
          unlocked: totalCorrect >= 10,
        },
        {
          id: 'perfectionist',
          title: 'Perfectionist',
          description: 'Achieve 100% accuracy (min 5 attempts)',
          emoji: '💎',
          unlocked: allAttempts.length >= 5 && totalCorrect === allAttempts.length,
        },
        {
          id: 'dedicated',
          title: 'Dedicated',
          description: 'Attempt 20 puzzles',
          emoji: '🏅',
          unlocked: allAttempts.length >= 20,
        },
      ]);
    } catch (e: any) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function pickAvatar() {
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

      const filePath = `${uid}.jpg`;

      // Fetch the image as a blob and upload
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      // Append cache-buster so the image refreshes
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', uid);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
    } catch (e: any) {
      showAlert('Upload failed', e?.message ?? 'Could not upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function save() {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      showAlert('Invalid name', 'Display name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Not signed in');

      const { error } = await supabase.from('profiles').upsert({
        id: uid,
        display_name: trimmedName,
        username: username.trim() || null,
        bio: bio.trim() || null,
      });

      if (error) throw error;
      showAlert('Success', 'Profile updated successfully!');
    } catch (e: any) {
      showAlert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  const accuracy =
    stats.total_attempts > 0
      ? Math.round((stats.correct_attempts / stats.total_attempts) * 100)
      : 0;

  const initials = displayName
    ? displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : email[0]?.toUpperCase() || '?';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar & Name */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarSection}>
            <Pressable onPress={pickAvatar} disabled={uploadingAvatar} style={styles.avatarWrapper}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              {uploadingAvatar ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : (
                <View style={styles.avatarOverlay}>
                  <Text style={styles.avatarOverlayText}>Change{'\n'}Photo</Text>
                </View>
              )}
            </Pressable>
            <Text style={[styles.email, { color: colors.textTertiary }]}>{email}</Text>
          </View>

          <Input
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your display name"
            autoCapitalize="words"
            editable={!saving}
          />

          <Input
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="Choose a username"
            autoCapitalize="none"
            editable={!saving}
          />

          <Input
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself"
            multiline
            numberOfLines={3}
            editable={!saving}
          />

          <Button
            title={saving ? 'Saving...' : 'Save Profile'}
            onPress={save}
            disabled={saving}
            loading={saving}
            fullWidth
            size="lg"
          />
        </Card>

        {/* Points Banner */}
        <Card style={styles.pointsBanner} padding="lg">
          <View style={styles.pointsRow}>
            <View style={styles.pointsCol}>
              <Text style={[styles.pointsValue, { color: colors.primary }]}>
                {stats.total_points}
              </Text>
              <Text style={[styles.pointsLabel, { color: colors.textSecondary }]}>Total Points</Text>
            </View>
            <View style={[styles.pointsDivider, { backgroundColor: colors.border }]} />
            <View style={styles.pointsCol}>
              <Text style={[styles.pointsValue, { color: '#f59e0b' }]}>
                {stats.streak > 0 ? `${stats.streak}` : '-'}
              </Text>
              <Text style={[styles.pointsLabel, { color: colors.textSecondary }]}>Day Streak</Text>
            </View>
          </View>
        </Card>

        {/* Stats Grid */}
        <Card style={styles.statsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Statistics</Text>
          <View style={styles.statsGrid}>
            <StatBox label="Attempts" value={String(stats.total_attempts)} color={colors.primary} colors={colors} />
            <StatBox label="Correct" value={String(stats.correct_attempts)} color={colors.success} colors={colors} />
            <StatBox label="Accuracy" value={`${accuracy}%`} color={colors.secondary} colors={colors} />
            <StatBox
              label="Best Time"
              value={stats.best_time > 0 ? `${(stats.best_time / 1000).toFixed(1)}s` : '-'}
              color={colors.warning}
              colors={colors}
            />
            <StatBox
              label="Avg Time"
              value={stats.avg_time > 0 ? `${(stats.avg_time / 1000).toFixed(1)}s` : '-'}
              color={colors.text}
              colors={colors}
            />
          </View>
        </Card>

        {/* Achievements */}
        <Card style={styles.achievementsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Achievements</Text>
          <View style={styles.achievementsGrid}>
            {achievements.map((a) => (
              <View
                key={a.id}
                style={[
                  styles.achievementBadge,
                  {
                    backgroundColor: a.unlocked ? `${colors.primary}10` : colors.surfaceVariant,
                    borderColor: a.unlocked ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.achievementEmoji, { opacity: a.unlocked ? 1 : 0.3 }]}>
                  {a.emoji}
                </Text>
                <Text
                  style={[
                    styles.achievementTitle,
                    { color: a.unlocked ? colors.text : colors.textTertiary },
                  ]}
                  numberOfLines={1}
                >
                  {a.title}
                </Text>
                <Text
                  style={[
                    styles.achievementDesc,
                    { color: a.unlocked ? colors.textSecondary : colors.textTertiary },
                  ]}
                  numberOfLines={2}
                >
                  {a.description}
                </Text>
                {a.unlocked && (
                  <View style={[styles.unlockedBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.unlockedText}>Unlocked</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </Card>

        {/* Puzzle History */}
        <Card style={styles.historyCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Puzzles</Text>
          {recentAttempts.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No puzzle attempts yet. Solve your first puzzle!
            </Text>
          ) : (
            recentAttempts.map((attempt) => (
              <View
                key={attempt.id}
                style={[styles.historyRow, { borderBottomColor: colors.border }]}
              >
                <View
                  style={[
                    styles.historyIndicator,
                    { backgroundColor: attempt.is_correct ? colors.correct : colors.wrong },
                  ]}
                />
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
                    {attempt.puzzle_title}
                  </Text>
                  <Text style={[styles.historyMeta, { color: colors.textSecondary }]}>
                    {new Date(attempt.created_at).toLocaleDateString()} · {(attempt.ms_taken / 1000).toFixed(1)}s
                  </Text>
                </View>
                <Text
                  style={[
                    styles.historyResult,
                    { color: attempt.is_correct ? colors.correct : colors.wrong },
                  ]}
                >
                  {attempt.is_correct ? 'Correct' : 'Wrong'}
                </Text>
              </View>
            ))
          )}
        </Card>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({
  label,
  value,
  color,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  colors: any;
}) {
  return (
    <View style={[statStyles.box, { backgroundColor: colors.surfaceVariant }]}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  box: {
    flex: 1,
    minWidth: 100,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  value: { fontSize: fontSize.xl, fontWeight: fontWeight.black, marginBottom: 2 },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, textAlign: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },

  profileCard: { alignItems: 'center', marginBottom: spacing.md },
  avatarSection: { alignItems: 'center', marginBottom: spacing.lg },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.full,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: fontSize['3xl'], fontWeight: fontWeight.black, color: '#fff' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  avatarOverlayText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  email: { fontSize: fontSize.sm, marginTop: 2 },

  pointsBanner: { marginBottom: spacing.md },
  pointsRow: { flexDirection: 'row', alignItems: 'center' },
  pointsCol: { flex: 1, alignItems: 'center' },
  pointsValue: { fontSize: fontSize['3xl'], fontWeight: fontWeight.black },
  pointsLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, marginTop: spacing.xs },
  pointsDivider: { width: 1, height: 40 },

  statsCard: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  achievementsCard: { marginBottom: spacing.md },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  achievementBadge: {
    width: '47%' as any,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  achievementEmoji: { fontSize: 32, marginBottom: spacing.xs },
  achievementTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginBottom: 2, textAlign: 'center' },
  achievementDesc: { fontSize: fontSize.xs, textAlign: 'center' },
  unlockedBadge: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  unlockedText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  historyCard: { marginBottom: spacing.md },
  emptyText: { fontSize: fontSize.base, textAlign: 'center', paddingVertical: spacing.lg },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  historyIndicator: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  historyMeta: { fontSize: fontSize.xs, marginTop: 2 },
  historyResult: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
