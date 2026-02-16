import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AuthHeader } from '@/components/AuthHeader';
import { ThemeAccessButton } from '@/components/ThemeAccessButton';
import { Container } from '@/components/Container';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing } from '@/constants/theme';
import { useEntryAnimation } from '@/lib/useEntryAnimation';

const OTP_LENGTH = 6;

export default function VerifyEmail() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const otpRefs = useRef<(TextInput | null)[]>([]);
  const { colors } = useTheme();
  const anim = useEntryAnimation();

  useEffect(() => {
    loadUserEmail();
  }, []);

  async function loadUserEmail() {
    const { data } = await supabase.auth.getUser();
    setEmail(data.user?.email || '');
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
      showAlert(
        'Verification Failed',
        e?.message || 'Invalid or expired code. Please try again.',
      );
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

      showAlert(
        'Code Sent!',
        'We sent a new verification code to your email.',
      );
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

  return (
    <Container style={styles.container}>
      <ThemeAccessButton />

      <Animated.View style={[styles.content, { backgroundColor: colors.background }, anim]}>
        <AuthHeader
          icon={'\u{1F4E7}'}
          title="Verify Your Email"
          subtitle="One last step to secure your account"
        />

        <Card style={styles.card}>
          <Text style={[styles.message, { color: colors.text }]}>
            We sent a verification code to:
          </Text>
          <Text style={[styles.email, { color: colors.primary, fontWeight: fontWeight.bold }]}>
            {email}
          </Text>

          <Text
            style={[
              styles.message,
              { color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.lg },
            ]}
          >
            Enter the 6-digit code below to verify your email
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

          <View style={styles.actions}>
            <Button
              title={loading ? 'Verifying...' : 'Verify Email'}
              onPress={handleVerifyCode}
              disabled={loading || otp.join('').length !== OTP_LENGTH}
              loading={loading}
              variant="gradient"
              fullWidth
            />

            <View style={styles.resendRow}>
              <Text style={[styles.resendText, { color: colors.textSecondary }]}>
                Didn't receive the code?{' '}
              </Text>
              <Text
                onPress={!loading ? resendVerification : undefined}
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

            <Button
              title="Continue to App"
              onPress={skipVerification}
              variant="outline"
              fullWidth
              style={{ marginTop: spacing.sm }}
            />
          </View>

          <Text
            style={[
              styles.helperText,
              {
                color: colors.textTertiary,
                fontSize: fontSize.xs,
                marginTop: spacing.md,
              },
            ]}
          >
            You can verify your email later from your profile settings
          </Text>
        </Card>
      </Animated.View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 500,
  },
  message: {
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  email: {
    fontSize: fontSize.lg,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: spacing.sm,
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
  actions: {
    marginTop: spacing.lg,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  resendText: {
    fontSize: fontSize.sm,
  },
  resendLink: {
    fontSize: fontSize.sm,
  },
  helperText: {
    textAlign: 'center',
  },
});
