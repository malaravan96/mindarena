import React from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ThemePicker } from '@/components/ThemePicker';
import { ProfileSectionHeading } from './ProfileSectionHeading';
import { showAlert } from '@/lib/alert';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, borderRadius } from '@/constants/theme';

const modeOptions = [
  { key: 'light' as const, icon: 'sunny-outline' as const, label: 'Light', hint: 'Always bright' },
  { key: 'dark' as const, icon: 'moon-outline' as const, label: 'Dark', hint: 'Low light' },
  { key: 'auto' as const, icon: 'phone-portrait-outline' as const, label: 'Auto', hint: 'System sync' },
];

interface ProfileSettingsSectionProps {
  theme: string;
  setTheme: (t: 'light' | 'dark' | 'auto') => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
  email: string;
  onResetPassword: () => void;
  onSignOut: () => void;
}

export const ProfileSettingsSection = React.memo(function ProfileSettingsSection({
  theme,
  setTheme,
  notificationsEnabled,
  setNotificationsEnabled,
  email,
  onResetPassword,
  onSignOut,
}: ProfileSettingsSectionProps) {
  const { colors } = useTheme();

  return (
    <Animated.View entering={FadeIn.delay(100).duration(300)}>
      {/* Appearance */}
      <Card style={styles.card} padding="lg">
        <ProfileSectionHeading
          icon="color-palette-outline"
          title="Appearance"
          subtitle="Theme mode and accent palette"
        />
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
                <Text style={[styles.modeLabel, { color: active ? colors.primary : colors.text }]}>
                  {option.label}
                </Text>
                <Text
                  style={[styles.modeHint, { color: active ? colors.primary : colors.textSecondary }]}
                >
                  {option.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.paletteLabel, { color: colors.textSecondary }]}>Accent theme</Text>
        <ThemePicker />
      </Card>

      {/* Notifications */}
      <Card style={styles.card} padding="lg">
        <ProfileSectionHeading
          icon="notifications-outline"
          title="Notifications"
          subtitle="Get reminded for daily challenges"
        />
        <View style={[styles.switchRow, { borderColor: colors.border }]}>
          <View style={styles.switchLabelWrap}>
            <Text style={[styles.switchTitle, { color: colors.text }]}>Daily puzzle reminder</Text>
            <Text style={[styles.switchSubtitle, { color: colors.textSecondary }]}>
              Receive a prompt when a new puzzle is live.
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: colors.border, true: `${colors.primary}55` }}
            thumbColor={notificationsEnabled ? colors.primary : colors.textTertiary}
          />
        </View>
      </Card>

      {/* Account & Security */}
      <Card style={styles.card} padding="lg">
        <ProfileSectionHeading
          icon="shield-checkmark-outline"
          title="Account & Security"
          subtitle="Credentials and session controls"
        />
        {email ? (
          <View style={[styles.emailPill, { backgroundColor: colors.surfaceVariant }]}>
            <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.emailPillText, { color: colors.textSecondary }]}>{email}</Text>
          </View>
        ) : null}
        <Button title="Reset Password" onPress={onResetPassword} variant="outline" fullWidth size="lg" />
        <Button
          title="Sign Out"
          onPress={onSignOut}
          variant="outline"
          fullWidth
          size="lg"
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      {/* Help & About */}
      <Card style={styles.card} padding="lg">
        <ProfileSectionHeading
          icon="help-buoy-outline"
          title="Help & About"
          subtitle="Support resources and app details"
        />
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
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
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
    borderRadius: 9999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  emailPillText: { fontSize: fontSize.sm },
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
