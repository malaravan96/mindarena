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
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { AuthHeader } from '@/components/AuthHeader';
import { ThemeAccessButton } from '@/components/ThemeAccessButton';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, isDesktop, isTablet } from '@/constants/theme';
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
      showAlert(
        'Code Sent!',
        'We sent a 6-digit verification code to your email.',
      );
    } catch (e: any) {
      console.error('Send code error:', e);
      setError(e?.message || 'Something went wrong. Please try again.');
      showAlert(
        'Failed to Send Code',
        e?.message || 'Could not send verification code. Please try again.',
      );
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

    // Handle paste of full code
    if (text.length > 1) {
      const digits = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
      for (let i = 0; i < OTP_LENGTH; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      // Focus last filled input or the next empty one
      const focusIndex = Math.min(digits.length, OTP_LENGTH - 1);
      otpRefs.current[focusIndex]?.focus();
      return;
    }

    const digit = text.replace(/[^0-9]/g, '');
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
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

  const maxWidth = isDesktop ? 500 : isTablet ? 600 : '100%';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.wrap, { backgroundColor: colors.background }]}
    >
      <ThemeAccessButton />

      <Animated.View style={[styles.content, { maxWidth, width: '100%' }, anim]}>
        <AuthHeader
          icon={step === 'email' ? '\u{1F511}' : '\u{1F4E7}'}
          title={step === 'email' ? 'Reset Password' : 'Enter Verification Code'}
          subtitle={
            step === 'email'
              ? 'Enter your email to receive a verification code'
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

        <Card style={styles.card}>
          {step === 'email' ? (
            <>
              <Input
                label="Email Address"
                icon={'\u2709'}
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
                We'll send a 6-digit verification code to your email
              </Text>
            </>
          ) : (
            <>
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
                title={loading ? 'Verifying...' : 'Verify Code'}
                onPress={handleVerifyCode}
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

        {/* Back to Sign In Link */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Remember your password?{' '}
          </Text>
          <Link href="/(auth)" asChild>
            <Text
              style={[
                styles.footerLink,
                { color: colors.primary, fontWeight: fontWeight.bold },
              ]}
            >
              Sign In
            </Text>
          </Link>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
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
    marginBottom: spacing.md,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footerText: {
    fontSize: fontSize.sm,
  },
  footerLink: {
    fontSize: fontSize.sm,
  },
});
