import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Card } from '@/components/Card';
import { useTheme } from '@/contexts/ThemeContext';
import { fontSize, fontWeight, spacing, isDesktop, isTablet } from '@/constants/theme';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { colors } = useTheme();

  async function sendMagicLink() {
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
        options: {
          emailRedirectTo: 'mindarena://',
        },
      });
      if (authError) throw authError;
      setSuccess(true);
      Alert.alert(
        'Check your email',
        'We sent you a magic link. Click it to sign in instantly!',
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
      Alert.alert('Sign-in failed', e?.message ?? 'Unknown error');
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
      <View style={[styles.content, { maxWidth, width: '100%' }]}>
        {/* App Icon/Logo */}
        <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoEmoji}>🧠</Text>
        </View>

        {/* Title Section */}
        <View style={styles.headerSection}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: fontSize['4xl'],
                fontWeight: fontWeight.black,
              },
            ]}
          >
            MindArena
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: colors.textSecondary,
                fontSize: fontSize.lg,
                fontWeight: fontWeight.medium,
              },
            ]}
          >
            Challenge your mind daily
          </Text>
          <Text
            style={[
              styles.description,
              {
                color: colors.textTertiary,
                fontSize: fontSize.sm,
                marginTop: spacing.xs,
              },
            ]}
          >
            Solve puzzles, compete on the leaderboard, and track your progress
          </Text>
        </View>

        {/* Auth Card */}
        <Card style={styles.card}>
          {!success ? (
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
                title={loading ? 'Sending...' : 'Send Magic Link'}
                onPress={sendMagicLink}
                disabled={loading}
                loading={loading}
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
                We'll send you a secure magic link to sign in instantly. No password needed!
              </Text>
            </>
          ) : (
            <View style={styles.successContainer}>
              <Text style={styles.successEmoji}>✉️</Text>
              <Text
                style={[
                  styles.successTitle,
                  {
                    color: colors.text,
                    fontSize: fontSize.xl,
                    fontWeight: fontWeight.bold,
                  },
                ]}
              >
                Check your email!
              </Text>
              <Text
                style={[
                  styles.successMessage,
                  {
                    color: colors.textSecondary,
                    fontSize: fontSize.base,
                  },
                ]}
              >
                We sent a magic link to{' '}
                <Text style={{ fontWeight: fontWeight.bold, color: colors.primary }}>
                  {email}
                </Text>
              </Text>
              <Button
                title="Send another link"
                onPress={() => setSuccess(false)}
                variant="outline"
                fullWidth
                style={{ marginTop: spacing.lg }}
              />
            </View>
          )}
        </Card>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <FeatureItem icon="🎯" text="Daily puzzles" colors={colors} />
          <FeatureItem icon="🏆" text="Leaderboards" colors={colors} />
          <FeatureItem icon="📊" text="Track progress" colors={colors} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function FeatureItem({ icon, text, colors }: { icon: string; text: string; colors: any }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
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
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoEmoji: {
    fontSize: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  description: {
    textAlign: 'center',
    maxWidth: 400,
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
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  successTitle: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successMessage: {
    textAlign: 'center',
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
  featureIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  featureText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});
