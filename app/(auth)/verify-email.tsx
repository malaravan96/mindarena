import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
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
import { useEntryAnimation } from '@/lib/useEntryAnimation';

const OTP_LENGTH = 6;

export default function VerifyEmail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(params.email || '');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const { colors } = useTheme();
  const anim = useEntryAnimation();

  useEffect(() => {
    if (!email) {
      loadUserEmail();
    }
  }, []);

  async function loadUserEmail() {
    const { data } = await supabase.auth.getUser();
    if (data.user?.email) {
      setEmail(data.user.email);
    }
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
    if (!email) {
      showAlert('Error', 'No email found. Please sign in again.');
      return;
    }

    setLoading(true);
    setError('');
    setOtp(Array(OTP_LENGTH).fill(''));

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) throw error;

      showAlert('Code Sent!', 'We sent a new verification code to your email.');
    } catch (e: any) {
      console.error('Resend verification error:', e);
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

  function skipVerification() {
    router.replace('/(app)');
  }

  const maxWidth = isDesktop ? 520 : isTablet ? 580 : '100%';

  return (
    <AuthScaffold animatedStyle={anim} maxWidth={maxWidth} scrollable>
      <AuthHeader
        icon={<Ionicons name="mail-open-outline" size={34} color="#ffffff" />}
        title="Verify Your Email"
        subtitle="One last step to secure and activate your account"
      />

      <Card style={[styles.card, { borderColor: `${colors.primary}22` }]}>
        <View style={[styles.badge, { backgroundColor: `${colors.primary}16` }]}>
          <Ionicons name="checkmark-circle-outline" size={14} color={colors.primary} />
          <Text style={[styles.badgeText, { color: colors.primary }]}>Account Confirmation</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Confirm your inbox code</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>We sent a verification code to your email address.</Text>

        <View style={[styles.emailPill, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}> 
          <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.emailText, { color: colors.primary }]} numberOfLines={1}>{email}</Text>
        </View>

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
          title={loading ? 'Verifying...' : 'Verify Email'}
          onPress={handleVerifyCode}
          disabled={loading || otp.join('').length !== OTP_LENGTH}
          loading={loading}
          variant="gradient"
          fullWidth
          style={styles.primaryCta}
        />

        <View style={styles.resendRow}>
          <Text style={[styles.resendText, { color: colors.textSecondary }]}>Didn't receive the code?</Text>
          <Text
            onPress={!loading ? resendVerification : undefined}
            style={[
              styles.resendLink,
              { color: loading ? colors.textSecondary : colors.primary },
            ]}
          >
            Resend
          </Text>
        </View>

        <Button
          title="Continue to App"
          onPress={skipVerification}
          variant="outline"
          fullWidth
          style={styles.secondaryCta}
        />

        <Text style={[styles.helperText, { color: colors.textTertiary }]}>You can verify later from your profile settings if needed.</Text>
      </Card>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: borderRadius.xl,
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
  emailPill: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  emailText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    flex: 1,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontSize: fontSize.sm,
  },
  primaryCta: {
    borderRadius: borderRadius.full,
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
  secondaryCta: {
    marginTop: spacing.md,
    borderRadius: borderRadius.full,
  },
  helperText: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    marginTop: spacing.md,
  },
});
