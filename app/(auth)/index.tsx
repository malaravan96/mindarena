import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { AuthWaveLayout } from '@/components/auth/AuthWaveLayout';
import { AnimatedItem } from '@/components/auth/AnimatedItem';
import { OtpInputRow } from '@/components/auth/OtpInputRow';
import { AUTH_CORAL, AUTH_INPUT_BORDER } from '@/constants/authColors';
import { fontSize, fontWeight, spacing } from '@/constants/theme';
import { formatCooldown, useResendCooldown } from '@/hooks/useResendCooldown';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const { canResend, secondsLeft, startCooldown } = useResendCooldown(RESEND_COOLDOWN_SECONDS);

  async function sendOtpCode() {
    const v = email.trim();
    setError('');

    if (!v) {
      setError('Email is required');
      return;
    }

    if (!v.includes('@') || !v.includes('.')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithOtp({ email: v });
      if (authError) throw authError;
      setStep('otp');
      startCooldown();
      showAlert('Code Sent!', 'We sent a 6-digit verification code to your email.');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
      showAlert('Failed to Send Code', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'email',
      });

      if (verifyError) throw verifyError;

      router.replace('/(app)');
    } catch (e: any) {
      console.error('OTP verification error:', e);
      setError(e?.message || 'Invalid or expired code. Please try again.');
      showAlert('Verification Failed', e?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(text: string, index: number) {
    setError('');
    const newOtp = [...otp];

    if (text.length > 1) {
      const digits = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
      for (let i = 0; i < OTP_LENGTH; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      const focusIndex = Math.min(digits.length, OTP_LENGTH - 1);
      otpRefs.current[focusIndex]?.focus();
      return;
    }

    const digit = text.replace(/[^0-9]/g, '');
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  }

  async function handleResendCode() {
    if (!canResend) return;

    setLoading(true);
    setError('');
    setOtp(Array(OTP_LENGTH).fill(''));

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });
      if (authError) throw authError;
      startCooldown();
      showAlert('Code Resent!', 'A new verification code has been sent to your email.');
    } catch (e: any) {
      setError(e?.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  }

  const heroTitle = step === 'email' ? 'Sign in' : 'Verify Code';
  const heroSubtitle =
    step === 'email'
      ? 'Play daily. Think sharper. Stay ahead.'
      : `Enter the code sent to ${email}`;
  const resendDisabled = loading || !canResend;
  const resendLabel = canResend ? 'Resend' : `Resend in ${formatCooldown(secondsLeft)}`;

  return (
    <AuthWaveLayout
      heroTitle={heroTitle}
      heroSubtitle={heroSubtitle}
      onBack={
        step === 'otp'
          ? () => {
              setStep('email');
              setOtp(Array(OTP_LENGTH).fill(''));
              setError('');
            }
          : undefined
      }
      scrollable
    >
      {step === 'email' ? (
        <>
          <AnimatedItem delay={0}>
            <Text style={styles.formHeading}>Sign in with email</Text>
            <Text style={styles.formSubtitle}>
              Get a one-time code instantly and continue where you left off.
            </Text>
          </AnimatedItem>

          <AnimatedItem delay={70}>
            <Input
              label="Email Address"
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
              focusColor={AUTH_CORAL}
              clearable
              returnKeyType="go"
              onSubmitEditing={sendOtpCode}
              style={styles.inputInner}
            />
          </AnimatedItem>

          <AnimatedItem delay={140}>
            <Button
              title={loading ? 'Sending...' : 'Send Verification Code'}
              onPress={sendOtpCode}
              disabled={loading || !email.trim()}
              loading={loading}
              variant="primary"
              fullWidth
              size="lg"
              style={styles.primaryBtn}
            />
          </AnimatedItem>

          <AnimatedItem delay={200}>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Link href="/(auth)/sign-in-password" asChild>
              <Button
                title="Use Password Instead"
                onPress={() => {}}
                variant="outline"
                fullWidth
                size="lg"
              />
            </Link>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Need an account?</Text>
              <Link href="/(auth)/register" asChild>
                <Text style={styles.footerLink}>Create one</Text>
              </Link>
            </View>
          </AnimatedItem>
        </>
      ) : (
        <>
          <AnimatedItem delay={0}>
            <Text style={styles.formHeading}>Enter verification code</Text>
            <Text style={styles.formSubtitle}>
              Use the latest 6-digit code from your inbox.
            </Text>
          </AnimatedItem>

          <AnimatedItem delay={80}>
            <OtpInputRow
              otp={otp}
              error={error}
              loading={loading}
              inputRefs={otpRefs}
              onChange={handleOtpChange}
              onKeyPress={handleOtpKeyPress}
              autoFocusFirst
              activeColor={AUTH_CORAL}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </AnimatedItem>

          <AnimatedItem delay={150}>
            <Button
              title={loading ? 'Verifying...' : 'Verify & Sign In'}
              onPress={handleVerifyOtp}
              disabled={loading || otp.join('').length !== OTP_LENGTH}
              loading={loading}
              variant="primary"
              fullWidth
              size="lg"
              style={styles.primaryBtn}
            />
          </AnimatedItem>

          <AnimatedItem delay={210}>
            <View style={styles.resendRow}>
              <Text style={styles.resendText}>No code yet?</Text>
              <Pressable
                onPress={resendDisabled ? undefined : handleResendCode}
                accessibilityRole="button"
                accessibilityLabel={resendLabel}
                accessibilityState={{ disabled: resendDisabled }}
                hitSlop={8}
              >
                <Text style={[styles.resendLink, { color: resendDisabled ? '#888888' : AUTH_CORAL }]}>
                  {resendLabel}
                </Text>
              </Pressable>
            </View>
          </AnimatedItem>
        </>
      )}
    </AuthWaveLayout>
  );
}

const styles = StyleSheet.create({
  formHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: fontSize.sm,
    color: '#888888',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputInner: {
    backgroundColor: '#FAFAFA',
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
  errorText: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: '#ef4444',
    marginBottom: spacing.sm,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  resendText: {
    fontSize: fontSize.sm,
    color: '#888888',
  },
  resendLink: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
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
