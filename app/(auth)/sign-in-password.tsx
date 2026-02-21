import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { AuthHeader } from '@/components/AuthHeader';
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

      router.replace('/(app)');
    } catch (e: any) {
      console.error('Sign in error:', e);

      if (e?.message?.toLowerCase().includes('email not confirmed')) {
        try {
          await supabase.auth.resend({ type: 'signup', email: email.trim() });
        } catch {
          // ignore resend error
        }
        showAlert(
          'Email Not Verified',
          'We sent a new verification code to your email. Please verify to continue.',
        );
        router.push({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
        setLoading(false);
        return;
      }

      showAlert('Sign In Failed', e?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const maxWidth = isDesktop ? 520 : isTablet ? 580 : '100%';

  return (
    <AuthScaffold animatedStyle={anim} maxWidth={maxWidth} scrollable>
      <AuthHeader
        icon={<Ionicons name="log-in-outline" size={34} color="#ffffff" />}
        title="Welcome Back"
        subtitle="Sign in with your password and pick up your challenge streak"
        onBack={() => router.back()}
      />

      <Card style={[styles.card, { borderColor: `${colors.primary}22` }]}>
        <View style={[styles.badge, { backgroundColor: `${colors.primary}16` }]}>
          <Ionicons name="key-outline" size={14} color={colors.primary} />
          <Text style={[styles.badgeText, { color: colors.primary }]}>Password Sign In</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Account access</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Use your email and password. If your account is unverified, we will send a new code.</Text>

        <Input
          label="Email Address"
          icon={<Ionicons name="mail-outline" size={18} color={colors.textTertiary} />}
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
          icon={<Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />}
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
          <Text style={[styles.forgotPassword, { color: colors.primary }]}>Forgot password?</Text>
        </Link>

        <Button
          title={loading ? 'Signing In...' : 'Sign In'}
          onPress={handleSignIn}
          disabled={loading}
          loading={loading}
          variant="gradient"
          fullWidth
          size="lg"
          style={styles.primaryCta}
        />

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textTertiary }]}>OR</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <Link href="/(auth)" asChild>
          <Button
            title="Sign in with Email Code"
            onPress={() => {}}
            variant="outline"
            fullWidth
            size="lg"
          />
        </Link>
      </Card>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Don't have an account?</Text>
        <Link href="/(auth)/register" asChild>
          <Text style={[styles.footerLink, { color: colors.primary }]}>Sign Up</Text>
        </Link>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
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
  forgotPassword: {
    textAlign: 'right',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  primaryCta: {
    borderRadius: borderRadius.full,
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
    fontWeight: fontWeight.semibold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  footerText: {
    fontSize: fontSize.sm,
  },
  footerLink: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
});
