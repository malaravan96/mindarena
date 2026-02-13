import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
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

export default function VerifyEmail() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const { colors } = useTheme();
  const anim = useEntryAnimation();

  useEffect(() => {
    loadUserEmail();
  }, []);

  async function loadUserEmail() {
    const { data } = await supabase.auth.getUser();
    setEmail(data.user?.email || '');
  }

  async function resendVerification() {
    if (!email) {
      showAlert('Error', 'No email found. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: 'mindarena://',
        },
      });

      if (error) throw error;

      showAlert(
        'Email Sent',
        'We sent you another verification email. Please check your inbox.',
      );
    } catch (e: any) {
      console.error('Resend verification error:', e);
      showAlert('Error', e?.message || 'Failed to resend verification email.');
    } finally {
      setLoading(false);
    }
  }

  async function skipVerification() {
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

        {/* Message */}
        <Card style={styles.card}>
          <Text style={[styles.message, { color: colors.text }]}>
            We sent a verification email to:
          </Text>
          <Text style={[styles.email, { color: colors.primary, fontWeight: fontWeight.bold }]}>
            {email}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary, marginTop: spacing.md }]}>
            Please check your inbox and click the verification link to confirm your account.
          </Text>

          <View style={styles.actions}>
            <Button
              title={loading ? 'Sending...' : 'Resend Verification Email'}
              onPress={resendVerification}
              disabled={loading}
              loading={loading}
              variant="outline"
              fullWidth
              style={{ marginBottom: spacing.sm }}
            />

            <Button
              title="Continue to App"
              onPress={skipVerification}
              variant="gradient"
              fullWidth
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
  actions: {
    marginTop: spacing.xl,
  },
  helperText: {
    textAlign: 'center',
  },
});
