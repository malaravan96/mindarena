import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

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
  icon: IconName;
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
      } else {
        setRecentAttempts([]);
      }

      const totalCorrect = correctAttempts.length;
      const streak = profileData?.streak_count ?? 0;
      const fastSolve = bestTime > 0 && bestTime < 10_000;

      setAchievements([
        {
          id: 'first-solve',
          title: 'First Solve',
          description: 'Solve your first puzzle',
          icon: 'flag-outline',
          unlocked: totalCorrect >= 1,
        },
        {
          id: 'five-streak',
          title: '5-Day Streak',
          description: 'Maintain a 5-day solving streak',
          icon: 'flame-outline',
          unlocked: streak >= 5,
        },
        {
          id: 'speed-demon',
          title: 'Speed Demon',
          description: 'Solve a puzzle in under 10 seconds',
          icon: 'flash-outline',
          unlocked: fastSolve,
        },
        {
          id: 'ten-correct',
          title: 'Sharp Mind',
          description: 'Get 10 puzzles correct',
          icon: 'bulb-outline',
          unlocked: totalCorrect >= 10,
        },
        {
          id: 'perfectionist',
          title: 'Perfectionist',
          description: 'Achieve 100% accuracy (min 5 attempts)',
          icon: 'diamond-outline',
          unlocked: allAttempts.length >= 5 && totalCorrect === allAttempts.length,
        },
        {
          id: 'dedicated',
          title: 'Dedicated',
          description: 'Attempt 20 puzzles',
          icon: 'trophy-outline',
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
  const profileName = displayName || username || 'MindArena Player';
  const completionScore = [displayName.trim(), username.trim(), bio.trim(), avatarUrl].filter(Boolean).length;
  const completion = Math.round((completionScore / 4) * 100);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.backgroundLayer} pointerEvents="none">
        <View style={[styles.bgOrbTop, { backgroundColor: `${colors.primary}14` }]} />
        <View style={[styles.bgOrbBottom, { backgroundColor: `${colors.secondary}12` }]} />
      </View>

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          Identity, progress, and puzzle performance
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.heroCard} padding="lg">
          <View style={[styles.heroBlobOne, { backgroundColor: `${colors.primary}18` }]} />
          <View style={[styles.heroBlobTwo, { backgroundColor: `${colors.secondary}16` }]} />

          <View style={styles.heroTopRow}>
            <Pressable
              onPress={pickAvatar}
              disabled={uploadingAvatar}
              style={({ pressed }) => [
                styles.avatarWrapper,
                {
                  borderColor: `${colors.surface}90`,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={[styles.cameraBadge, { backgroundColor: colors.surface }]}>
                <Ionicons name="camera" size={16} color={colors.primary} />
              </View>
              {uploadingAvatar && (
                <View style={[styles.avatarOverlay, { backgroundColor: colors.overlay }]}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </Pressable>

            <View style={styles.heroIdentity}>
              <View
                style={[
                  styles.identityPill,
                  { backgroundColor: `${colors.primary}16`, borderColor: `${colors.primary}35` },
                ]}
              >
                <Ionicons name="sparkles" size={13} color={colors.primary} />
                <Text style={[styles.identityPillText, { color: colors.primary }]}>Puzzle Challenger</Text>
              </View>
              <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>
                {profileName}
              </Text>
              <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
                {email || 'No email connected'}
              </Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <HeroStatPill
              icon="trophy-outline"
              label="Points"
              value={String(stats.total_points)}
              accent={colors.primary}
              colors={colors}
            />
            <HeroStatPill
              icon="flame-outline"
              label="Streak"
              value={String(stats.streak)}
              accent={colors.warning}
              colors={colors}
            />
            <HeroStatPill
              icon="checkmark-done-outline"
              label="Complete"
              value={`${completion}%`}
              accent={colors.correct}
              colors={colors}
            />
          </View>
        </Card>

        {loading ? (
          <Card style={styles.loadingCard} padding="lg">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading profile...</Text>
          </Card>
        ) : (
          <>
            <Card style={styles.formCard} padding="lg">
              <SectionHeading
                icon="person-outline"
                title="Personal Details"
                subtitle="Keep your profile up to date"
                colors={colors}
              />

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
                style={styles.bioInput}
              />

              <Button
                title={saving ? 'Saving...' : 'Save Profile'}
                onPress={save}
                disabled={saving}
                loading={saving}
                variant="gradient"
                fullWidth
                size="lg"
                style={styles.saveBtn}
              />
            </Card>

            <Card style={styles.statsCard} padding="lg">
              <SectionHeading
                icon="stats-chart-outline"
                title="Your Statistics"
                subtitle="Performance overview"
                colors={colors}
              />
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

            <Card style={styles.achievementsCard} padding="lg">
              <SectionHeading
                icon="ribbon-outline"
                title="Achievements"
                subtitle="Milestones you have unlocked"
                colors={colors}
              />
              <View style={styles.achievementsGrid}>
                {achievements.map((a) => (
                  <View
                    key={a.id}
                    style={[
                      styles.achievementBadge,
                      {
                        backgroundColor: a.unlocked ? `${colors.primary}12` : colors.surfaceVariant,
                        borderColor: a.unlocked ? `${colors.primary}35` : colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.achievementIconWrap,
                        {
                          backgroundColor: a.unlocked ? `${colors.primary}16` : `${colors.textTertiary}15`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={a.icon}
                        size={18}
                        color={a.unlocked ? colors.primary : colors.textTertiary}
                      />
                    </View>
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
                    <View
                      style={[
                        styles.unlockedBadge,
                        {
                          backgroundColor: a.unlocked ? `${colors.correct}15` : `${colors.textTertiary}18`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.unlockedText,
                          { color: a.unlocked ? colors.correct : colors.textTertiary },
                        ]}
                      >
                        {a.unlocked ? 'Unlocked' : 'Locked'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            <Card style={styles.historyCard} padding="lg">
              <SectionHeading
                icon="time-outline"
                title="Recent Puzzles"
                subtitle="Your latest attempts"
                colors={colors}
              />
              {recentAttempts.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="hourglass-outline" size={20} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No puzzle attempts yet. Solve your first puzzle!
                  </Text>
                </View>
              ) : (
                recentAttempts.map((attempt) => (
                  <View
                    key={attempt.id}
                    style={[
                      styles.historyRow,
                      { borderColor: colors.border, backgroundColor: colors.surfaceVariant },
                    ]}
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
                        {new Date(attempt.created_at).toLocaleDateString()} - {(attempt.ms_taken / 1000).toFixed(1)}s
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.resultPill,
                        {
                          backgroundColor: attempt.is_correct ? `${colors.correct}15` : `${colors.wrong}15`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.historyResult,
                          { color: attempt.is_correct ? colors.correct : colors.wrong },
                        ]}
                      >
                        {attempt.is_correct ? 'Correct' : 'Wrong'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </Card>
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeading({
  icon,
  title,
  subtitle,
  colors,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  colors: any;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIconWrap, { backgroundColor: `${colors.primary}12` }]}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.sectionHeaderText}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function HeroStatPill({
  icon,
  value,
  label,
  accent,
  colors,
}: {
  icon: IconName;
  value: string;
  label: string;
  accent: string;
  colors: any;
}) {
  return (
    <View style={[styles.heroStat, { borderColor: `${accent}30`, backgroundColor: `${colors.surface}95` }]}>
      <View style={[styles.heroStatIcon, { backgroundColor: `${accent}15` }]}>
        <Ionicons name={icon} size={14} color={accent} />
      </View>
      <Text style={[styles.heroStatValue, { color: accent }]}>{value}</Text>
      <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
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
    <View style={[statStyles.box, { backgroundColor: colors.surfaceVariant, borderColor: `${color}28` }]}>
      <View style={[statStyles.dot, { backgroundColor: color }]} />
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
    borderWidth: 1,
    alignItems: 'center',
  },
  dot: { width: 8, height: 8, borderRadius: borderRadius.full, marginBottom: spacing.xs },
  value: { fontSize: fontSize.xl, fontWeight: fontWeight.black, marginBottom: 2 },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, textAlign: 'center' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  bgOrbTop: {
    position: 'absolute',
    top: -120,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  bgOrbBottom: {
    position: 'absolute',
    bottom: 120,
    left: -110,
    width: 220,
    height: 220,
    borderRadius: 110,
  },

  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerSubtitle: { fontSize: fontSize.xs, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%', paddingBottom: spacing.xl },

  heroCard: {
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  heroBlobOne: {
    position: 'absolute',
    top: -36,
    right: -24,
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  heroBlobTwo: {
    position: 'absolute',
    bottom: -56,
    left: -34,
    width: 156,
    height: 156,
    borderRadius: 78,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatarWrapper: {
    width: 104,
    height: 104,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    borderWidth: 3,
  },
  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: borderRadius.full,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: fontSize['3xl'], fontWeight: fontWeight.black, color: '#fff' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIdentity: { flex: 1, minWidth: 0 },
  identityPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  identityPillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  heroName: { fontSize: fontSize['2xl'], fontWeight: fontWeight.black },
  email: { fontSize: fontSize.sm, marginTop: 2 },

  heroStatsRow: { flexDirection: 'row', gap: spacing.sm },
  heroStat: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  heroStatIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroStatValue: { fontSize: fontSize.base, fontWeight: fontWeight.black },
  heroStatLabel: { fontSize: fontSize.xs, marginTop: 2 },

  loadingCard: {
    marginBottom: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: { fontSize: fontSize.base, fontWeight: fontWeight.medium },

  formCard: {
    marginBottom: spacing.md,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: { marginTop: spacing.sm },

  statsCard: { marginBottom: spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  sectionSubtitle: { fontSize: fontSize.xs, marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  achievementsCard: { marginBottom: spacing.md },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  achievementBadge: {
    width: '48%' as any,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  achievementIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  achievementTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    marginBottom: 2,
    textAlign: 'center',
  },
  achievementDesc: { fontSize: fontSize.xs, textAlign: 'center' },
  unlockedBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  unlockedText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  historyCard: { marginBottom: spacing.md },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
  emptyText: { fontSize: fontSize.base, textAlign: 'center' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  historyIndicator: {
    width: 9,
    height: 9,
    borderRadius: borderRadius.full,
  },
  historyInfo: { flex: 1, minWidth: 0 },
  historyTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  historyMeta: { fontSize: fontSize.xs, marginTop: 2 },
  resultPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  historyResult: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
});
