import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { showAlert, showConfirm } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ThemePicker } from '@/components/ThemePicker';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius, isDesktop } from '@/constants/theme';

const modeOptions = [
  { key: 'light' as const, icon: 'sunny-outline' as const, label: 'Light', hint: 'Always bright' },
  { key: 'dark' as const, icon: 'moon-outline' as const, label: 'Dark', hint: 'Low light' },
  { key: 'auto' as const, icon: 'phone-portrait-outline' as const, label: 'Auto', hint: 'System sync' },
];

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
      <View style={styles.backgroundLayer} pointerEvents="none">
        <View style={[styles.bgOrbTop, { backgroundColor: `${colors.primary}18` }]} />
        <View style={[styles.bgOrbBottom, { backgroundColor: `${colors.secondary}14` }]} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { maxWidth: isDesktop ? 760 : undefined }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroGlow} />
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroEyebrow}>Preferences</Text>
              <Text style={styles.heroTitle}>Settings</Text>
            </View>
            <View style={styles.heroIconWrap}>
              <Ionicons name="options-outline" size={18} color="#fff" />
            </View>
          </View>
          <Text style={styles.heroSubtitle}>Manage your theme, account security, and app preferences.</Text>
          <View style={styles.heroMetaPill}>
            <Ionicons name="mail-outline" size={14} color="#fff" />
            <Text style={styles.heroMetaText}>{email || 'Signed in user'}</Text>
          </View>
        </LinearGradient>

        <Card style={styles.card} padding="lg">
          <View style={styles.sectionHead}>
            <View style={[styles.sectionIcon, { backgroundColor: `${colors.primary}14` }]}>
              <Ionicons name="color-palette-outline" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Theme mode and accent palette</Text>
            </View>
          </View>

          <View style={styles.modeGrid}>
            {modeOptions.map((option) => {
              const active = theme === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[
                    styles.modeOption,
                    {
                      borderColor: active ? `${colors.primary}50` : colors.border,
                      backgroundColor: active ? `${colors.primary}12` : colors.surface,
                    },
                  ]}
                  onPress={() => setTheme(option.key)}
                >
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={active ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.modeLabel, { color: active ? colors.primary : colors.text }]}>{option.label}</Text>
                  <Text style={[styles.modeHint, { color: active ? colors.primary : colors.textSecondary }]}>{option.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.paletteLabel, { color: colors.textSecondary }]}>Accent theme</Text>
          <ThemePicker />
        </Card>

        <Card style={styles.card} padding="lg">
          <View style={styles.sectionHead}>
            <View style={[styles.sectionIcon, { backgroundColor: `${colors.warning}16` }]}>
              <Ionicons name="notifications-outline" size={16} color={colors.warning} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Get reminded for daily challenges</Text>
            </View>
          </View>

          <View style={[styles.switchRow, { borderColor: colors.border }]}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.switchTitle, { color: colors.text }]}>Daily puzzle reminder</Text>
              <Text style={[styles.switchSubtitle, { color: colors.textSecondary }]}>Receive a prompt when a new puzzle is live.</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: `${colors.primary}55` }}
              thumbColor={notificationsEnabled ? colors.primary : colors.textTertiary}
            />
          </View>
        </Card>

        <Card style={styles.card} padding="lg">
          <View style={styles.sectionHead}>
            <View style={[styles.sectionIcon, { backgroundColor: `${colors.correct}16` }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.correct} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Account & Security</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Credentials and session controls</Text>
            </View>
          </View>

          {email ? (
            <View style={[styles.emailPill, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.emailText, { color: colors.textSecondary }]}>{email}</Text>
            </View>
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

        <Card style={styles.card} padding="lg">
          <View style={styles.sectionHead}>
            <View style={[styles.sectionIcon, { backgroundColor: `${colors.secondary}16` }]}>
              <Ionicons name="help-buoy-outline" size={16} color={colors.secondary} />
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Help & About</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Support resources and app details</Text>
            </View>
          </View>

          <Pressable
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
            onPress={() => showAlert('Coming Soon', 'FAQ section is under development.')}
          >
            <View style={styles.linkLeft}>
              <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.linkText, { color: colors.text }]}>FAQ</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </Pressable>

          <Pressable
            style={[styles.linkRow, { borderBottomColor: colors.border }]}
            onPress={() => showAlert('Coming Soon', 'Contact support is under development.')}
          >
            <View style={styles.linkLeft}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.linkText, { color: colors.text }]}>Contact Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </Pressable>

          <View style={styles.aboutGrid}>
            <View style={[styles.aboutPill, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Version</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]}>1.0.0</Text>
            </View>
            <View style={[styles.aboutPill, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Team</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]}>MindArena</Text>
            </View>
          </View>
        </Card>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundLayer: { ...StyleSheet.absoluteFillObject },
  bgOrbTop: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -80,
    right: -72,
  },
  bgOrbBottom: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: 80,
    left: -92,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    alignSelf: 'center',
    width: '100%',
  },

  heroCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    top: -65,
    right: -48,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#fff',
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.black,
    marginTop: 2,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  heroIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  heroMetaText: {
    color: '#fff',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  card: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
  },

  sectionHead: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.black },
  sectionSubtitle: { fontSize: fontSize.xs, marginTop: 2 },

  modeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modeLabel: { marginTop: 4, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  modeHint: { fontSize: fontSize.xs, marginTop: 2 },
  paletteLabel: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
    fontWeight: fontWeight.semibold,
  },

  switchRow: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  switchLabelWrap: { flex: 1 },
  switchTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  switchSubtitle: { fontSize: fontSize.sm, marginTop: 2 },

  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  emailText: { fontSize: fontSize.sm },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkText: { fontSize: fontSize.base, fontWeight: fontWeight.medium },

  aboutGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  aboutPill: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  aboutLabel: { fontSize: fontSize.xs },
  aboutValue: { fontSize: fontSize.base, fontWeight: fontWeight.bold, marginTop: 2 },
});
