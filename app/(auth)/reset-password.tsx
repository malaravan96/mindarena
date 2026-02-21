import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { AuthHeader } from '@/components/AuthHeader';
import { PasswordStrengthBar } from '@/components/PasswordStrengthBar';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { useTheme } from '@/contexts/ThemeContext';
import {
  borderRadius,
  fontSize,
  fontWeight,
  isDesktop,
  isTablet,
  spacing,
} from '@/constants/theme';
import { validatePassword } from '@/lib/validation';
import { useEntryAnimation } from '@/lib/useEntryAnimation';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const { colors } = useTheme();
  const anim = useEntryAnimation();

  async function handleUpdatePassword() {
    const newErrors: typeof errors = {};

    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      showAlert('Password Updated!', 'Your password has been successfully updated.');
      router.replace('/(app)');
    } catch (e: any) {
      console.error('Password update error:', e);
      showAlert('Update Failed', e?.message || 'Could not update password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const maxWidth = isDesktop ? 520 : isTablet ? 580 : '100%';

  return (
    <AuthScaffold animatedStyle={anim} maxWidth={maxWidth} scrollable>
      <AuthHeader
        icon={<Ionicons name="lock-open-outline" size={34} color="#ffffff" />}
        title="Create New Password"
        subtitle="Choose a strong password you have not used before"
        onBack={() => router.back()}
      />

      <Card style={[styles.card, { borderColor: `${colors.primary}22` }]}>
        <View style={[styles.badge, { backgroundColor: `${colors.primary}16` }]}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} />
          <Text style={[styles.badgeText, { color: colors.primary }]}>Security Update</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Set your new password</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Use at least 8 characters with upper/lowercase letters and numbers.</Text>

        <Input
          label="New Password"
          icon={<Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) {
              setErrors({ ...errors, password: undefined });
            }
          }}
          placeholder="Min 8 characters"
          secureTextEntry
          showPasswordToggle
          autoCapitalize="none"
          autoComplete="password-new"
          textContentType="newPassword"
          error={errors.password}
          editable={!loading}
        />

        <PasswordStrengthBar password={password} />

        <Input
          label="Confirm New Password"
          icon={<Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />}
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (errors.confirmPassword) {
              setErrors({ ...errors, confirmPassword: undefined });
            }
          }}
          placeholder="Re-enter your new password"
          secureTextEntry
          showPasswordToggle
          autoCapitalize="none"
          autoComplete="password-new"
          textContentType="newPassword"
          error={errors.confirmPassword}
          editable={!loading}
        />

        <Button
          title={loading ? 'Updating...' : 'Update Password'}
          onPress={handleUpdatePassword}
          disabled={loading}
          loading={loading}
          variant="gradient"
          fullWidth
          size="lg"
          style={styles.primaryCta}
        />

        <View style={[styles.infoRow, { backgroundColor: colors.surfaceVariant }]}> 
          <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>Updating your password signs out inactive sessions on some devices.</Text>
        </View>
      </Card>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: borderRadius.xl,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: fontSize.sm * 1.35,
  },
  primaryCta: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.full,
  },
  infoRow: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoText: {
    fontSize: fontSize.xs,
    flex: 1,
  },
});
