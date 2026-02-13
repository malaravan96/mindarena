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

export default function SignInWithPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const { colors } = useTheme();
  const anim = useEntryAnimation();

  async function handleSignIn() {
    const newErrors: typeof errors = {};

    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

      if (!data.user) {
        throw new Error('Sign in failed. Please try again.');
      }

      // Navigation will be handled automatically by the auth state change
      router.replace('/(app)');
    } catch (e: any) {
      console.error('Sign in error:', e);
      showAlert(
        'Sign In Failed',
        e?.message || 'Invalid email or password. Please try again.',
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
          icon={'\u{1F9E0}'}
          title="Welcome Back"
          subtitle="Sign in to continue your mind challenge"
          onBack={() => router.back()}
        />

        {/* Sign In Form */}
        <Card style={styles.card}>
          <Input
            label="Email Address"
            icon={'\u2709'}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) {
                setErrors({ ...errors, email: undefined });
              }
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            error={errors.email}
            editable={!loading}
          />

          <Input
            label="Password"
            icon={'\u{1F512}'}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) {
                setErrors({ ...errors, password: undefined });
              }
            }}
            placeholder="Enter your password"
            secureTextEntry
            showPasswordToggle
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            error={errors.password}
            editable={!loading}
          />

          <Link href="/(auth)/forgot-password" asChild>
            <Text
              style={[
                styles.forgotPassword,
                {
                  color: colors.primary,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  marginTop: -spacing.xs,
                  marginBottom: spacing.md,
                  textAlign: 'right',
                },
              ]}
            >
              Forgot password?
            </Text>
          </Link>

          <Button
            title={loading ? 'Signing In...' : 'Sign In'}
            onPress={handleSignIn}
            disabled={loading}
            loading={loading}
            variant="gradient"
            fullWidth
            size="lg"
          />

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textTertiary }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <Link href="/(auth)" asChild>
            <Button
              title="Sign in with Magic Link"
              onPress={() => {}}
              variant="outline"
              fullWidth
              size="lg"
            />
          </Link>
        </Card>

        {/* Sign Up Link */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Don't have an account?{' '}
          </Text>
          <Link href="/(auth)/register" asChild>
            <Text
              style={[
                styles.footerLink,
                { color: colors.primary, fontWeight: fontWeight.bold },
              ]}
            >
              Sign Up
            </Text>
          </Link>
        </View>
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
  forgotPassword: {
    textDecorationLine: 'underline',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
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
