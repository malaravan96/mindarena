import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { AuthWaveLayout } from '@/components/auth/AuthWaveLayout';
import { AUTH_CORAL, AUTH_INPUT_BORDER } from '@/constants/authColors';
import { fontSize, fontWeight, spacing } from '@/constants/theme';
import { validateEmail } from '@/lib/validation';

export default function SignInWithPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

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

  return (
    <AuthWaveLayout
      heroTitle="Sign in"
      heroSubtitle="Pick up your challenge streak"
      onBack={() => router.back()}
      scrollable
    >
      <Text style={styles.formHeading}>Account access</Text>

      <Input
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
        style={styles.inputInner}
      />

      <Input
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (errors.password) setErrors({ ...errors, password: undefined });
        }}
        placeholder="Enter your password"
        secureTextEntry
        showPasswordToggle
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
        error={errors.password}
        editable={!loading}
        focusColor={AUTH_CORAL}
        style={styles.inputInner}
      />

      <Link href="/(auth)/forgot-password" asChild>
        <Text style={styles.forgotPassword}>Forgot password?</Text>
      </Link>

      <Button
        title={loading ? 'Signing In...' : 'Login'}
        onPress={handleSignIn}
        disabled={loading}
        loading={loading}
        variant="primary"
        fullWidth
        size="lg"
        style={styles.primaryBtn}
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
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

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account?</Text>
        <Link href="/(auth)/register" asChild>
          <Text style={styles.footerLink}>Sign Up</Text>
        </Link>
      </View>
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
  forgotPassword: {
    textAlign: 'right',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: AUTH_CORAL,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  primaryBtn: {
    backgroundColor: AUTH_CORAL,
    borderRadius: 999,
    borderColor: AUTH_CORAL,
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
    backgroundColor: AUTH_INPUT_BORDER,
  },
  dividerText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#888888',
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
