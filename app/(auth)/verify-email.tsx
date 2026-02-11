import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Container } from '@/components/Container';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing } from '@/constants/theme';

export default function VerifyEmail() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const { colors } = useTheme();

  useEffect(() => {
    loadUserEmail();
  }, []);

  async function loadUserEmail() {
    const { data } = await supabase.auth.getUser();
    setEmail(data.user?.email || '');
  }

  async function resendVerification() {
    if (!email) {
      Alert.alert('Error', 'No email found. Please sign in again.');
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

      Alert.alert(
        'Email Sent',
        'We sent you another verification email. Please check your inbox.',
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      console.error('Resend verification error:', e);
      Alert.alert('Error', e?.message || 'Failed to resend verification email.');
    } finally {
      setLoading(false);
    }
  }

  async function skipVerification() {
    router.replace('/(app)');
  }

  return (
    <Container style={styles.container}>
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Text style={styles.icon}>📧</Text>
        </View>

        {/* Title */}
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.black,
            },
          ]}
        >
          Verify Your Email
        </Text>

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
      </View>
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
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.xl,
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
