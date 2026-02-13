import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { Link } from 'expo-router';
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

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { colors } = useTheme();
  const anim = useEntryAnimation();

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
      showAlert('Check your email', 'We sent you a magic link. Click it to sign in instantly!');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
      showAlert('Sign-in failed', e?.message ?? 'Unknown error');
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
          icon={'\u{1F9E0}'}
          title="MindArena"
          subtitle="Challenge your mind daily"
        />

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
                title={loading ? 'Sending...' : 'Send Magic Link'}
                onPress={sendMagicLink}
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
                We'll send you a secure magic link to sign in instantly. No password needed!
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
            <View style={styles.successContainer}>
              <Text style={styles.successEmoji}>{'\u2709\uFE0F'}</Text>
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
          <FeatureItem icon={'\u{1F3AF}'} text="Daily puzzles" colors={colors} />
          <FeatureItem icon={'\u{1F3C6}'} text="Leaderboards" colors={colors} />
          <FeatureItem icon={'\u{1F4CA}'} text="Track progress" colors={colors} />
        </View>

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
        <Text style={[styles.trustText, { color: colors.textTertiary }]}>
          {'\u{1F512}'} Secured with end-to-end encryption
        </Text>
      </Animated.View>
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
  trustText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
