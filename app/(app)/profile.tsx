import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { showAlert, showConfirm } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemePicker } from '@/components/ThemePicker';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';

type UserStats = {
  total_attempts: number;
  correct_attempts: number;
  avg_time: number;
  best_time: number;
  streak: number;
  total_points: number;
};

export default function Profile() {
  const router = useRouter();
  const { colors, setTheme, theme } = useTheme();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
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

      // Load profile (including streak and points from DB)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, display_name, total_points, streak_count')
        .eq('id', uid)
        .maybeSingle<{
          username: string | null;
          display_name: string | null;
          total_points: number;
          streak_count: number;
        }>();

      if (profileData) {
        setUsername(profileData.username ?? '');
        setDisplayName(profileData.display_name ?? '');
      }

      // Load attempt stats
      const { data: attemptsData } = await supabase
        .from('attempts')
        .select('ms_taken, is_correct')
        .eq('user_id', uid);

      const correctAttempts = attemptsData?.filter((a) => a.is_correct) ?? [];
      const totalAttempts = attemptsData?.length ?? 0;
      const avgTime =
        correctAttempts.length > 0
          ? correctAttempts.reduce((sum, a) => sum + a.ms_taken, 0) / correctAttempts.length
          : 0;
      const bestTime =
        correctAttempts.length > 0
          ? Math.min(...correctAttempts.map((a) => a.ms_taken))
          : 0;

      setStats({
        total_attempts: totalAttempts,
        correct_attempts: correctAttempts.length,
        avg_time: avgTime,
        best_time: bestTime,
        streak: profileData?.streak_count ?? 0,
        total_points: profileData?.total_points ?? 0,
      });
    } catch (e: any) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
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
      });

      if (error) throw error;
      showAlert('Success', 'Profile updated successfully!');
    } catch (e: any) {
      showAlert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    const confirmed = await showConfirm('Sign out', 'Are you sure you want to sign out?', 'Sign out');
    if (confirmed) {
      await supabase.auth.signOut();
    }
  }

  async function resetPassword() {
    if (!email) {
      showAlert('Error', 'No email found. Please sign in again.');
      return;
    }
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
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar & Name */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            {username ? (
              <Text style={[styles.username, { color: colors.textSecondary }]}>@{username}</Text>
            ) : null}
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
                {stats.streak > 0 ? `${stats.streak}🔥` : '-'}
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

        {/* Theme */}
        <Card style={styles.themeCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <View style={styles.themeRow}>
            {([
              { key: 'light' as const, icon: '\u2600\uFE0F', label: 'Light' },
              { key: 'dark' as const, icon: '\u{1F319}', label: 'Dark' },
              { key: 'auto' as const, icon: '\u2699\uFE0F', label: 'Auto' },
            ]).map((t) => (
              <Pressable
                key={t.key}
                style={[
                  styles.themeOption,
                  {
                    borderColor: theme === t.key ? colors.primary : colors.border,
                    backgroundColor: theme === t.key ? `${colors.primary}10` : colors.surface,
                  },
                ]}
                onPress={() => setTheme(t.key)}
              >
                <Text style={styles.themeIcon}>{t.icon}</Text>
                <Text
                  style={[
                    styles.themeLabel,
                    { color: theme === t.key ? colors.primary : colors.text },
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.colorThemeLabel, { color: colors.textSecondary }]}>Color Theme</Text>
          <ThemePicker />
        </Card>

        {/* Account Actions */}
        <Card style={styles.actionsCard}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <Button title="Reset Password" onPress={resetPassword} variant="outline" fullWidth size="lg" />
          <Button
            title="Sign Out"
            onPress={signOut}
            variant="outline"
            fullWidth
            size="lg"
            style={{ marginTop: spacing.sm }}
          />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: fontSize['2xl'] },
  headerTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, alignSelf: 'center', width: '100%' },

  profileCard: { alignItems: 'center', marginBottom: spacing.md },
  avatarSection: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: fontSize['3xl'], fontWeight: fontWeight.black, color: '#fff' },
  username: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
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

  themeCard: { marginBottom: spacing.md },
  themeRow: { flexDirection: 'row', gap: spacing.sm },
  themeOption: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
  },
  themeIcon: { fontSize: fontSize.xl, marginBottom: spacing.xs },
  themeLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  colorThemeLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: spacing.lg, marginBottom: spacing.sm },

  actionsCard: { marginBottom: spacing.md },
});
