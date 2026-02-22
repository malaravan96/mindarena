import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import { useEntryAnimation } from '@/lib/useEntryAnimation';

const OTP_LENGTH = 6;

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const { colors } = useTheme();
  const anim = useEntryAnimation();

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
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: v,
      });
      if (authError) throw authError;
      setStep('otp');
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
    setLoading(true);
    setError('');
    setOtp(Array(OTP_LENGTH).fill(''));

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });
      if (authError) throw authError;
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
        logo={require('@/assets/logo.png')}
        title="MindArena"
        subtitle={step === 'email' ? 'Play daily. Think sharper. Stay ahead.' : `Enter the code sent to ${email}`}
        onBack={
          step === 'otp'
            ? () => {
              setStep('email');
              setOtp(Array(OTP_LENGTH).fill(''));
              setError('');
            }
            : undefined
        }
      />

      <Card style={[styles.card, { borderColor: `${colors.primary}22` }]}>
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: `${colors.primary}16` }]}>
            <Ionicons name={step === 'email' ? 'flash-outline' : 'shield-checkmark-outline'} size={14} color={colors.primary} />
            <Text style={[styles.statusBadgeText, { color: colors.primary }]}>
              {step === 'email' ? 'Passwordless Sign In' : 'Secure Verification'}
            </Text>
          </View>
        </View>

        {step === 'email' ? (
          <>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Sign in with email</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Get a one-time code instantly and continue where you left off.</Text>

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
              onPress={sendOtpCode}
              disabled={loading}
              loading={loading}
              variant="gradient"
              fullWidth
              size="lg"
              style={styles.primaryCta}
            />

            <View style={[styles.infoChip, { backgroundColor: colors.surfaceVariant }]}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.infoChipText, { color: colors.textSecondary }]}>No password needed. Your code expires in 10 minutes.</Text>
            </View>

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textTertiary }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <Link href="/(auth)/sign-in-password" asChild>
              <Button
                title="Use Password Instead"
                onPress={() => { }}
                variant="outline"
                fullWidth
                size="lg"
              />
            </Link>
          </>
        ) : (
          <>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Enter verification code</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Use the latest 6-digit code from your inbox.</Text>

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
              title={loading ? 'Verifying...' : 'Verify & Sign In'}
              onPress={handleVerifyOtp}
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

      {step === 'email' && (
        <View style={styles.featuresRow}>
          <FeatureItem
            icon={<Ionicons name="sparkles-outline" size={20} color={colors.primary} />}
            text="Daily puzzles"
            colors={colors}
          />
          <FeatureItem
            icon={<Ionicons name="trophy-outline" size={20} color={colors.primary} />}
            text="Live ranks"
            colors={colors}
          />
          <FeatureItem
            icon={<Ionicons name="analytics-outline" size={20} color={colors.primary} />}
            text="Progress"
            colors={colors}
          />
        </View>
      )}

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Need an account?</Text>
        <Link href="/(auth)/register" asChild>
          <Text style={[styles.footerLink, { color: colors.primary }]}>Create one</Text>
        </Link>
      </View>
    </AuthScaffold>
  );
}

function FeatureItem({
  icon,
  text,
  colors,
}: {
  icon: React.ReactNode;
  text: string;
  colors: any;
}) {
  return (
    <View style={[styles.featureItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.featureIconWrap, { backgroundColor: `${colors.primary}16` }]}>{icon}</View>
      <Text style={[styles.featureText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
  },
  statusRow: {
    marginBottom: spacing.sm,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
  },
  cardSubtitle: {
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
    gap: spacing.xs,
    alignItems: 'center',
  },
  infoChipText: {
    fontSize: fontSize.xs,
    flex: 1,
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
  featuresRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  featureItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
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
