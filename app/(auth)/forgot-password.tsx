import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { AuthHeader } from '@/components/AuthHeader';
import { ThemeAccessButton } from '@/components/ThemeAccessButton';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, isDesktop, isTablet } from '@/constants/theme';
import { validateEmail } from '@/lib/validation';
import { useEntryAnimation } from '@/lib/useEntryAnimation';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { colors } = useTheme();
  const anim = useEntryAnimation();

  async function handleResetPassword() {
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'mindarena://reset-password',
      });

      if (resetError) throw resetError;

      setSuccess(true);
      showAlert(
        'Check your email',
        'We sent you a password reset link. Click it to create a new password.',
      );
    } catch (e: any) {
      console.error('Password reset error:', e);
      setError(e?.message || 'Something went wrong. Please try again.');
      showAlert(
        'Reset Failed',
        e?.message || 'Could not send reset email. Please try again.',
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
          icon={'\u{1F511}'}
          title="Reset Password"
          subtitle="Enter your email to receive a password reset link"
          onBack={() => router.back()}
        />

        {/* Reset Form */}
        <Card style={styles.card}>
          {!success ? (
            <>
              <Input
                label="Email Address"
                icon={'\u2709'}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError('');
                }}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                error={error}
                editable={!loading}
              />

              <Button
                title={loading ? 'Sending...' : 'Send Reset Link'}
                onPress={handleResetPassword}
                disabled={loading}
                loading={loading}
                variant="gradient"
                fullWidth
                size="lg"
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
                We'll send you an email with instructions to reset your password
              </Text>
            </>
          ) : (
            <View style={styles.successContainer}>
              <View style={[styles.successCircle, { backgroundColor: `${colors.success}20` }]}>
                <Text style={styles.successEmoji}>{'\u2705'}</Text>
              </View>
              <Text
                style={[
                  styles.successTitle,
                  {
                    color: colors.text,
                    fontSize: fontSize.xl,
                    fontWeight: fontWeight.bold,
                  },
                ]}
              >
                Email sent!
              </Text>
              <Text
                style={[
                  styles.successMessage,
                  {
                    color: colors.textSecondary,
                    fontSize: fontSize.base,
                  },
                ]}
              >
                We sent a password reset link to{' '}
                <Text style={{ fontWeight: fontWeight.bold, color: colors.primary }}>
                  {email}
                </Text>
              </Text>
              <Button
                title="Send another link"
                onPress={() => setSuccess(false)}
                variant="outline"
                fullWidth
                style={{ marginTop: spacing.lg }}
              />
              <Button
                title="Back to Sign In"
                onPress={() => router.push('/(auth)')}
                variant="gradient"
                fullWidth
                style={{ marginTop: spacing.sm }}
              />
            </View>
          )}
        </Card>

        {/* Back to Sign In Link */}
        {!success && (
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Remember your password?{' '}
            </Text>
            <Link href="/(auth)" asChild>
              <Text
                style={[
                  styles.footerLink,
                  { color: colors.primary, fontWeight: fontWeight.bold },
                ]}
              >
                Sign In
              </Text>
            </Link>
          </View>
        )}
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
    marginBottom: spacing.md,
  },
  helperText: {
    textAlign: 'center',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successEmoji: {
    fontSize: 36,
  },
  successTitle: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successMessage: {
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footerText: {
    fontSize: fontSize.sm,
  },
  footerLink: {
    fontSize: fontSize.sm,
  },
});
