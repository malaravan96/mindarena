import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { AuthHeader } from '@/components/AuthHeader';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { OtpInputRow } from '@/components/auth/OtpInputRow';
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

const OTP_LENGTH = 6;

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const { colors } = useTheme();
  const anim = useEntryAnimation();

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
      console.error('Send code error:', e);
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

  const maxWidth = isDesktop ? 520 : isTablet ? 580 : '100%';

  return (
    <AuthScaffold animatedStyle={anim} maxWidth={maxWidth} scrollable>
      <AuthHeader
        icon={
          step === 'email' ? (
            <Ionicons name="key-outline" size={34} color="#ffffff" />
          ) : (
            <Ionicons name="mail-open-outline" size={34} color="#ffffff" />
          )
        }
        title={step === 'email' ? 'Reset Password' : 'Enter Verification Code'}
        subtitle={
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
      />

      <Card style={[styles.card, { borderColor: `${colors.primary}22` }]}>
        <View style={[styles.badge, { backgroundColor: `${colors.primary}16` }]}>
          <Ionicons name="shield-outline" size={14} color={colors.primary} />
          <Text style={[styles.badgeText, { color: colors.primary }]}>
            {step === 'email' ? 'Identity Check' : 'Code Verification'}
          </Text>
        </View>

        {step === 'email' ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Recover your account</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Enter the email linked to your account and we will send a one-time verification code.</Text>

            <Input
              label="Email Address"
              icon={<Ionicons name="mail-outline" size={18} color={colors.textTertiary} />}
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
              title={loading ? 'Sending...' : 'Send Verification Code'}
              onPress={handleSendCode}
              disabled={loading}
              loading={loading}
              variant="gradient"
              fullWidth
              size="lg"
              style={styles.primaryCta}
            />

            <View style={[styles.infoChip, { backgroundColor: colors.surfaceVariant }]}> 
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>Codes expire quickly for your security. Request a new one anytime.</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Enter verification code</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Paste the full code or type one digit at a time.</Text>

            <OtpInputRow
              otp={otp}
              error={error}
              loading={loading}
              inputRefs={otpRefs}
              onChange={handleOtpChange}
              onKeyPress={handleOtpKeyPress}
              autoFocusFirst
            />

            {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

            <Button
              title={loading ? 'Verifying...' : 'Verify Code'}
              onPress={handleVerifyCode}
              disabled={loading || otp.join('').length !== OTP_LENGTH}
              loading={loading}
              variant="gradient"
              fullWidth
              size="lg"
              style={styles.primaryCta}
            />

            <View style={styles.resendRow}>
              <Text style={[styles.resendText, { color: colors.textSecondary }]}>No code yet?</Text>
              <Text
                onPress={!loading ? handleResendCode : undefined}
                style={[
                  styles.resendLink,
                  { color: loading ? colors.textSecondary : colors.primary },
                ]}
              >
                Resend
              </Text>
            </View>
          </>
        )}
      </Card>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Remember your password?</Text>
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
    borderRadius: borderRadius.full,
  },
  infoChip: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoText: {
    fontSize: fontSize.xs,
    flex: 1,
  },
  errorText: {
    textAlign: 'center',
    fontSize: fontSize.sm,
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
