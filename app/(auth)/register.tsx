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
import { validateEmail, validatePassword, validateUsername } from '@/lib/validation';
import { useEntryAnimation } from '@/lib/useEntryAnimation';

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    username?: string;
  }>({});
  const { colors } = useTheme();
  const anim = useEntryAnimation();

  function validateForm() {
    const newErrors: typeof errors = {};

    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;

    const usernameError = validateUsername(username);
    if (usernameError) newErrors.username = usernameError;

    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleRegister() {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.trim(),
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error('Registration failed. Please try again.');
      }

      showAlert(
        'Registration Successful!',
        'We sent a verification code to your email. Please verify to complete your account.',
      );
      router.push({ pathname: '/(auth)/verify-email', params: { email: email.trim() } });
    } catch (e: any) {
      const msg = e?.message || 'Something went wrong. Please try again.';
      showAlert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  const maxWidth = isDesktop ? 500 : isTablet ? 560 : '100%';

  return (
    <AuthScaffold animatedStyle={anim} maxWidth={maxWidth} scrollable>
      <AuthHeader
        icon={<Ionicons name="person-add-outline" size={34} color="#ffffff" />}
        title="Create Account"
        subtitle="Set up your MindArena profile and start your first challenge"
        onBack={() => router.back()}
      />

      <Card style={[styles.card, { borderColor: `${colors.primary}22` }]}>
        <View style={[styles.badge, { backgroundColor: `${colors.primary}16` }]}>
          <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
          <Text style={[styles.badgeText, { color: colors.primary }]}>New Player Setup</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Your account details</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Choose a unique username and a strong password to secure your progress.</Text>

        <Input
          label="Username"
          icon={<Ionicons name="at" size={18} color={colors.textTertiary} />}
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            if (errors.username) setErrors({ ...errors, username: undefined });
          }}
          placeholder="Choose a username"
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
          error={errors.username}
          editable={!loading}
        />

        <Input
          label="Email Address"
          icon={<Ionicons name="mail-outline" size={18} color={colors.textTertiary} />}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) setErrors({ ...errors, email: undefined });
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
            if (errors.password) setErrors({ ...errors, password: undefined });
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
          label="Confirm Password"
          icon={<Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />}
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
          }}
          placeholder="Re-enter your password"
          secureTextEntry
          showPasswordToggle
          autoCapitalize="none"
          autoComplete="password-new"
          textContentType="newPassword"
          error={errors.confirmPassword}
          editable={!loading}
        />

        <Button
          title={loading ? 'Creating Account...' : 'Create Account'}
          onPress={handleRegister}
          disabled={loading}
          loading={loading}
          variant="gradient"
          fullWidth
          size="lg"
          style={styles.primaryCta}
        />

        <View style={[styles.trustChip, { backgroundColor: colors.surfaceVariant }]}> 
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.trustChipText, { color: colors.textSecondary }]}>Encrypted account data and secure authentication</Text>
        </View>
      </Card>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Already have an account?</Text>
        <Link href="/(auth)" asChild>
          <Text style={[styles.footerLink, { color: colors.primary }]}>Sign In</Text>
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
  primaryCta: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.full,
  },
  trustChip: {
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trustChipText: {
    fontSize: fontSize.xs,
    flex: 1,
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
