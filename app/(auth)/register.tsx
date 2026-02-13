import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
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
          emailRedirectTo: 'mindarena://',
          data: {
            username: username.trim(),
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error('Registration failed. Please try again.');
      }

      // Profile is auto-created by the database trigger (handle_new_user).
      // No manual insert needed here.

      showAlert(
        'Registration Successful!',
        'Please check your email to verify your account. You can start using the app right away!',
      );
    } catch (e: any) {
      const msg = e?.message || 'Something went wrong. Please try again.';
      showAlert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  const maxWidth = isDesktop ? 480 : isTablet ? 520 : '100%';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.wrap, { backgroundColor: colors.background }]}
    >
      <ThemeAccessButton />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { maxWidth, width: '100%' }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.inner, anim]}>
          <AuthHeader
            icon={'\u{1F9E0}'}
            title="Create Account"
            subtitle="Join MindArena and start challenging your mind"
            onBack={() => router.back()}
          />

          {/* Form */}
          <Card style={styles.card}>
            <Input
              label="Username"
              icon="@"
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
              icon={'\u2709'}
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
              icon={'\u{1F512}'}
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
              icon={'\u{1F512}'}
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
              style={{ marginTop: spacing.sm }}
            />
          </Card>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)" asChild>
              <Text style={[styles.footerLink, { color: colors.primary, fontWeight: fontWeight.bold }]}>
                Sign In
              </Text>
            </Link>
          </View>

          <Text style={[styles.trustText, { color: colors.textTertiary }]}>
            {'\u{1F512}'} Your data is safe and encrypted
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    alignSelf: 'center',
  },
  inner: {
    width: '100%',
    alignItems: 'center',
  },
  card: { width: '100%', marginBottom: spacing.md },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footerText: { fontSize: fontSize.sm },
  footerLink: { fontSize: fontSize.sm },
  trustText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
