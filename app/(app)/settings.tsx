import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { showAlert, showConfirm } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ThemePicker } from '@/components/ThemePicker';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';

export default function Settings() {
  const { colors, setTheme, theme } = useTheme();
  const [email, setEmail] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    loadEmail();
  }, []);

  async function loadEmail() {
    const { data } = await supabase.auth.getUser();
    setEmail(data.user?.email ?? '');
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 720 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <Card style={styles.card}>
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

        {/* Notifications */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Daily Puzzle Reminder</Text>
              <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                Get notified when a new puzzle is available
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: `${colors.primary}60` }}
              thumbColor={notificationsEnabled ? colors.primary : colors.textTertiary}
            />
          </View>
        </Card>

        {/* Account */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          {email ? (
            <Text style={[styles.emailText, { color: colors.textSecondary }]}>{email}</Text>
          ) : null}
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

        {/* About */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Version</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>1.0.0</Text>
          </View>
          <View style={[styles.aboutDivider, { backgroundColor: colors.border }]} />
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Developer</Text>
            <Text style={[styles.aboutValue, { color: colors.text }]}>MindArena Team</Text>
          </View>
        </Card>

        {/* Help & Support */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Help & Support</Text>
          <Pressable
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
            onPress={() => showAlert('Coming Soon', 'FAQ section is under development.')}
          >
            <Text style={[styles.linkText, { color: colors.text }]}>FAQ</Text>
            <Text style={[styles.linkArrow, { color: colors.textTertiary }]}>{'>'}</Text>
          </Pressable>
          <Pressable
            style={styles.linkRow}
            onPress={() => showAlert('Coming Soon', 'Contact support is under development.')}
          >
            <Text style={[styles.linkText, { color: colors.text }]}>Contact Support</Text>
            <Text style={[styles.linkArrow, { color: colors.textTertiary }]}>{'>'}</Text>
          </Pressable>
        </Card>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

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

  card: { marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black, marginBottom: spacing.md },

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
  colorThemeLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: { flex: 1, marginRight: spacing.md },
  settingLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  settingDesc: { fontSize: fontSize.sm, marginTop: 2 },

  emailText: { fontSize: fontSize.sm, marginBottom: spacing.md },

  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  aboutLabel: { fontSize: fontSize.base },
  aboutValue: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  aboutDivider: { height: 1, marginVertical: spacing.xs },

  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 0,
  },
  linkText: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
  linkArrow: { fontSize: fontSize.lg },
});
