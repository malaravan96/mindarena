import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PasswordStrengthBar } from '@/components/PasswordStrengthBar';
import { AuthWaveLayout } from '@/components/auth/AuthWaveLayout';
import { AnimatedItem } from '@/components/auth/AnimatedItem';
import { AUTH_CORAL } from '@/constants/authColors';
import { fontSize, fontWeight, spacing } from '@/constants/theme';
import { validateEmail, validatePassword, validateUsername } from '@/lib/validation';

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
  const emailRef = useRef<TextInput | null>(null);
  const passwordRef = useRef<TextInput | null>(null);
  const confirmPasswordRef = useRef<TextInput | null>(null);

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
          data: { username: username.trim() },
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
      showAlert('Registration Failed', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthWaveLayout
      heroTitle="Create account"
      heroSubtitle="Set up your MindArena profile"
      onBack={() => router.back()}
      scrollable
    >
      <AnimatedItem delay={0}>
        <Text style={styles.formHeading}>Your account details</Text>
      </AnimatedItem>

      <AnimatedItem delay={60}>
        <Input
          label="Username"
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
          focusColor={AUTH_CORAL}
          maxLength={20}
          showCharacterCount
          clearable
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => emailRef.current?.focus?.()}
          style={styles.inputInner}
        />
      </AnimatedItem>

      <AnimatedItem delay={110}>
        <Input
          ref={emailRef}
          label="Email Address"
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
          focusColor={AUTH_CORAL}
          clearable
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => passwordRef.current?.focus?.()}
          style={styles.inputInner}
        />
      </AnimatedItem>

      <AnimatedItem delay={160}>
        <Input
          ref={passwordRef}
          label="Password"
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
          focusColor={AUTH_CORAL}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => confirmPasswordRef.current?.focus?.()}
          style={styles.inputInner}
        />
        <PasswordStrengthBar password={password} />
      </AnimatedItem>

      <AnimatedItem delay={210}>
        <Input
          ref={confirmPasswordRef}
          label="Confirm Password"
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
          focusColor={AUTH_CORAL}
          returnKeyType="go"
          onSubmitEditing={handleRegister}
          style={styles.inputInner}
        />
      </AnimatedItem>

      <AnimatedItem delay={260}>
        <Button
          title={loading ? 'Creating Account...' : 'Create Account'}
          onPress={handleRegister}
          disabled={loading || !email.trim() || !username.trim() || !password || !confirmPassword}
          loading={loading}
          variant="primary"
          fullWidth
          size="lg"
          style={styles.primaryBtn}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Link href="/(auth)" asChild>
            <Text style={styles.footerLink}>Sign In</Text>
          </Link>
        </View>
      </AnimatedItem>
    </AuthWaveLayout>
  );
}

const styles = StyleSheet.create({
  formHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginBottom: 20,
  },
  inputInner: {
    backgroundColor: '#FAFAFA',
  },
  primaryBtn: {
    backgroundColor: AUTH_CORAL,
    borderRadius: 999,
    borderColor: AUTH_CORAL,
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  footerText: {
    fontSize: fontSize.sm,
    color: '#888888',
  },
  footerLink: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: AUTH_CORAL,
  },
});
