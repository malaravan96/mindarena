import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { AuthWaveLayout } from '@/components/auth/AuthWaveLayout';
import { AnimatedItem } from '@/components/auth/AnimatedItem';
import { OtpInputRow } from '@/components/auth/OtpInputRow';
import { AUTH_CORAL } from '@/constants/authColors';
import { fontSize, fontWeight, spacing } from '@/constants/theme';
import { formatCooldown, useResendCooldown } from '@/hooks/useResendCooldown';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(params.email || '');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const { canResend, secondsLeft, startCooldown } = useResendCooldown(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!email) loadUserEmail();
  }, []);

  async function loadUserEmail() {
    const { data } = await supabase.auth.getUser();
    if (data.user?.email) setEmail(data.user.email);
  }

  async function handleVerifyCode() {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      setError('Please enter the full 6-digit code');
      return;
    }

    if (!email) {
      showAlert('Error', 'No email found. Please sign in again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });

      if (verifyError) throw verifyError;

      showAlert('Email Verified!', 'Your email has been verified successfully.');
      router.replace('/(app)');
    } catch (e: any) {
      console.error('Email verification error:', e);
      setError(e?.message || 'Invalid or expired code. Please try again.');
      showAlert('Verification Failed', e?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!canResend) return;

    if (!email) {
      showAlert('Error', 'No email found. Please sign in again.');
      return;
    }

    setLoading(true);
    setError('');
    setOtp(Array(OTP_LENGTH).fill(''));

    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      startCooldown();
      showAlert('Code Sent!', 'We sent a new verification code to your email.');
    } catch (e: any) {
      setError(e?.message || 'Failed to resend verification code.');
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
      otpRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
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
  const resendDisabled = loading || !canResend;
  const resendLabel = canResend ? 'Resend' : `Resend in ${formatCooldown(secondsLeft)}`;

  return (
    <AuthWaveLayout
      heroTitle="Verify email"
      heroSubtitle="One last step to activate your account"
      scrollable
    >
      <AnimatedItem delay={0}>
        <Text style={styles.formHeading}>Confirm your inbox code</Text>
        <Text style={styles.formSubtitle}>
          We sent a verification code to{' '}
          <Text style={styles.emailHighlight}>{email}</Text>
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
          title={loading ? 'Verifying...' : 'Verify Email'}
          onPress={handleVerifyCode}
          disabled={loading || otp.join('').length !== OTP_LENGTH}
          loading={loading}
          variant="primary"
          fullWidth
          style={styles.primaryBtn}
        />
      </AnimatedItem>

      <AnimatedItem delay={210}>
        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Didn't receive the code?</Text>
          <Pressable
            onPress={resendDisabled ? undefined : resendVerification}
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

        <Button
          title="Continue to App"
          onPress={() => router.replace('/(app)')}
          variant="outline"
          fullWidth
          style={styles.secondaryCta}
        />

        <Text style={styles.helperText}>
          You can verify later from your profile settings if needed.
        </Text>
      </AnimatedItem>
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
  emailHighlight: {
    fontWeight: fontWeight.bold,
    color: AUTH_CORAL,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontSize: fontSize.sm,
    color: '#ef4444',
  },
  primaryBtn: {
    backgroundColor: AUTH_CORAL,
    borderRadius: 999,
    borderColor: AUTH_CORAL,
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
  secondaryCta: {
    marginTop: spacing.md,
    borderRadius: 999,
  },
  helperText: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: '#888888',
    marginTop: spacing.md,
    paddingBottom: spacing.md,
  },
});
