import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { AuthHeader } from '@/components/AuthHeader';
import { ThemeAccessButton } from '@/components/ThemeAccessButton';
import { PasswordStrengthBar } from '@/components/PasswordStrengthBar';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, isDesktop, isTablet } from '@/constants/theme';
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

      showAlert(
        'Password Updated!',
        'Your password has been successfully updated.',
      );
      router.replace('/(app)');
    } catch (e: any) {
      console.error('Password update error:', e);
      showAlert(
        'Update Failed',
        e?.message || 'Could not update password. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  const maxWidth = isDesktop ? 500 : isTablet ? 600 : '100%';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.wrap, { backgroundColor: colors.background }]}
    >
      <ThemeAccessButton />

      <Animated.View style={[styles.content, { maxWidth, width: '100%' }, anim]}>
        <AuthHeader
          icon={<Ionicons name="lock-open-outline" size={34} color="#ffffff" />}
          title="Create New Password"
          subtitle="Enter your new password below"
          onBack={() => router.back()}
        />

        {/* Reset Form */}
        <Card style={styles.card}>
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
            style={{ marginTop: spacing.sm }}
          />

          <View style={styles.helperRow}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
            <Text
              style={[
                styles.helperText,
                {
                  color: colors.textSecondary,
                  fontSize: fontSize.xs,
                },
              ]}
            >
              Password must be at least 8 characters with uppercase, lowercase, and a number
            </Text>
          </View>
        </Card>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  card: {
    width: '100%',
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  helperText: {
    textAlign: 'center',
    flex: 1,
  },
});
