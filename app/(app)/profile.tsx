import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
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
};

export default function Profile() {
  const router = useRouter();
  const { colors, colorScheme, setTheme, theme } = useTheme();
  const [email, setEmail] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats>({
    total_attempts: 0,
    correct_attempts: 0,
    avg_time: 0,
    best_time: 0,
    streak: 0,
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

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', uid)
        .maybeSingle<{ display_name: string | null }>();
      setDisplayName(profileData?.display_name ?? '');

      // Load stats
      const { data: attemptsData } = await supabase
        .from('attempts')
        .select('ms_taken, is_correct')
        .eq('user_id', uid);

      if (attemptsData) {
        const correctAttempts = attemptsData.filter((a) => a.is_correct);
        const totalAttempts = attemptsData.length;
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
          streak: 0, // Implement streak calculation if needed
        });
      }
    } catch (e: any) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      Alert.alert('Invalid name', 'Display name cannot be empty');
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
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  const accuracyRate =
    stats.total_attempts > 0
      ? Math.round((stats.correct_attempts / stats.total_attempts) * 100)
      : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 800 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar & Email */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {displayName
                  ? displayName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                  : email[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={[styles.email, { color: colors.textSecondary }]}>{email}</Text>
          </View>

          <Input
            label="Display Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
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

        {/* Statistics */}
        <Card style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={[styles.statsTitle, { color: colors.text }]}>Your Statistics</Text>
            <Text style={[styles.statsEmoji]}>📊</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {stats.total_attempts}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Attempts
              </Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {stats.correct_attempts}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Correct</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.statValue, { color: colors.secondary }]}>{accuracyRate}%</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Accuracy</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.statValue, { color: colors.warning }]}>
                {stats.best_time > 0 ? (stats.best_time / 1000).toFixed(1) : '-'}s
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Best Time</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.avg_time > 0 ? (stats.avg_time / 1000).toFixed(1) : '-'}s
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Time</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.statValue, { color: '#f59e0b' }]}>
                {stats.streak > 0 ? stats.streak : '-'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Streak 🔥</Text>
            </View>
          </View>
        </Card>

        {/* Theme Selection */}
        <Card style={styles.themeCard}>
          <Text style={[styles.themeTitle, { color: colors.text }]}>Theme</Text>
          <View style={styles.themeOptions}>
            <Pressable
              style={[
                styles.themeOption,
                {
                  borderColor: colors.border,
                  backgroundColor: theme === 'light' ? colors.primary : colors.surface,
                },
              ]}
              onPress={() => setTheme('light')}
            >
              <Text style={styles.themeEmoji}>☀️</Text>
              <Text
                style={[
                  styles.themeOptionText,
                  { color: theme === 'light' ? '#ffffff' : colors.text },
                ]}
              >
                Light
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.themeOption,
                {
                  borderColor: colors.border,
                  backgroundColor: theme === 'dark' ? colors.primary : colors.surface,
                },
              ]}
              onPress={() => setTheme('dark')}
            >
              <Text style={styles.themeEmoji}>🌙</Text>
              <Text
                style={[
                  styles.themeOptionText,
                  { color: theme === 'dark' ? '#ffffff' : colors.text },
                ]}
              >
                Dark
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.themeOption,
                {
                  borderColor: colors.border,
                  backgroundColor: theme === 'auto' ? colors.primary : colors.surface,
                },
              ]}
              onPress={() => setTheme('auto')}
            >
              <Text style={styles.themeEmoji}>⚙️</Text>
              <Text
                style={[
                  styles.themeOptionText,
                  { color: theme === 'auto' ? '#ffffff' : colors.text },
                ]}
              >
                Auto
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Actions */}
        <Card style={styles.actionsCard}>
          <Button
            title="Sign Out"
            onPress={signOut}
            variant="outline"
            fullWidth
            size="lg"
          />
        </Card>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: fontSize['2xl'],
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    alignSelf: 'center',
    width: '100%',
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.black,
    color: '#ffffff',
  },
  email: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
  statsCard: {
    marginBottom: spacing.md,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statsTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
  },
  statsEmoji: {
    fontSize: fontSize['2xl'],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statBox: {
    flex: 1,
    minWidth: isDesktop ? 120 : 100,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.black,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  themeCard: {
    marginBottom: spacing.md,
  },
  themeTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.md,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  themeOption: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
  },
  themeEmoji: {
    fontSize: fontSize['2xl'],
    marginBottom: spacing.xs,
  },
  themeOptionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  actionsCard: {
    marginBottom: spacing.md,
  },
});
