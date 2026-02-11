import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, isDesktop, isTablet } from '@/constants/theme';
import { validatePassword } from '@/lib/validation';

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

      Alert.alert(
        'Password Updated!',
        'Your password has been successfully updated. You can now sign in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(app)'),
          },
        ]
      );
    } catch (e: any) {
      console.error('Password update error:', e);
      Alert.alert(
        'Update Failed',
        e?.message || 'Could not update password. Please try again.'
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
      <View style={[styles.content, { maxWidth, width: '100%' }]}>
        {/* App Icon/Logo */}
        <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoEmoji}>🔒</Text>
        </View>

        {/* Title Section */}
        <View style={styles.headerSection}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: fontSize['3xl'],
                fontWeight: fontWeight.black,
              },
            ]}
          >
            Create New Password
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: colors.textSecondary,
                fontSize: fontSize.base,
                fontWeight: fontWeight.medium,
              },
            ]}
          >
            Enter your new password below
          </Text>
        </View>

        {/* Reset Form */}
        <Card style={styles.card}>
          <Input
            label="New Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) {
                setErrors({ ...errors, password: undefined });
              }
            }}
            placeholder="Min 8 characters"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            error={errors.password}
            editable={!loading}
          />

          <Input
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errors.confirmPassword) {
                setErrors({ ...errors, confirmPassword: undefined });
              }
            }}
            placeholder="Re-enter your new password"
            secureTextEntry
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
            fullWidth
            size="lg"
            style={{ marginTop: spacing.sm }}
          />

          <Text
            style={[
              styles.helperText,
              {
                color: colors.textSecondary,
                fontSize: fontSize.xs,
                marginTop: spacing.md,
              },
            ]}
          >
            Password must be at least 8 characters with uppercase, lowercase, and a number
          </Text>
        </Card>
      </View>
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
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoEmoji: {
    fontSize: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 400,
  },
  card: {
    width: '100%',
  },
  helperText: {
    textAlign: 'center',
  },
});
