import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { AuthWaveLayout } from '@/components/auth/AuthWaveLayout';
import { AnimatedItem } from '@/components/auth/AnimatedItem';
import { OtpInputRow } from '@/components/auth/OtpInputRow';
import { AUTH_CORAL } from '@/constants/authColors';
import { fontSize, fontWeight, spacing } from '@/constants/theme';
import { validateEmail } from '@/lib/validation';

const OTP_LENGTH = 6;

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);

  async function handleSendCode() {
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (resetError) throw resetError;
      setStep('otp');
      showAlert('Code Sent!', 'We sent a 6-digit verification code to your email.');
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
      showAlert('Failed to Send Code', e?.message || 'Could not send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
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
        type: 'recovery',
      });

      if (verifyError) throw verifyError;

      showAlert('Verified!', 'Code verified successfully. Set your new password.');
      router.replace('/(auth)/reset-password');
    } catch (e: any) {
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

  async function handleResendCode() {
    setLoading(true);
    setError('');
    setOtp(Array(OTP_LENGTH).fill(''));

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (resetError) throw resetError;
      showAlert('Code Resent!', 'A new verification code has been sent to your email.');
    } catch (e: any) {
      setError(e?.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthWaveLayout
      heroTitle={step === 'email' ? 'Reset password' : 'Enter code'}
      heroSubtitle={
        step === 'email'
          ? 'Use your email to receive a secure reset code'
          : `We sent a 6-digit code to ${email}`
      }
      onBack={() => {
        if (step === 'otp') {
          setStep('email');
          setOtp(Array(OTP_LENGTH).fill(''));
          setError('');
        } else {
          router.back();
        }
      }}
      scrollable
    >
      {step === 'email' ? (
        <>
          <AnimatedItem delay={0}>
            <Text style={styles.formHeading}>Recover your account</Text>
            <Text style={styles.formSubtitle}>
              Enter the email linked to your account and we will send a one-time verification code.
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
              style={styles.inputInner}
            />
          </AnimatedItem>

          <AnimatedItem delay={140}>
            <Button
              title={loading ? 'Sending...' : 'Send Verification Code'}
              onPress={handleSendCode}
              disabled={loading}
              loading={loading}
              variant="primary"
              fullWidth
              size="lg"
              style={styles.primaryBtn}
            />
          </AnimatedItem>

          <AnimatedItem delay={200}>
            <View style={styles.footer}>
              <Text style={styles.footerText}>Remember your password?</Text>
              <Link href="/(auth)" asChild>
                <Text style={styles.footerLink}>Sign In</Text>
              </Link>
            </View>
          </AnimatedItem>
        </>
      ) : (
        <>
          <AnimatedItem delay={0}>
            <Text style={styles.formHeading}>Enter verification code</Text>
            <Text style={styles.formSubtitle}>
              Paste the full code or type one digit at a time.
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
              title={loading ? 'Verifying...' : 'Verify Code'}
              onPress={handleVerifyCode}
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
              <Text
                onPress={!loading ? handleResendCode : undefined}
                style={[styles.resendLink, { color: loading ? '#888888' : AUTH_CORAL }]}
              >
                Resend
              </Text>
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
