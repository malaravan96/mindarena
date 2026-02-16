import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TextInput,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { AuthHeader } from '@/components/AuthHeader';
import { ThemeAccessButton } from '@/components/ThemeAccessButton';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, isDesktop, isTablet } from '@/constants/theme';
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
      showAlert(
        'Verification Failed',
        e?.message || 'Invalid or expired code. Please try again.',
      );
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

  const maxWidth = isDesktop ? 500 : isTablet ? 600 : '100%';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.wrap, { backgroundColor: colors.background }]}
    >
      <ThemeAccessButton />

      <Animated.View style={[styles.content, { maxWidth, width: '100%' }, anim]}>
        <AuthHeader
          icon={<MaterialCommunityIcons name="brain" size={36} color="#ffffff" />}
          title="MindArena"
          subtitle={
            step === 'email'
              ? 'Challenge your mind daily'
              : `Enter the code sent to ${email}`
          }
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

        {/* Auth Card */}
        <Card style={styles.card}>
          {step === 'email' ? (
            <>
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: colors.text,
                    fontSize: fontSize.xl,
                    fontWeight: fontWeight.bold,
                    marginBottom: spacing.lg,
                  },
                ]}
              >
                Sign in with Email
              </Text>

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
              />

              <Text
                style={[
                  styles.helperText,
                  {
                    color: colors.textSecondary,
                    fontSize: fontSize.xs,
                    marginTop: spacing.md,
                  },
                ]}
              >
                We'll send you a 6-digit code to sign in instantly. No password needed!
              </Text>

              <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textTertiary }]}>OR</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <Link href="/(auth)/sign-in-password" asChild>
                <Button
                  title="Sign in with Password"
                  onPress={() => {}}
                  variant="outline"
                  fullWidth
                  size="lg"
                />
              </Link>
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: colors.text,
                    fontSize: fontSize.xl,
                    fontWeight: fontWeight.bold,
                    marginBottom: spacing.lg,
                  },
                ]}
              >
                Enter Verification Code
              </Text>

              {/* OTP Input Boxes */}
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      otpRefs.current[index] = ref;
                    }}
                    style={[
                      styles.otpBox,
                      {
                        borderColor: digit
                          ? colors.primary
                          : error
                          ? colors.error
                          : colors.border,
                        backgroundColor: colors.surface,
                        color: colors.text,
                      },
                    ]}
                    value={digit}
                    onChangeText={(text) => handleOtpChange(text, index)}
                    onKeyPress={({ nativeEvent }) =>
                      handleOtpKeyPress(nativeEvent.key, index)
                    }
                    keyboardType="number-pad"
                    maxLength={index === 0 ? OTP_LENGTH : 1}
                    selectTextOnFocus
                    editable={!loading}
                    autoFocus={index === 0}
                  />
                ))}
              </View>

              {error ? (
                <Text
                  style={[
                    styles.errorText,
                    { color: colors.error, fontSize: fontSize.sm },
                  ]}
                >
                  {error}
                </Text>
              ) : null}

              <Button
                title={loading ? 'Verifying...' : 'Verify & Sign In'}
                onPress={handleVerifyOtp}
                disabled={loading || otp.join('').length !== OTP_LENGTH}
                loading={loading}
                variant="gradient"
                fullWidth
                size="lg"
                style={{ marginTop: spacing.md }}
              />

              <View style={styles.resendRow}>
                <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                  Didn't receive the code?{' '}
                </Text>
                <Text
                  onPress={!loading ? handleResendCode : undefined}
                  style={[
                    styles.resendLink,
                    {
                      color: loading ? colors.textSecondary : colors.primary,
                      fontWeight: fontWeight.bold,
                    },
                  ]}
                >
                  Resend
                </Text>
              </View>
            </>
          )}
        </Card>

        {/* Features */}
        {step === 'email' && (
          <View style={styles.featuresContainer}>
            <FeatureItem
              icon={<Ionicons name="game-controller-outline" size={22} color={colors.primary} />}
              text="Daily puzzles"
              colors={colors}
            />
            <FeatureItem
              icon={<Ionicons name="trophy-outline" size={22} color={colors.primary} />}
              text="Leaderboards"
              colors={colors}
            />
            <FeatureItem
              icon={<Ionicons name="bar-chart-outline" size={22} color={colors.primary} />}
              text="Track progress"
              colors={colors}
            />
          </View>
        )}

        {/* Sign Up Link */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Don't have an account?{' '}
          </Text>
          <Link href="/(auth)/register" asChild>
            <Text
              style={[
                styles.footerLink,
                { color: colors.primary, fontWeight: fontWeight.bold },
              ]}
            >
              Sign Up
            </Text>
          </Link>
        </View>

        {/* Trust indicator */}
        <View style={styles.trustRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.textTertiary} />
          <Text style={[styles.trustText, { color: colors.textTertiary }]}>
            Secured with end-to-end encryption
          </Text>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
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
    <View style={styles.featureItem}>
      <View style={[styles.featureIconWrap, { backgroundColor: `${colors.primary}15` }]}>
        {icon}
      </View>
      <Text style={[styles.featureText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  cardTitle: {
    textAlign: 'center',
  },
  helperText: {
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
  },
  errorText: {
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resendText: {
    fontSize: fontSize.sm,
  },
  resendLink: {
    fontSize: fontSize.sm,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    flexWrap: 'wrap',
  },
  featureItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  featureText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
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
    fontWeight: fontWeight.medium,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: {
    fontSize: fontSize.sm,
  },
  footerLink: {
    fontSize: fontSize.sm,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  trustText: {
    fontSize: fontSize.xs,
  },
});
